// First-basic $1 offer (Adam, 2026-11-15): someone scans an iris
// and leaves the reading locked. One hour later — if they opted
// into notifications — one push notification offers their FIRST
// basic reading for $1 instead of $3. The offer is one time per
// account, priced server-side at every step that can charge, and
// carries ZERO referral credit (Adam, 2026-11-15 23:01, explicit:
// the $1 unlock pays nothing to the referral — enforced here by
// routing the sale through the basic path, which the webhook never
// credits, exactly like the $3 basic).
//
// Rules, all enforced server-side:
//  - Eligibility: the scan carries a live offer row (created when
//    the notification is sent), the scan is inside its 7-day window
//    (counted from the SCAN, not from the send), and the account
//    has never unlocked a basic reading anywhere it is stored.
//    Guests (shared readings, no account) are eligible per scan:
//    the offer row, the window, and no redemption for that scan.
//  - No stacking: the $1 price replaces the $3 basic price; the
//    basic path already zeroes affiliate pricing and gift
//    discounts, and the coupon path is a separate free full unlock
//    that never touches pricing.
//  - Redemption: the first fulfillment (webhook or buyer-return
//    verify, whichever runs first) atomically claims the offer row
//    for its Stripe session; a second session can never redeem the
//    same offer. Expiry is enforced at checkout time only — a
//    Stripe session lives at most ~24h, so a payment made in good
//    faith from a checkout created inside the window still settles
//    even if it lands just past the edge.

import { ensureSchema, query } from "./db";
import { BASIC_PRICE_CENTS } from "./stripe";

/** The offer price for a first basic reading, in cents. */
export const FIRST_BASIC_OFFER_CENTS = 100;

/** How long after the scan the offer notification may send. */
export const OFFER_DELAY_MS = 60 * 60 * 1000;

/** How long the offer link stays valid, counted from the scan. */
export const OFFER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface OfferRow {
  scan_id: string;
  user_id: string | null;
  created_at: number;
  expires_at: number;
  redeemed_session_id: string | null;
  redeemed_at: string | null;
}

export async function getOfferRow(scanId: string): Promise<OfferRow | null> {
  await ensureSchema();
  const rows = await query<OfferRow>(
    `SELECT scan_id, user_id, created_at, expires_at, redeemed_session_id, redeemed_at
     FROM iris_first_basic_offers WHERE scan_id = $1`,
    [scanId],
  );
  if (!rows[0]) return null;
  // pg returns BIGINT as a string — coerce, or expiry arithmetic
  // below would concatenate instead of add.
  return { ...rows[0], created_at: Number(rows[0].created_at), expires_at: Number(rows[0].expires_at) };
}

/** Create the offer row for a scan when its notification is sent.
 *  Idempotent per scan; the window runs from the scan's own
 *  creation time. Returns the row (new or existing). */
export async function createOfferForScan(
  scanId: string,
  userId: string | null,
  scanCreatedAt: number,
  now: number = Date.now(),
): Promise<OfferRow> {
  await ensureSchema();
  await query(
    `INSERT INTO iris_first_basic_offers (scan_id, user_id, created_at, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (scan_id) DO NOTHING`,
    [scanId, userId, now, Number(scanCreatedAt) + OFFER_WINDOW_MS],
  );
  const row = await getOfferRow(scanId);
  if (!row) throw new Error("offer row missing after insert");
  return row;
}

/** Has this account unlocked a basic reading anywhere it is
 *  stored? Checks the account's own rows AND shared rows for scans
 *  the account holds (a guest basic purchase claimed into the
 *  account keeps its shared row, and the person rule marks both
 *  tables — either copy counts). */
export async function accountHasBasicUnlock(userId: string): Promise<boolean> {
  await ensureSchema();
  const own = await query<{ one: number }>(
    `SELECT 1 AS one FROM iris_scans WHERE user_id = $1 AND basic = true LIMIT 1`,
    [userId],
  );
  if (own.length) return true;
  const shared = await query<{ one: number }>(
    `SELECT 1 AS one FROM iris_shared_scans s
     WHERE s.basic = true AND (
       s.scan_id IN (SELECT scan_id FROM iris_scans WHERE user_id = $1)
       OR s.data->>'personId' IN (SELECT data->>'personId' FROM iris_scans WHERE user_id = $1)
     ) LIMIT 1`,
    [userId],
  );
  return shared.length > 0;
}

/** Is the shared scan (or its person) already basic? The person
 *  rule: one basic purchase covers both irises. */
export async function sharedScanIsBasic(scanId: string): Promise<boolean> {
  await ensureSchema();
  const rows = await query<{ data: { personId?: string; id?: string } }>(
    `SELECT data FROM iris_shared_scans WHERE scan_id = $1`,
    [scanId],
  );
  if (!rows.length) return false;
  const pid = rows[0].data.personId ?? rows[0].data.id ?? scanId;
  const sibs = await query<{ one: number }>(
    `SELECT 1 AS one FROM iris_shared_scans
     WHERE basic = true AND (scan_id = $1 OR data->>'personId' = $1) LIMIT 1`,
    [pid],
  );
  return sibs.length > 0;
}

export interface OfferStatus {
  /** True when the $1 price applies right now. */
  offer: boolean;
  /** The basic price that applies: $1 with the offer, else $3. */
  priceCents: number;
  /** Offer expiry (ms epoch), or null when no offer exists. */
  expiresAt: number | null;
}

/** The basic price for an ACCOUNT reading, decided server-side.
 *  $1 only when a live, unexpired, unredeemed offer row exists for
 *  the scan AND the account has never unlocked a basic reading.
 *  Everything else prices at the flat $3 basic. */
export async function accountBasicOfferStatus(
  userId: string,
  scanId: string,
  now: number = Date.now(),
): Promise<OfferStatus> {
  const row = await getOfferRow(scanId);
  if (!row || now >= row.expires_at || row.redeemed_session_id) {
    return { offer: false, priceCents: BASIC_PRICE_CENTS, expiresAt: row?.expires_at ?? null };
  }
  if (await accountHasBasicUnlock(userId)) {
    return { offer: false, priceCents: BASIC_PRICE_CENTS, expiresAt: row.expires_at };
  }
  return { offer: true, priceCents: FIRST_BASIC_OFFER_CENTS, expiresAt: row.expires_at };
}

/** The basic price for a SHARED (guest) reading, decided
 *  server-side. Guests have no account to key "once" on, so the
 *  offer is per scan: a live, unexpired, unredeemed offer row and
 *  a scan whose person is not already basic. */
export async function guestBasicOfferStatus(
  scanId: string,
  now: number = Date.now(),
): Promise<OfferStatus> {
  const row = await getOfferRow(scanId);
  if (!row || now >= row.expires_at || row.redeemed_session_id) {
    return { offer: false, priceCents: BASIC_PRICE_CENTS, expiresAt: row?.expires_at ?? null };
  }
  if (await sharedScanIsBasic(scanId)) {
    return { offer: false, priceCents: BASIC_PRICE_CENTS, expiresAt: row.expires_at };
  }
  return { offer: true, priceCents: FIRST_BASIC_OFFER_CENTS, expiresAt: row.expires_at };
}

/** Atomically claim an offer row for one Stripe session. True when
 *  this session owns the claim (first claim, or the same session
 *  re-validating); false when another session already redeemed the
 *  offer. The webhook and the buyer-return verify both claim —
 *  whichever runs first wins, the other sees its own session id. */
export async function claimOfferRedemption(
  scanId: string,
  stripeSessionId: string,
): Promise<boolean> {
  await ensureSchema();
  const rows = await query<{ scan_id: string }>(
    `UPDATE iris_first_basic_offers
     SET redeemed_session_id = $2, redeemed_at = now()
     WHERE scan_id = $1 AND (redeemed_session_id IS NULL OR redeemed_session_id = $2)
     RETURNING scan_id`,
    [scanId, stripeSessionId],
  );
  return rows.length > 0;
}

/** Fulfillment-time validation for a $1 offer session (webhook and
 *  verify share this): the offer row must exist, the charge must be
 *  exactly $1, and the redemption claim must succeed. Expiry is NOT
 *  re-checked here — checkout enforces the window, and a session
 *  created inside it settles even if payment lands just past the
 *  edge. Returns true only when the unlock may proceed. */
export async function validateOfferSession(
  scanId: string,
  stripeSessionId: string,
  amountCents: number,
): Promise<boolean> {
  if (amountCents !== FIRST_BASIC_OFFER_CENTS) return false;
  const row = await getOfferRow(scanId);
  if (!row) return false;
  return claimOfferRedemption(scanId, stripeSessionId);
}
