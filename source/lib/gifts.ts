import { randomUUID } from "crypto";
import { ensureSchema, hashAccessToken, query } from "./db";
import { unlockSharedScan } from "./shared";

/** Gift readings: bought in advance, delivered by email as a link.
 *  The token in the link is the credential (same trust model as the
 *  shared-reading links). One gift unlocks exactly one reading. */

export interface GiftRow {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  from_name: string | null;
  message: string | null;
  status: "pending_payment" | "paid" | "redeemed";
  scan_id: string | null;
  email_sent: boolean;
}

export async function createGift(input: {
  recipientEmail: string;
  recipientName?: string;
  fromName?: string;
  message?: string;
}): Promise<{ id: string; token: string }> {
  await ensureSchema();
  const id = randomUUID();
  const token = randomUUID() + randomUUID();
  await query(
    `INSERT INTO iris_gifts (id, token_hash, recipient_email, recipient_name, from_name, message)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      hashAccessToken(token),
      input.recipientEmail,
      input.recipientName || null,
      input.fromName || null,
      input.message || null,
    ],
  );
  return { id, token };
}

export async function setGiftSession(id: string, sessionId: string): Promise<void> {
  await query(`UPDATE iris_gifts SET stripe_session_id = $2 WHERE id = $1`, [id, sessionId]);
}

export async function getGiftById(id: string): Promise<GiftRow | null> {
  await ensureSchema();
  const rows = await query<GiftRow>(
    `SELECT id, recipient_email, recipient_name, from_name, message, status, scan_id, email_sent
     FROM iris_gifts WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function getGiftByToken(token: string): Promise<GiftRow | null> {
  if (!token) return null;
  await ensureSchema();
  const rows = await query<GiftRow>(
    `SELECT id, recipient_email, recipient_name, from_name, message, status, scan_id, email_sent
     FROM iris_gifts WHERE token_hash = $1`,
    [hashAccessToken(token)],
  );
  return rows[0] ?? null;
}

/** Flip pending_payment → paid. Returns the gift ONLY when this call
 *  made the transition (so the email is sent exactly once). */
export async function markGiftPaid(giftId: string, sessionId: string): Promise<GiftRow | null> {
  await ensureSchema();
  const rows = await query<GiftRow>(
    `UPDATE iris_gifts
     SET status = 'paid', paid_at = now(), stripe_session_id = COALESCE(stripe_session_id, $2)
     WHERE id = $1 AND status = 'pending_payment'
     RETURNING id, recipient_email, recipient_name, from_name, message, status, scan_id, email_sent`,
    [giftId, sessionId],
  );
  return rows[0] ?? null;
}

export function giftUrl(origin: string, token: string): string {
  return `${origin}/?gift=${encodeURIComponent(token)}`;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Email the recipient their gift link via Resend. Returns false
 *  (without throwing) when email isn't configured or sending fails —
 *  the gift itself is never lost; the buyer also gets the link. */
export async function sendGiftEmail(gift: GiftRow, url: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.GIFT_FROM_EMAIL ?? "eyeKnow <gifts@eyeknow.app>";
  const fromName = gift.from_name || "Someone";
  const firstName = gift.recipient_name ? ` ${esc(gift.recipient_name)}` : "";
  const html = `
  <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #21312c;">
    <div style="background: #0d3b37; color: #f3ead8; padding: 22px 26px; border-radius: 14px 14px 0 0;">
      <div style="font-size: 22px; font-weight: bold;">eye<span style="color: #d9a441;">Know</span></div>
      <div style="opacity: 0.85; font-size: 13px;">Traditional iridology readings</div>
    </div>
    <div style="border: 1px solid #e4dcc8; border-top: none; border-radius: 0 0 14px 14px; padding: 24px 26px; background: #fbf8f1;">
      <h1 style="font-size: 21px; margin: 0 0 10px;">🎁 You've received a gift reading${firstName}</h1>
      <p style="line-height: 1.55; margin: 0 0 12px;">
        ${esc(fromName)} bought you a full eyeKnow reading — the complete traditional
        iridology report, normally $19.99, already paid for.
      </p>
      ${gift.message ? `<p style="line-height: 1.55; margin: 0 0 12px; padding: 12px 14px; background: #f1ead6; border-radius: 10px;"><i>"${esc(gift.message)}"</i><br/>— ${esc(fromName)}</p>` : ""}
      <p style="margin: 18px 0;">
        <a href="${url}" style="background: #0d3b37; color: #f3ead8; text-decoration: none; padding: 13px 22px; border-radius: 999px; font-weight: bold; display: inline-block;">Open my gift reading →</a>
      </p>
      <p style="line-height: 1.55; font-size: 14px; margin: 0 0 6px;">
        Take a close-up photo of your eye right in the app — your report unlocks in full
        automatically. No account and no payment needed. One gift covers one reading, and it doesn't expire.
      </p>
      <p style="font-size: 12px; color: #7a7261; line-height: 1.5; margin: 14px 0 0;">
        eyeKnow readings are a traditional practice presented for interest and self-reflection — not medical advice.
      </p>
    </div>
  </div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [gift.recipient_email],
        subject: `🎁 ${fromName} gifted you an eyeKnow reading`,
        html,
        text: `${fromName} bought you a full eyeKnow reading (normally $19.99, already paid). Open your gift: ${url} — take your eye photo in the app and the complete report unlocks free. No account needed. Traditional iridology reading for interest and self-reflection — not medical advice.`,
      }),
    });
    if (!res.ok) return false;
    await query(`UPDATE iris_gifts SET email_sent = true WHERE id = $1`, [gift.id]);
    return true;
  } catch {
    return false;
  }
}

/** Transition after a verified gift payment: flip to paid and send
 *  the recipient email exactly once. Used by verify + webhook. */
export async function settleGiftPayment(
  giftId: string,
  sessionId: string,
  origin: string,
  token: string | null,
): Promise<GiftRow | null> {
  const gift = await markGiftPaid(giftId, sessionId);
  if (!gift) return null;
  if (token) {
    await sendGiftEmail(gift, giftUrl(origin, token));
  }
  return gift;
}

export type RedeemResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/** Redeem a paid gift against a reading: mark it used and unlock
 *  that reading everywhere it lives. */
export async function redeemGift(token: string, scanId: string): Promise<RedeemResult> {
  const gift = await getGiftByToken(token);
  if (!gift) return { ok: false, status: 404, error: "gift not found" };
  if (gift.status === "redeemed") {
    return gift.scan_id === scanId
      ? { ok: true }
      : { ok: false, status: 409, error: "this gift was already used" };
  }
  if (gift.status !== "paid") {
    return { ok: false, status: 409, error: "this gift hasn't been paid for yet" };
  }
  const rows = await query<{ id: string }>(
    `UPDATE iris_gifts SET status = 'redeemed', redeemed_at = now(), scan_id = $2
     WHERE id = $1 AND status = 'paid' RETURNING id`,
    [gift.id, scanId],
  );
  if (rows.length === 0) return { ok: false, status: 409, error: "this gift was already used" };
  await unlockSharedScan(scanId);
  return { ok: true };
}

/** If a gift was already redeemed against this reading, make sure
 *  the unlock is applied (covers redeem-before-registration order). */
export async function applyGiftUnlockIfAny(scanId: string): Promise<void> {
  const rows = await query<{ id: string }>(
    `SELECT id FROM iris_gifts WHERE scan_id = $1 AND status = 'redeemed' LIMIT 1`,
    [scanId],
  );
  if (rows.length > 0) await unlockSharedScan(scanId);
}
