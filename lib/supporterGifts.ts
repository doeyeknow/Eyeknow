import { randomUUID, createHash, createHmac } from "crypto";
import { ensureSchema, hashAccessToken, query } from "./db";
import { getSharedScan } from "./shared";

/** Early supporters: a full-price reading purchase includes 10 shareable
 *  readings for friends and family. Each is a single-use link; a
 *  recipient scans their eye and gets a FREE BASIC reading — the
 *  locked-preview experience (top 5 signs in writing, all detected
 *  points plotted on the iris photo) — plus 10% off unlocking the
 *  full reading. The link never unlocks a reading in full.
 *
 *  Granting is server-side only, from the Stripe webhook on a paid
 *  session. The count is fixed here (never accepted from the
 *  client), and stripe_session_id is the idempotency key: the grant
 *  INSERT is one statement guarded by UNIQUE (stripe_session_id,
 *  grant_slot), so a redelivered webhook grants zero more. These
 *  are free grants, not purchases — they never send purchase emails.
 *
 *  Tokens are derived deterministically from the grant id
 *  (HMAC with SESSION_SECRET when set, plain SHA-256 otherwise),
 *  so the buyer's account area can rebuild their 10 share links
 *  any time without tokens ever being stored in plain text; only
 *  the hash is stored, exactly like paid-gift tokens. */

export const EARLY_SUPPORTER_GIFT_COUNT = 10;

/** The unlock discount a redeemed supporter link grants, in
 *  percent. Server-side only: checkout applies it, the webhook
 *  validates it, and the client never supplies it. */
export const GIFT_UNLOCK_DISCOUNT_PCT = 10;

/** The unlock discount on one reading, in percent (0 when the
 *  reading carries no redeemed supporter link). */
export async function getScanDiscountPct(scanId: string): Promise<number> {
  if (!scanId) return 0;
  await ensureSchema();
  const rows = await query<{ discount_pct: number }>(
    `SELECT discount_pct FROM iris_scan_discounts WHERE scan_id = $1`,
    [scanId],
  );
  return rows.length ? rows[0].discount_pct : 0;
}

export function supporterGiftToken(grantId: string): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) {
    return createHmac("sha256", secret).update(`supporter:${grantId}`).digest("hex");
  }
  return createHash("sha256").update(`supporter:${grantId}`).digest("hex");
}

export function supporterGiftUrl(origin: string, token: string): string {
  return `${origin}/?supporter=${encodeURIComponent(token)}`;
}

export interface SupporterGiftRow {
  id: string;
  grant_slot: number;
  scan_id: string;
  stripe_session_id: string;
  status: "granted" | "redeemed";
  redeemed_scan_id: string | null;
  created_at: string;
}

/** Grant the 10 shareable basic readings for one paid full-reading session. Returns
 *  how many rows this call created (0 when the session already
 *  granted — replay-safe). Only the webhook calls this. */
export async function grantSupporterGifts(
  ownerUserId: string | null,
  scanId: string,
  stripeSessionId: string,
): Promise<{ granted: number }> {
  await ensureSchema();
  const params: unknown[] = [];
  const values: string[] = [];
  for (let slot = 0; slot < EARLY_SUPPORTER_GIFT_COUNT; slot++) {
    const id = randomUUID();
    const base = params.length;
    params.push(
      stripeSessionId,
      id,
      hashAccessToken(supporterGiftToken(id)),
      ownerUserId,
      scanId,
      slot,
    );
    values.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`,
    );
  }
  const rows = await query<{ id: string }>(
    `INSERT INTO iris_supporter_gifts (stripe_session_id, id, token_hash, owner_user_id, scan_id, grant_slot)
     VALUES ${values.join(", ")}
     ON CONFLICT (stripe_session_id, grant_slot) DO NOTHING RETURNING id`,
    params,
  );
  return { granted: rows.length };
}

export async function listSupporterGiftsForUser(userId: string): Promise<SupporterGiftRow[]> {
  await ensureSchema();
  return query<SupporterGiftRow>(
    `SELECT id, grant_slot, scan_id, stripe_session_id, status, redeemed_scan_id, created_at
     FROM iris_supporter_gifts WHERE owner_user_id = $1 ORDER BY created_at ASC, grant_slot ASC`,
    [userId],
  );
}

/** Grants for one purchased reading, gated on the shared-reading
 *  credential (the same trust model as the reading itself). Returns
 *  null when the credential does not match. */
export async function listSupporterGiftsForScan(
  scanId: string,
  accessToken: string,
): Promise<SupporterGiftRow[] | null> {
  const shared = await getSharedScan(scanId, accessToken);
  if (!shared) return null;
  await ensureSchema();
  return query<SupporterGiftRow>(
    `SELECT id, grant_slot, scan_id, stripe_session_id, status, redeemed_scan_id, created_at
     FROM iris_supporter_gifts WHERE scan_id = $1 ORDER BY created_at ASC, grant_slot ASC`,
    [scanId],
  );
}

export async function getSupporterGiftByToken(token: string): Promise<SupporterGiftRow | null> {
  if (!token) return null;
  await ensureSchema();
  const rows = await query<SupporterGiftRow>(
    `SELECT id, grant_slot, scan_id, stripe_session_id, status, redeemed_scan_id, created_at
     FROM iris_supporter_gifts WHERE token_hash = $1`,
    [hashAccessToken(token)],
  );
  return rows[0] ?? null;
}

export type SupporterRedeemResult =
  | { ok: true; basic: true; discountPct: number }
  | { ok: false; status: number; error: string };

/** Redeem one supporter link against a reading: mark it used and
 *  record the 10% unlock discount on that reading. The reading
 *  stays LOCKED at the basic preview level — the link never flips
 *  it to unlocked. Same-scan re-redeems are fine; a different scan
 *  gets the 409, exactly as before. */
export async function redeemSupporterGift(token: string, scanId: string): Promise<SupporterRedeemResult> {
  const gift = await getSupporterGiftByToken(token);
  if (!gift) return { ok: false, status: 404, error: "gift not found" };
  if (gift.status === "redeemed") {
    return gift.redeemed_scan_id === scanId
      ? { ok: true, basic: true, discountPct: GIFT_UNLOCK_DISCOUNT_PCT }
      : { ok: false, status: 409, error: "this free reading was already used" };
  }
  const rows = await query<{ id: string }>(
    `UPDATE iris_supporter_gifts SET status = 'redeemed', redeemed_at = now(), redeemed_scan_id = $2
     WHERE id = $1 AND status = 'granted' RETURNING id`,
    [gift.id, scanId],
  );
  if (rows.length === 0) return { ok: false, status: 409, error: "this free reading was already used" };
  await ensureSchema();
  await query(
    `INSERT INTO iris_scan_discounts (scan_id, discount_pct, gift_id)
     VALUES ($1, $2, $3) ON CONFLICT (scan_id) DO NOTHING`,
    [scanId, GIFT_UNLOCK_DISCOUNT_PCT, gift.id],
  );
  return { ok: true, basic: true, discountPct: GIFT_UNLOCK_DISCOUNT_PCT };
}
