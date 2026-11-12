// Timeline subscriptions: one-time payment per term (Stripe Checkout
// in payment mode — never a Stripe recurring subscription). A
// subscription buys, per subscription-year, up to 48 included scans
// of EACH iris (96 total), at most one per iris per rolling 7-day
// window, each with the full report unlocked and no charge — plus a
// professional overview written by a real person after each month,
// and the comprehensive Timeline report monitoring changes over
// time. All prices, allowances, and affiliate flats are server-side
// constants: the client never supplies a price, term, or discount.
//
// Overview honesty rule: overview text is human-written only. A slot
// with no submitted text displays as pending — the server never
// generates overview prose.

import { timingSafeEqual } from "crypto";
import { ensureSchema, getPool, query } from "./db";
import { normalizeRefCode, resolveAffiliate } from "./affiliates";
import {
  SUBSCRIPTION_TERMS,
  isSubscriptionTermKey,
  type SubscriptionTermKey,
} from "./subscriptionTerms";

export { SUBSCRIPTION_TERMS, isSubscriptionTermKey, type SubscriptionTermKey };

/** Included scans per iris per subscription-year (96 total/year). */
export const SUBSCRIPTION_ALLOWANCE_PER_IRIS_PER_YEAR = 48;
/** At most one included scan per iris per rolling 7-day window. */
export const SUBSCRIPTION_WEEKLY_WINDOW_DAYS = 7;
/** Max overview text length (human-written, via the reviewer route). */
export const OVERVIEW_MAX_CHARS = 10000;

/** Env var holding the reviewer token. The reviewer endpoint FAILS
 *  CLOSED when this is unset — no token, no submission, no queue. */
export const REVIEWER_TOKEN_ENV = "SUBSCRIPTION_REVIEWER_TOKEN";

function addYears(d: Date, years: number): Date {
  const out = new Date(d.getTime());
  out.setFullYear(out.getFullYear() + years);
  return out;
}

function monthStartOf(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function monthKey(d: Date): string {
  const m = monthStartOf(d);
  return `${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export interface SubscriptionRow {
  id: string;
  user_id: string | null;
  guest_email: string | null;
  term: string;
  price_cents: number;
  starts_at: string;
  ends_at: string | null;
  stripe_session_id: string;
  status: string;
}

/** The subscriber's current subscription-year window. For lifetime
 *  the window still renews every year on the purchase anniversary. */
export function subscriptionYearWindow(sub: { starts_at: string }): { yearStart: Date; yearEnd: Date } {
  const start = new Date(sub.starts_at);
  const now = new Date();
  if (now <= start) return { yearStart: start, yearEnd: addYears(start, 1) };
  let years = now.getUTCFullYear() - start.getUTCFullYear();
  let yearStart = addYears(start, years);
  if (yearStart > now) {
    years -= 1;
    yearStart = addYears(start, years);
  }
  return { yearStart, yearEnd: addYears(yearStart, 1) };
}

/** Latest active subscription for a user (ends_at null = lifetime,
 *  or ends_at in the future). A newer purchase supersedes an older
 *  one for allowance purposes; old rows are kept as history. */
export async function getActiveSubscription(userId: string): Promise<SubscriptionRow | null> {
  await ensureSchema();
  const rows = await query<SubscriptionRow>(
    `SELECT id, user_id, guest_email, term, price_cents, starts_at, ends_at, stripe_session_id, status
     FROM iris_subscriptions
     WHERE user_id = $1 AND status = 'active' AND (ends_at IS NULL OR ends_at > now())
     ORDER BY starts_at DESC LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

export interface OverviewSlot {
  month_start: string;
  overview_text: string | null;
  written_at: string | null;
}

/** Create overview slots for every month of the subscription from
 *  its start month through the current month (or its end month,
 *  whichever is earlier). Slots are created empty: pending until a
 *  real person writes the overview. */
export async function ensureOverviewSlots(sub: SubscriptionRow): Promise<void> {
  const start = monthStartOf(new Date(sub.starts_at));
  const endLimit = sub.ends_at ? new Date(sub.ends_at) : new Date();
  const end = monthStartOf(endLimit < new Date() ? endLimit : new Date());
  const months: string[] = [];
  const cursor = new Date(start.getTime());
  while (cursor <= end && months.length < 300) {
    months.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  for (const month of months) {
    await query(
      `INSERT INTO iris_subscription_overviews (subscription_id, month_start)
       VALUES ($1, $2) ON CONFLICT (subscription_id, month_start) DO NOTHING`,
      [sub.id, month],
    );
  }
}

export async function listOverviews(subscriptionId: string): Promise<OverviewSlot[]> {
  await ensureSchema();
  const rows = await query<OverviewSlot>(
    `SELECT month_start, overview_text, written_at
     FROM iris_subscription_overviews
     WHERE subscription_id = $1 ORDER BY month_start DESC`,
    [subscriptionId],
  );
  return rows;
}

export interface SubscriptionStatus {
  id: string;
  term: string;
  termLabel: string;
  priceCents: number;
  startsAt: string;
  endsAt: string | null;
  lifetime: boolean;
  yearStart: string;
  yearEnd: string;
  /** Included scans remaining this subscription-year, per iris. */
  remaining: { left: number; right: number };
  /** Included scans used this subscription-year, per iris. */
  used: { left: number; right: number };
  overviews: OverviewSlot[];
}

/** Full subscriber status: term, window, allowance counts, and
 *  overview slots. Returns null when the user has no active
 *  subscription. */
export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus | null> {
  const sub = await getActiveSubscription(userId);
  if (!sub) return null;
  const { yearStart, yearEnd } = subscriptionYearWindow(sub);
  await ensureOverviewSlots(sub);
  const counts = await query<{ iris: string; n: string }>(
    `SELECT iris, COUNT(*)::text AS n FROM iris_subscription_scans
     WHERE subscription_id = $1 AND scanned_at >= $2 AND scanned_at < $3
     GROUP BY iris`,
    [sub.id, yearStart.toISOString(), yearEnd.toISOString()],
  );
  const usedLeft = Number(counts.find((c) => c.iris === "left")?.n ?? 0);
  const usedRight = Number(counts.find((c) => c.iris === "right")?.n ?? 0);
  const overviews = await listOverviews(sub.id);
  const term = SUBSCRIPTION_TERMS[sub.term as SubscriptionTermKey];
  return {
    id: sub.id,
    term: sub.term,
    termLabel: term ? term.label : sub.term,
    priceCents: sub.price_cents,
    startsAt: sub.starts_at,
    endsAt: sub.ends_at,
    lifetime: sub.ends_at === null,
    yearStart: yearStart.toISOString(),
    yearEnd: yearEnd.toISOString(),
    remaining: {
      left: Math.max(0, SUBSCRIPTION_ALLOWANCE_PER_IRIS_PER_YEAR - usedLeft),
      right: Math.max(0, SUBSCRIPTION_ALLOWANCE_PER_IRIS_PER_YEAR - usedRight),
    },
    used: { left: usedLeft, right: usedRight },
    overviews,
  };
}

export type IncludeResult =
  | { included: true; already?: boolean; remaining: { left: number; right: number } }
  | { included: false; reason: "no_subscription" | "weekly" | "allowance" | "bad_iris" };

/**
 * Try to cover one saved scan with the subscriber's weekly included
 * allowance. Runs in a transaction so the weekly/allowance checks
 * and the insert can't race: at most one included scan per iris per
 * rolling 7 days, at most 48 per iris per subscription-year. On
 * success the scan row itself is flipped to unlocked (account copy
 * and shared copy, mirroring the webhook unlock) — the full report,
 * no charge. Re-saving an already-included scan is a no-op that
 * still reports included.
 */
export async function tryIncludeScan(
  userId: string,
  scanId: string,
  iris: string,
): Promise<IncludeResult> {
  if (iris !== "left" && iris !== "right") return { included: false, reason: "bad_iris" };
  await ensureSchema();
  const sub = await getActiveSubscription(userId);
  if (!sub) return { included: false, reason: "no_subscription" };
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT id FROM iris_subscription_scans WHERE subscription_id = $1 AND scan_id = $2`,
      [sub.id, scanId],
    );
    if (existing.rows.length > 0) {
      await client.query("COMMIT");
      const status = await getSubscriptionStatus(userId);
      return { included: true, already: true, remaining: status?.remaining ?? { left: 0, right: 0 } };
    }
    const last = await client.query(
      `SELECT scanned_at FROM iris_subscription_scans
       WHERE subscription_id = $1 AND iris = $2 ORDER BY scanned_at DESC LIMIT 1`,
      [sub.id, iris],
    );
    if (last.rows.length > 0) {
      const lastAt = new Date(last.rows[0].scanned_at).getTime();
      if (Date.now() - lastAt < SUBSCRIPTION_WEEKLY_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
        await client.query("ROLLBACK");
        return { included: false, reason: "weekly" };
      }
    }
    const { yearStart, yearEnd } = subscriptionYearWindow(sub);
    const countRows = await client.query(
      `SELECT COUNT(*)::text AS n FROM iris_subscription_scans
       WHERE subscription_id = $1 AND iris = $2 AND scanned_at >= $3 AND scanned_at < $4`,
      [sub.id, iris, yearStart.toISOString(), yearEnd.toISOString()],
    );
    if (Number(countRows.rows[0]?.n ?? 0) >= SUBSCRIPTION_ALLOWANCE_PER_IRIS_PER_YEAR) {
      await client.query("ROLLBACK");
      return { included: false, reason: "allowance" };
    }
    await client.query(
      `INSERT INTO iris_subscription_scans (subscription_id, user_id, scan_id, iris)
       VALUES ($1, $2, $3, $4)`,
      [sub.id, userId, scanId, iris],
    );
    await client.query(
      `UPDATE iris_scans SET unlocked = true, unlocked_at = now()
       WHERE user_id = $1 AND scan_id = $2`,
      [userId, scanId],
    );
    await client.query(
      `UPDATE iris_shared_scans SET unlocked = true, unlocked_at = now() WHERE scan_id = $1`,
      [scanId],
    );
    await client.query("COMMIT");
    const status = await getSubscriptionStatus(userId);
    return { included: true, remaining: status?.remaining ?? { left: 0, right: 0 } };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Webhook-only activation: a paid session whose amount EXACTLY
 * equals the term price activates that term. Idempotent on the
 * Stripe session id — a replayed webhook activates nothing more.
 * Any amount mismatch activates nothing and is logged by the caller.
 */
export async function activateSubscription(opts: {
  stripeSessionId: string;
  userId: string | null;
  guestEmail: string | null;
  term: string;
  amountCents: number;
}): Promise<{ activated: boolean; reason: string | null }> {
  if (!isSubscriptionTermKey(opts.term)) return { activated: false, reason: "unknown_term" };
  const term = SUBSCRIPTION_TERMS[opts.term];
  if (opts.amountCents !== term.priceCents) return { activated: false, reason: "amount_mismatch" };
  await ensureSchema();
  const endsAt = term.years === null ? null : addYears(new Date(), term.years).toISOString();
  const rows = await query<{ id: string }>(
    `INSERT INTO iris_subscriptions
       (user_id, guest_email, term, price_cents, starts_at, ends_at, stripe_session_id, status)
     VALUES ($1, $2, $3, $4, now(), $5, $6, 'active')
     ON CONFLICT (stripe_session_id) DO NOTHING RETURNING id`,
    [opts.userId, opts.guestEmail, opts.term, term.priceCents, endsAt, opts.stripeSessionId],
  );
  return rows.length > 0
    ? { activated: true, reason: null }
    : { activated: false, reason: "replay" };
}

/**
 * Affiliate credit for a subscription sale: FLAT, not 50/50 —
 * exactly $50.00 on a 1-year sale, exactly $100.00 on a 5/10/20-year
 * or lifetime sale. Gates: paid session, amount exactly the term
 * price, code resolving to a real affiliate, buyer ≠ affiliate
 * (account id or Stripe customer-email match). Idempotent on the
 * Stripe session id. A bookkeeping failure here must never break
 * the subscription activation above, so the webhook wraps it in
 * try/catch.
 */
export async function recordSubscriptionAffiliateSale(opts: {
  stripeSessionId: string;
  refCode: string | null;
  buyerUserId: string | null;
  buyerEmail: string | null;
  term: string;
  amountCents: number;
}): Promise<{ outcome: "credited" | "skipped"; reason: string | null }> {
  const code = normalizeRefCode(opts.refCode);
  if (!code) return { outcome: "skipped", reason: "no_code" };
  if (!isSubscriptionTermKey(opts.term)) return { outcome: "skipped", reason: "unknown_term" };
  const term = SUBSCRIPTION_TERMS[opts.term];
  if (opts.amountCents !== term.priceCents) return { outcome: "skipped", reason: "amount_mismatch" };
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
  const rows = await query<{ id: string }>(
    `INSERT INTO iris_affiliate_sales
       (stripe_session_id, affiliate_user_id, amount_cents, charged_cents, kind, title)
     VALUES ($1, $2, $3, $4, 'subscription', $5)
     ON CONFLICT (stripe_session_id) DO NOTHING RETURNING id`,
    [
      opts.stripeSessionId,
      aff.user_id,
      term.affiliateFlatCents,
      opts.amountCents,
      `Timeline subscription — ${term.label}`,
    ],
  );
  return rows.length > 0
    ? { outcome: "credited", reason: null }
    : { outcome: "skipped", reason: "replay" };
}

/**
 * Attach a guest-bought subscription to a signed-in account. The
 * claim key is the Stripe session id from the buyer's own success
 * URL — the same pattern as guest book verification. Only an
 * unclaimed (guest) row can be claimed; claiming an already-owned
 * row reports already-claimed rather than failing.
 */
export async function claimSubscription(
  sessionId: string,
  userId: string,
): Promise<{ claimed: boolean; already: boolean }> {
  await ensureSchema();
  const rows = await query<{ id: string }>(
    `UPDATE iris_subscriptions SET user_id = $2
     WHERE stripe_session_id = $1 AND user_id IS NULL RETURNING id`,
    [sessionId, userId],
  );
  if (rows.length > 0) return { claimed: true, already: false };
  const owned = await query<{ id: string }>(
    `SELECT id FROM iris_subscriptions WHERE stripe_session_id = $1 AND user_id = $2`,
    [sessionId, userId],
  );
  return { claimed: false, already: owned.length > 0 };
}

// ── Reviewer workflow (real people only) ───────────────────────────

function reviewerTokenOk(provided: string | null): boolean {
  const expected = process.env[REVIEWER_TOKEN_ENV];
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Submit one month's human-written overview. The token is the only
 *  authorization: unset env var or wrong token → denied, always.
 *  Text is stored verbatim and displayed verbatim — never generated,
 *  never edited by the server. */
export async function submitOverview(opts: {
  token: string | null;
  subscriptionId: string;
  monthStart: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!reviewerTokenOk(opts.token)) return { ok: false, error: "reviewer token required" };
  const text = (opts.text ?? "").trim();
  if (!text) return { ok: false, error: "overview text is required" };
  if (text.length > OVERVIEW_MAX_CHARS) return { ok: false, error: "overview text too long" };
  if (!/^\d{4}-\d{2}-01$/.test(opts.monthStart)) return { ok: false, error: "month must be YYYY-MM-01" };
  await ensureSchema();
  const subs = await query<{ starts_at: string; ends_at: string | null }>(
    `SELECT starts_at, ends_at FROM iris_subscriptions WHERE id = $1`,
    [opts.subscriptionId],
  );
  if (!subs.length) return { ok: false, error: "subscription not found" };
  const month = new Date(`${opts.monthStart}T00:00:00Z`);
  const first = monthStartOf(new Date(subs[0].starts_at));
  const lastLimit = subs[0].ends_at ? new Date(subs[0].ends_at) : new Date();
  const last = monthStartOf(lastLimit < new Date() ? lastLimit : new Date());
  if (month < first || month > last) return { ok: false, error: "month outside subscription" };
  const rows = await query(
    `INSERT INTO iris_subscription_overviews (subscription_id, month_start, overview_text, written_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (subscription_id, month_start) DO UPDATE
       SET overview_text = EXCLUDED.overview_text, written_at = now()
     RETURNING id`,
    [opts.subscriptionId, opts.monthStart, text],
  );
  return rows.length > 0 ? { ok: true } : { ok: false, error: "slot not found" };
}

export interface ReviewQueueEntry {
  subscriptionId: string;
  email: string | null;
  term: string;
  termLabel: string;
  monthStart: string;
  written: boolean;
}

/** Reviewer queue: every active subscriber's current-month slot,
 *  with whether its overview is written yet. Token-guarded, same
 *  fail-closed rule as submission. */
export async function getReviewQueue(
  token: string | null,
): Promise<{ ok: boolean; entries?: ReviewQueueEntry[]; error?: string }> {
  if (!reviewerTokenOk(token)) return { ok: false, error: "reviewer token required" };
  await ensureSchema();
  const subs = await query<{
    id: string;
    email: string | null;
    term: string;
    starts_at: string;
    ends_at: string | null;
  }>(
    `SELECT s.id, u.email, s.term, s.starts_at, s.ends_at
     FROM iris_subscriptions s
     LEFT JOIN iris_users u ON u.id = s.user_id
     WHERE s.status = 'active' AND (s.ends_at IS NULL OR s.ends_at > now())
     ORDER BY s.starts_at ASC`,
    [],
  );
  const entries: ReviewQueueEntry[] = [];
  const currentMonth = monthKey(new Date());
  for (const sub of subs) {
    await ensureOverviewSlots({
      id: sub.id,
      user_id: null,
      guest_email: null,
      term: sub.term,
      price_cents: 0,
      starts_at: sub.starts_at,
      ends_at: sub.ends_at,
      stripe_session_id: "",
      status: "active",
    });
    const slot = await query<{ overview_text: string | null }>(
      `SELECT overview_text FROM iris_subscription_overviews
       WHERE subscription_id = $1 AND month_start = $2`,
      [sub.id, currentMonth],
    );
    const term = SUBSCRIPTION_TERMS[sub.term as SubscriptionTermKey];
    entries.push({
      subscriptionId: sub.id,
      email: sub.email,
      term: sub.term,
      termLabel: term ? term.label : sub.term,
      monthStart: currentMonth,
      written: Boolean(slot[0]?.overview_text),
    });
  }
  return { ok: true, entries };
}
