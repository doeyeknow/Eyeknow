// Affiliate program (v2): affiliates set their own reading price on a
// sliding scale ($5.99–$19.99), and each affiliate-attributed reading
// sale splits 50/50 between the affiliate and the platform (round half
// up, affiliate gets the extra cent on odd totals: $5.99 → $3.00 /
// $2.99). Server-side authoritative, fail-closed. The Stripe webhook
// is the ONLY crediting path; the client never supplies amounts, and
// codes are validated server-side before any credit. Bookkeeping
// failures must never break the reading unlock (the webhook wraps
// calls here in try/catch).

import { randomBytes } from "crypto";
import type Stripe from "stripe";
import { ensureSchema, query } from "./db";
import { getStripe } from "./stripe";

/** Affiliate-set reading price bounds, in cents. */
export const AFFILIATE_MIN_PRICE_CENTS = 599;
export const AFFILIATE_MAX_PRICE_CENTS = 1999;

export const REFERRAL_COOKIE = "iris_ref";
export const REFERRAL_PRICE_COOKIE = "iris_ref_price";
export const REFERRAL_TTL_DAYS = 30;

/** A price is valid only as an integer number of cents in range. */
export function normalizeAffiliatePrice(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isInteger(raw)) return null;
  if (raw < AFFILIATE_MIN_PRICE_CENTS || raw > AFFILIATE_MAX_PRICE_CENTS) return null;
  return raw;
}

/** Flat affiliate share per attributed book sale, in cents.
 *  Books stay $9.99 and the slider never affects this: every
 *  affiliate-attributed book sale earns exactly $3.00, platform
 *  keeps $6.99. */
export const BOOK_AFFILIATE_SHARE_CENTS = 300;
export const BOOK_PRICE_CENTS_AFFILIATE_GATE = 999;

/** Round half up: the affiliate's 50% share, in cents. $5.99 → 300. */
export function affiliateShareCents(chargedCents: number): number {
  return Math.floor((chargedCents + 1) / 2);
}

/** Slugs that could collide with routes or features. Enforced on
 *  every save so a custom link can never swallow a real page. */
export const RESERVED_SLUGS = new Set([
  "affiliates",
  "creator",
  "api",
  "auth",
  "admin",
  "login",
  "register",
  "scan",
  "reading",
  "books",
  "checkout",
  "webhook",
  "static",
  "public",
  "_next",
  "team",
  "subscription",
  "support",
  "share",
]);

/** Validate a custom link slug. Returns the normalized slug or a
 *  clear, user-facing error (never a 500 for bad input). */
export function validateCustomSlug(raw: unknown): { slug: string } | { error: string } {
  if (typeof raw !== "string") return { error: "Enter a link name." };
  const slug = raw.trim().toLowerCase();
  if (slug.length < 3 || slug.length > 30) {
    return { error: "Use 3–30 characters for your link name." };
  }
  if (!/^[a-z0-9-]+$/.test(slug) || !/[a-z0-9]/.test(slug)) {
    return { error: "Use only lowercase letters, numbers, and hyphens." };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { error: "That name is reserved — pick another." };
  }
  return { slug };
}

/** A referral reference is either the auto-generated code or a
 *  custom slug: short lowercase alphanumerics and hyphens. Anything
 *  else is ignored, never credited — an invalid reference must never
 *  break a checkout. (The database lookup is authoritative; this is
 *  only a sanity filter.) */
export function normalizeRefCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toLowerCase();
  return /^[a-z0-9-]{3,30}$/.test(code) && /[a-z0-9]/.test(code) ? code : null;
}

function newCode(): string {
  // 8 hex chars: lowercase alphanumerics, easy to share.
  return randomBytes(4).toString("hex");
}

export interface AffiliateIdentity {
  user_id: string;
  email: string;
  /** Canonical auto-generated code (the permanent fallback link). */
  code: string;
  /** Current affiliate-set reading price, in cents. */
  price_cents: number;
}

/**
 * Resolve a referral reference — either the auto-generated code or a
 * custom slug — to the affiliate. Both forms stay valid forever for
 * clicks, pricing, and sales attribution.
 */
export async function resolveAffiliate(ref: string): Promise<AffiliateIdentity | null> {
  const rows = await query<AffiliateIdentity>(
    `SELECT a.user_id, u.email, a.code, COALESCE(a.price_cents, 1999) AS price_cents
     FROM iris_affiliates a
     JOIN iris_users u ON u.id = a.user_id
     WHERE a.code = $1 OR a.custom_slug = $1`,
    [ref],
  );
  return rows[0] ?? null;
}

export async function getOrCreateAffiliate(userId: string): Promise<string> {
  await ensureSchema();
  const existing = await query<{ code: string }>(
    `SELECT code FROM iris_affiliates WHERE user_id = $1`,
    [userId],
  );
  if (existing[0]) return existing[0].code;
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    try {
      await query(`INSERT INTO iris_affiliates (user_id, code) VALUES ($1, $2)`, [userId, code]);
      return code;
    } catch {
      // Code collision — retry with a fresh code.
    }
  }
  throw new Error("could not allocate affiliate code");
}

/** The affiliate terms version the setup flow presents. Bump when
 *  the terms text in components/AffiliateSetup.tsx changes. */
export const AFFILIATE_TERMS_VERSION = "2026-11-01";

/** Validate a link name AND check it is free — used by the setup
 *  flow before signup completes, so a bad or taken name is caught
 *  on the link step, not after. A name matching another affiliate's
 *  auto code counts as taken: resolveAffiliate matches code OR
 *  slug, so such a name would be ambiguous. */
export async function checkSlugAvailability(
  raw: unknown,
): Promise<{ slug: string } | { error: string }> {
  const validated = validateCustomSlug(raw);
  if ("error" in validated) return validated;
  await ensureSchema();
  const rows = await query<{ one: number }>(
    `SELECT 1 AS one FROM iris_affiliates WHERE custom_slug = $1 OR code = $1 LIMIT 1`,
    [validated.slug],
  );
  if (rows.length) return { error: "That name is taken — pick another." };
  return { slug: validated.slug };
}

/**
 * Complete the affiliate setup flow in one server-side pass:
 * validate everything first, then create the affiliate (if new),
 * set the permanent link name, set the reading price, and record
 * the terms agreement. Throws user-facing Errors (validation text,
 * "taken", "locked", "price out of range") for the route to map.
 * Safe to retry: if an early attempt created the row but failed a
 * later step, a retry with a different name completes cleanly on
 * the same row.
 */
export async function completeAffiliateSignup(
  userId: string,
  opts: { slug: unknown; priceCents: unknown },
): Promise<{ code: string; slug: string }> {
  const price = normalizeAffiliatePrice(opts.priceCents);
  if (price === null) throw new Error("price out of range");
  const available = await checkSlugAvailability(opts.slug);
  if ("error" in available) throw new Error(available.error);
  const code = await getOrCreateAffiliate(userId);
  const slug = await setCustomSlug(userId, available.slug);
  await setAffiliatePrice(userId, price);
  await query(
    `UPDATE iris_affiliates SET terms_agreed_at = now(), terms_version = $2 WHERE user_id = $1`,
    [userId, AFFILIATE_TERMS_VERSION],
  );
  return { code, slug };
}

/** Click tracking carries no PII — code + timestamp only. Unknown or
 *  invalid codes are silently ignored (no oracle for code guessing).
 *  Clicks are always recorded under the affiliate's canonical auto
 *  code, so the dashboard count includes visits via the custom slug
 *  and the clean path link too. Returns the canonical code and the
 *  affiliate's current price for a valid reference; null otherwise. */
export async function recordAffiliateClick(
  rawCode: string,
): Promise<{ code: string; priceCents: number } | null> {
  const code = normalizeRefCode(rawCode);
  if (!code) return null;
  await ensureSchema();
  const aff = await resolveAffiliate(code);
  if (!aff) return null;
  await query(`INSERT INTO iris_affiliate_clicks (code) VALUES ($1)`, [aff.code]);
  return { code: aff.code, priceCents: aff.price_cents };
}

/** Set an affiliate's reading price (bounds enforced here, never
 *  trusted from the client). Affects future sales only — sessions
 *  already created keep the price they were created with. */
export async function setAffiliatePrice(userId: string, priceCents: number): Promise<void> {
  const price = normalizeAffiliatePrice(priceCents);
  if (price === null) throw new Error("price out of range");
  await ensureSchema();
  const rows = await query(
    `UPDATE iris_affiliates SET price_cents = $2 WHERE user_id = $1 RETURNING id`,
    [userId, price],
  );
  if (!rows.length) throw new Error("not an affiliate");
}

/**
 * Set an affiliate's custom link slug — ONCE. The link name is
 * permanent: if one is already set, re-saving the same slug is a
 * no-op and any different slug throws Error("locked") (the route
 * answers 409). Throws Error("taken") when another affiliate
 * already owns the slug, and a validation Error for bad input.
 * The auto-generated code link keeps working forever regardless.
 */
export async function setCustomSlug(userId: string, rawSlug: unknown): Promise<string> {
  const validated = validateCustomSlug(rawSlug);
  if ("error" in validated) throw new Error(validated.error);
  await ensureSchema();
  const existing = await query<{ custom_slug: string | null }>(
    `SELECT custom_slug FROM iris_affiliates WHERE user_id = $1`,
    [userId],
  );
  if (!existing.length) throw new Error("not an affiliate");
  if (existing[0].custom_slug) {
    if (existing[0].custom_slug === validated.slug) return validated.slug;
    throw new Error("locked");
  }
  try {
    const rows = await query(
      `UPDATE iris_affiliates SET custom_slug = $2
       WHERE user_id = $1 AND custom_slug IS NULL RETURNING id`,
      [userId, validated.slug],
    );
    if (!rows.length) {
      // Lost a race with a simultaneous first save: whatever landed
      // is now the permanent name.
      const now = await query<{ custom_slug: string | null }>(
        `SELECT custom_slug FROM iris_affiliates WHERE user_id = $1`,
        [userId],
      );
      if (now[0]?.custom_slug === validated.slug) return validated.slug;
      if (now[0]?.custom_slug) throw new Error("locked");
      throw new Error("not an affiliate");
    }
    return validated.slug;
  } catch (e) {
    // Postgres unique violation on the slug index: a race on the
    // same slug — one wins, the other gets a clean conflict.
    if (e instanceof Error && "code" in e && (e as { code?: string }).code === "23505") {
      throw new Error("taken");
    }
    throw e;
  }
}

export type AffiliateSaleOutcome = "credited" | "skipped";

/**
 * Credit one affiliate sale, or skip with a reason. Two kinds:
 *
 * READINGS — the affiliate's 50% share of the ACTUAL charged amount
 * (round half up). Gates, all server-side: a real reading purchase
 * (never $1 follow-ups — they carry no affiliate price and fail the
 * price gate; free supporter-gift grants are not Stripe sessions and
 * never reach this code), the charged amount must EXACTLY equal the
 * affiliate price recorded in the session metadata at checkout time
 * (a tampered or stale cookie can never set the charge — the cookie
 * is display-only and the metadata price comes from the affiliate's
 * stored price) — or, for a gift-discounted unlock (discounted: true),
 * exactly 90% of that metadata price, i.e. the discounted amount
 * actually charged — a reference resolving to a real affiliate, and
 * never the affiliate buying their own reading (account id match, or
 * Stripe customer-email match for guests). Paid gift buys ARE
 * reading purchases and earn the split; the buyer is the gift
 * purchaser, not the recipient.
 *
 * BOOKS — exactly $3.00 flat per attributed book sale, regardless
 * of the affiliate's reading-price slider (the slider sets reading
 * prices only; books stay $9.99). Gates: a paid $9.99 book session,
 * a reference resolving to a real affiliate, buyer ≠ affiliate.
 *
 * Idempotent on the Stripe session id: a replayed webhook grants
 * zero more, for either kind.
 */
export async function recordAffiliateSale(opts: {
  stripeSessionId: string;
  refCode: string | null;
  buyerUserId: string | null;
  buyerEmail: string | null;
  amountCents: number;
  metadataPriceCents: number | null;
  isBook: boolean;
  /** Book title, for book sales (shown on the dashboard). */
  title?: string | null;
  /** True when the session is a gift-discounted unlock: the expected
   *  charge is 90% of the metadata price, not the metadata price. */
  discounted?: boolean;
}): Promise<{ outcome: AffiliateSaleOutcome; reason: string | null }> {
  const code = normalizeRefCode(opts.refCode);
  if (!code) return { outcome: "skipped", reason: "no_code" };
  await ensureSchema();
  const aff = await resolveAffiliate(code);
  if (!aff) return { outcome: "skipped", reason: "unknown_code" };
  if (opts.buyerUserId && opts.buyerUserId === aff.user_id) {
    return { outcome: "skipped", reason: "self_purchase" };
  }
  const buyerEmail = opts.buyerEmail?.trim().toLowerCase();
  if (buyerEmail && buyerEmail === aff.email.toLowerCase()) {
    return { outcome: "skipped", reason: "self_purchase" };
  }
  if (opts.isBook) {
    if (opts.amountCents !== BOOK_PRICE_CENTS_AFFILIATE_GATE) {
      return { outcome: "skipped", reason: "book_amount_mismatch" };
    }
    const rows = await query<{ id: string }>(
      `INSERT INTO iris_affiliate_sales
         (stripe_session_id, affiliate_user_id, amount_cents, charged_cents, kind, title)
       VALUES ($1, $2, $3, $4, 'book', $5)
       ON CONFLICT (stripe_session_id) DO NOTHING RETURNING id`,
      [opts.stripeSessionId, aff.user_id, BOOK_AFFILIATE_SHARE_CENTS, opts.amountCents, opts.title ?? null],
    );
    return rows.length > 0
      ? { outcome: "credited", reason: null }
      : { outcome: "skipped", reason: "replay" };
  }
  if (opts.metadataPriceCents === null) return { outcome: "skipped", reason: "no_metadata_price" };
  if (normalizeAffiliatePrice(opts.metadataPriceCents) === null) {
    return { outcome: "skipped", reason: "metadata_price_out_of_range" };
  }
  if (opts.discounted) {
    // Gift-discounted unlock: the charge must be exactly 90% of the
    // metadata price (10% off, rounded: $5.99 → $5.39, $9.99 → $8.99).
    const expectedDiscounted = Math.round((opts.metadataPriceCents * 90) / 100);
    if (opts.amountCents !== expectedDiscounted) {
      return { outcome: "skipped", reason: "discount_amount_mismatch" };
    }
  } else if (opts.amountCents !== opts.metadataPriceCents) {
    return { outcome: "skipped", reason: "amount_mismatch" };
  }
  const share = affiliateShareCents(opts.amountCents);
  const rows = await query<{ id: string }>(
    `INSERT INTO iris_affiliate_sales
       (stripe_session_id, affiliate_user_id, amount_cents, charged_cents, kind, title)
     VALUES ($1, $2, $3, $4, 'reading', NULL)
     ON CONFLICT (stripe_session_id) DO NOTHING RETURNING id`,
    [opts.stripeSessionId, aff.user_id, share, opts.amountCents],
  );
  return rows.length > 0
    ? { outcome: "credited", reason: null }
    : { outcome: "skipped", reason: "replay" };
}

export interface AffiliateSaleRow {
  id: string;
  /** The affiliate's share, in cents (what the balance counts):
   *  50% of a reading charge, exactly $3.00 for a book, or the
   *  subscription flat ($50 on 1-year, $100 on longer terms). */
  amount_cents: number;
  /** The full amount the buyer was charged, in cents. */
  charged_cents: number;
  /** "reading", "book", or "subscription". */
  kind: string;
  /** Book title, for book sales; null for readings. */
  title: string | null;
  created_at: string;
}

export interface AffiliatePayoutRow {
  id: string;
  amount_cents: number;
  status: string;
  /** Why a payout is still pending, e.g. 'issuing_unavailable'. */
  status_detail: string | null;
  /** Whether a Stripe Issuing card was issued for this payout. The
   *  card id itself is never sent to the client; card details are
   *  fetched on demand through the owner-only card route. */
  has_card: boolean;
  requested_at: string;
  paid_at: string | null;
}

export interface AffiliateStats {
  code: string;
  /** Custom link slug, if the affiliate set one (null otherwise). */
  customSlug: string | null;
  /** Current affiliate-set reading price, in cents. */
  priceCents: number;
  clicks: number;
  sales: AffiliateSaleRow[];
  payouts: AffiliatePayoutRow[];
  earnedCents: number;
  paidCents: number;
  pendingCents: number;
  /** Earned minus paid minus pending: what a new request may claim. */
  availableCents: number;
}

/** Balance is COMPUTED (sales minus paid minus pending payouts) —
 *  there is deliberately no mutable balance column to drift. */
export async function getAffiliateStats(userId: string): Promise<AffiliateStats | null> {
  await ensureSchema();
  const aff = await query<{ code: string; price_cents: number; custom_slug: string | null }>(
    `SELECT code, COALESCE(price_cents, 1999) AS price_cents, custom_slug
     FROM iris_affiliates WHERE user_id = $1`,
    [userId],
  );
  if (!aff[0]) return null;
  const code = aff[0].code;
  const clickRows = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM iris_affiliate_clicks WHERE code = $1`,
    [code],
  );
  const sales = await query<AffiliateSaleRow>(
    `SELECT id, amount_cents, COALESCE(charged_cents, 599) AS charged_cents,
       COALESCE(kind, 'reading') AS kind, title, created_at
     FROM iris_affiliate_sales
     WHERE affiliate_user_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [userId],
  );
  const payouts = await query<AffiliatePayoutRow>(
    `SELECT id, amount_cents, status, status_detail,
       (stripe_card_id IS NOT NULL) AS has_card, requested_at, paid_at
     FROM iris_affiliate_payouts
     WHERE affiliate_user_id = $1 ORDER BY requested_at DESC LIMIT 100`,
    [userId],
  );
  const earned = sales.reduce((s, r) => s + r.amount_cents, 0);
  const paid = payouts.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount_cents, 0);
  const pending = payouts.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount_cents, 0);
  return {
    code,
    customSlug: aff[0].custom_slug,
    priceCents: aff[0].price_cents,
    clicks: Number(clickRows[0]?.n ?? 0),
    sales,
    payouts,
    earnedCents: earned,
    paidCents: paid,
    pendingCents: pending,
    availableCents: Math.max(0, earned - paid - pending),
  };
}

/**
 * Open a payout request for the full available balance. At most one
 * pending request per affiliate (enforced by a partial unique index
 * plus this check), so a request can never double-claim. The row is
 * created pending; fulfillment (card issuance) is attempted by the
 * route right after, and a failed attempt leaves the row pending
 * with a clear status detail — never failed, never lost.
 */
export async function requestAffiliatePayout(userId: string): Promise<{ id: string; amountCents: number }> {
  const stats = await getAffiliateStats(userId);
  if (!stats) throw new Error("not an affiliate");
  if (stats.pendingCents > 0) throw new Error("a payout request is already open");
  if (stats.availableCents <= 0) throw new Error("no balance available");
  try {
    const rows = await query<{ id: string }>(
      `INSERT INTO iris_affiliate_payouts (affiliate_user_id, amount_cents, status)
       VALUES ($1, $2, 'pending') RETURNING id`,
      [userId, stats.availableCents],
    );
    return { id: rows[0].id, amountCents: stats.availableCents };
  } catch {
    throw new Error("a payout request is already open");
  }
}

/** Find the affiliate's currently open payout request, if any. */
export async function getOpenAffiliatePayout(userId: string): Promise<{ id: string; amountCents: number } | null> {
  const rows = await query<{ id: string; amount_cents: number }>(
    `SELECT id, amount_cents FROM iris_affiliate_payouts
     WHERE affiliate_user_id = $1 AND status = 'pending' ORDER BY requested_at DESC LIMIT 1`,
    [userId],
  );
  return rows[0] ? { id: rows[0].id, amountCents: rows[0].amount_cents } : null;
}

// ── Stripe Issuing virtual-card payouts ────────────────────────────
// One card per payout request, capped at the payout amount via an
// all-time spending limit. The card number/CVC are NEVER stored in
// our database — only the Stripe card id, and details are fetched
// on demand through the owner-only card route. Virtual cards cost
// $0.10 each to Adam's Stripe account; that cost is not deducted
// from affiliate balances. Card issuance is idempotent: cards are
// created with an idempotency key per payout, so a retried
// fulfillment can never double-issue.
//
// Identity reality check (Stripe's own types enforce this):
// cardholder creation REQUIRES a legal name (no special characters
// or numbers, max 24 chars) AND a billing address. The eyeKnow
// account holds neither — only an email. So v1 does NOT fabricate
// identity data: when no cardholder exists yet, fulfillment stops
// with 'needs_identity' and the payout stays pending with that
// clear reason. A future identity-collection step (legal name +
// billing address on the dashboard) is what unblocks live cardholder
// creation; a previously stored cardholder id is reused as-is.

async function getStoredCardholderId(stripe: Stripe, userId: string): Promise<string | null> {
  const rows = await query<{ stripe_cardholder_id: string | null }>(
    `SELECT stripe_cardholder_id FROM iris_affiliates WHERE user_id = $1`,
    [userId],
  );
  const existing = rows[0]?.stripe_cardholder_id;
  if (!existing) return null;
  try {
    await stripe.issuing.cardholders.retrieve(existing);
    return existing;
  } catch {
    // Stored cardholder is gone — identity must be collected again.
    return null;
  }
}

/**
 * Fulfill one pending payout by issuing its virtual card. Returns
 * 'paid' only once the card is issued AND the row is marked paid.
 * Throws 'missing_identity' when no cardholder exists yet (v1 has no
 * stored legal name/billing address to create one from), and throws
 * any Stripe error through so the caller can leave the row pending.
 */
export async function fulfillAffiliatePayout(stripe: Stripe, payoutId: string, userId: string): Promise<"paid" | "pending"> {
  const rows = await query<{
    amount_cents: number;
    status: string;
    stripe_card_id: string | null;
  }>(
    `SELECT p.amount_cents, p.status, p.stripe_card_id
     FROM iris_affiliate_payouts p
     WHERE p.id = $1 AND p.affiliate_user_id = $2`,
    [payoutId, userId],
  );
  const row = rows[0];
  if (!row) return "pending";
  if (row.status === "paid") return "paid";
  if (row.status !== "pending") return "pending";
  // A previous attempt issued the card but crashed before marking
  // paid: reuse the card, never issue a second one.
  if (row.stripe_card_id) {
    const marked = await query(
      `UPDATE iris_affiliate_payouts SET status = 'paid', paid_at = now(), status_detail = NULL
       WHERE id = $1 AND status = 'pending' RETURNING id`,
      [payoutId],
    );
    return marked.length > 0 ? "paid" : "pending";
  }
  const cardholderId = await getStoredCardholderId(stripe, userId);
  if (!cardholderId) throw new Error("missing_identity");
  const card = await stripe.issuing.cards.create(
    {
      cardholder: cardholderId,
      currency: "usd",
      type: "virtual",
      status: "active",
      spending_controls: {
        spending_limits: [{ amount: row.amount_cents, interval: "all_time" }],
      },
      metadata: { affiliate_payout_id: payoutId },
    },
    { idempotencyKey: `affiliate-payout-${payoutId}` },
  );
  const marked = await query(
    `UPDATE iris_affiliate_payouts SET status = 'paid', paid_at = now(), status_detail = NULL, stripe_card_id = $1
     WHERE id = $2 AND status = 'pending' RETURNING id`,
    [card.id, payoutId],
  );
  if (marked.length > 0) return "paid";
  // Lost a race with another fulfillment of the same row: re-read;
  // if it is paid now, the card exists exactly once (idempotency key).
  const again = await query<{ status: string }>(
    `SELECT status FROM iris_affiliate_payouts WHERE id = $1`,
    [payoutId],
  );
  return again[0]?.status === "paid" ? "paid" : "pending";
}

/**
 * Attempt fulfillment for one payout row. Any failure leaves the row
 * pending with a clear reason and the balance untouched. Reasons:
 *  - 'needs_identity': no cardholder exists and v1 has no stored
 *    legal name/billing address to create one from.
 *  - 'issuing_unavailable': Issuing not activated, key lacks Issuing
 *    permission, Stripe unconfigured or unreachable.
 * Never throws.
 */
export async function attemptPayoutFulfillment(
  payoutId: string,
  userId: string,
): Promise<{ outcome: "paid" | "pending"; detail: string | null }> {
  const stripe = getStripe();
  if (!stripe) {
    await query(
      `UPDATE iris_affiliate_payouts SET status_detail = 'issuing_unavailable' WHERE id = $1 AND status = 'pending'`,
      [payoutId],
    );
    return { outcome: "pending", detail: "issuing_unavailable" };
  }
  try {
    const outcome = await fulfillAffiliatePayout(stripe, payoutId, userId);
    if (outcome === "paid") return { outcome, detail: null };
    return { outcome: "pending", detail: "issuing_unavailable" };
  } catch (e) {
    const detail = e instanceof Error && e.message === "missing_identity"
      ? "needs_identity"
      : "issuing_unavailable";
    await query(
      `UPDATE iris_affiliate_payouts SET status_detail = $2 WHERE id = $1 AND status = 'pending'`,
      [payoutId, detail],
    );
    return { outcome: "pending", detail };
  }
}
