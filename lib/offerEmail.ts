// Offer email (Adam, 2026-11-15 23:45 + 23:51): the email channel
// of the two-stage $1 funnel. Email is the channel that carries the
// reveal — the signed link in the stage-1 email is what sets the
// reveal flag — and the fallback for people without notifications.
//
//  - STAGE 1: exit (or sweep) without unlocking and no reveal yet →
//    a "your reading is ready" email with the signed link. NO $1
//    mention anywhere, NO offer row.
//  - STAGE 2: exit (or sweep) after the reveal, still locked, no $3
//    basic unlock → the $1 offer email. The offer row is created at
//    THIS send, and only here or in the push stage-2 send.
//
// The stored email is used ONLY for these links — no marketing, no
// sharing (said in the capture copy). The recipient resolves to the
// captured offer email first, else the owning account's email.
// Sending rides the existing Resend setup (eyeknow.app verified);
// failures fail soft and never break the page or the push path.

import { randomBytes } from "crypto";
import { ensureSchema, hashAccessToken, query } from "./db";
import { validEmail } from "./emailGate";
import {
  accountHasBasicUnlock,
  createOfferForScan,
  getRevealAt,
  OFFER_DELAY_MS,
  OFFER_WINDOW_MS,
  sharedScanIsBasic,
} from "./firstBasicOffer";
import { personSettled, scanCreatedAt } from "./push";

export interface OfferEmailRow {
  scan_id: string;
  email: string;
  reveal_sent_at: number | null;
  email_sent_at: number | null;
  updated_at: number;
}

function coerceRow(r: OfferEmailRow): OfferEmailRow {
  return {
    ...r,
    reveal_sent_at: r.reveal_sent_at == null ? null : Number(r.reveal_sent_at),
    email_sent_at: r.email_sent_at == null ? null : Number(r.email_sent_at),
    updated_at: Number(r.updated_at),
  };
}

export async function getOfferEmailRow(scanId: string): Promise<OfferEmailRow | null> {
  await ensureSchema();
  const rows = await query<OfferEmailRow>(
    `SELECT scan_id, email, reveal_sent_at, email_sent_at, updated_at FROM iris_offer_emails WHERE scan_id = $1`,
    [scanId],
  );
  return rows[0] ? coerceRow(rows[0]) : null;
}

/** Store (or refresh) the email for a scan. Latest entry wins; the
 *  per-stage sent flags are never reset by a re-entry. */
export async function saveOfferEmail(scanId: string, email: string): Promise<void> {
  await ensureSchema();
  await query(
    `INSERT INTO iris_offer_emails (scan_id, email, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT (scan_id) DO UPDATE SET email = EXCLUDED.email, updated_at = EXCLUDED.updated_at`,
    [scanId, email.trim().toLowerCase(), Date.now()],
  );
}

/** Mark one email stage's decision: -1 = never send, or a timestamp
 *  = sent at. Same NULL/-1/timestamp semantics as the push flags,
 *  one flag per stage per channel. */
async function markEmailDecision(scanId: string, stage: "reveal" | "offer", value: number): Promise<void> {
  const column = stage === "reveal" ? "reveal_sent_at" : "email_sent_at";
  await query(`UPDATE iris_offer_emails SET ${column} = $2 WHERE scan_id = $1`, [scanId, value]);
}

/** Close out both email decisions as never (settled or expired
 *  scan). COALESCE keeps a flag that already records a send. */
async function markEmailBothNever(scanId: string): Promise<void> {
  await query(
    `UPDATE iris_offer_emails
     SET reveal_sent_at = COALESCE(reveal_sent_at, -1), email_sent_at = COALESCE(email_sent_at, -1)
     WHERE scan_id = $1`,
    [scanId],
  );
}

/** Close out a scan's email decisions when no mail can ever go to
 *  it. Creates the row (from the account email) when none exists,
 *  so the sweep stops re-selecting the scan. */
async function closeEmailRow(scanId: string, row: OfferEmailRow | null): Promise<void> {
  if (row) {
    await markEmailBothNever(scanId);
    return;
  }
  const recipient = await resolveOfferEmail(scanId);
  if (recipient) {
    await saveOfferEmail(scanId, recipient.email);
    await markEmailBothNever(scanId);
  }
}

/** The account that owns this scan, if any, with its email. */
async function scanOwner(scanId: string): Promise<{ userId: string; email: string } | null> {
  await ensureSchema();
  const rows = await query<{ user_id: string; email: string }>(
    `SELECT s.user_id, u.email FROM iris_scans s JOIN iris_users u ON u.id = s.user_id WHERE s.scan_id = $1 LIMIT 1`,
    [scanId],
  );
  return rows[0] ? { userId: rows[0].user_id, email: rows[0].email } : null;
}

/** The email an offer message goes to for this scan: the captured
 *  offer email first, else the owning account's email. Null when
 *  neither exists — no address, no email, silently. */
export async function resolveOfferEmail(
  scanId: string,
): Promise<{ email: string; userId: string | null } | null> {
  const row = await getOfferEmailRow(scanId);
  const owner = await scanOwner(scanId);
  if (row) return { email: row.email, userId: owner?.userId ?? null };
  if (owner) return { email: owner.email, userId: owner.userId };
  return null;
}

/** Mint a reveal-link token for a scan. Only its SHA-256 hash is
 *  stored (the shared-reading access-token pattern); the raw token
 *  travels only in the email link. Each send mints its own token,
 *  so an older email's link keeps working after a later send. A
 *  token is unguessable (32 random bytes) and expires with the
 *  scan's 7-day window, enforced when the link is used. */
export async function mintOfferLinkToken(scanId: string): Promise<string> {
  await ensureSchema();
  const token = randomBytes(32).toString("hex");
  await query(
    `INSERT INTO iris_offer_link_tokens (token_hash, scan_id, created_at) VALUES ($1, $2, $3)`,
    [hashAccessToken(token), scanId, Date.now()],
  );
  return token;
}

/** The scan a reveal-link token belongs to, or null when the token
 *  is unknown. Says nothing about the window — callers check that
 *  against the scan's own creation time. */
export async function scanIdForOfferLinkToken(token: string): Promise<string | null> {
  if (!token) return null;
  await ensureSchema();
  const rows = await query<{ scan_id: string }>(
    `SELECT scan_id FROM iris_offer_link_tokens WHERE token_hash = $1`,
    [hashAccessToken(token)],
  );
  return rows[0]?.scan_id ?? null;
}

/** Is offer email configured? The existing Resend setup (the same
 *  key that sends gift emails). Unconfigured → every email send
 *  fails soft, exactly like unconfigured push. */
export function offerEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Sender for offer mail: offers@eyeknow.app, mirroring the
 *  gifts@eyeknow.app sender for gift mail (the domain is verified
 *  in Resend). Overridable via OFFER_FROM_EMAIL, like
 *  GIFT_FROM_EMAIL. */
function offerFrom(): string {
  return process.env.OFFER_FROM_EMAIL ?? "eyeKnow <offers@eyeknow.app>";
}

/** POST one email through Resend. Never throws: any failure —
 *  missing key, network error, non-2xx — returns false and the
 *  caller leaves the send undecided for a later retry. RESEND_API_URL
 *  overrides the endpoint for tests (the dev server points it at a
 *  local stub); production uses the default. */
async function sendViaResend(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const url = process.env.RESEND_API_URL ?? "https://api.resend.com/emails";
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: offerFrom(), to: [to], subject, html, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Canonical site origin for email links — the same constant the
 *  layout's metadataBase and the share route use. */
const OFFER_SITE_ORIGIN = "https://eyeknow.app";

export function offerLinkForToken(token: string): string {
  // Neutral path: the same link carries both stages, and the
  // stage-1 email must not hint at an offer — so the URL says
  // "reading", never "offer" or a price.
  return `${OFFER_SITE_ORIGIN}/reading/${encodeURIComponent(token)}`;
}

function formatExpiryDate(expiresAt: number): string {
  return new Date(expiresAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Shared email shell, mirroring the gift email's wrapper (Georgia
 *  serif, dark-green header, traditional-reading footer). */
function emailShell(heading: string, body: string): string {
  return `
  <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #21312c;">
    <div style="background: #0d3b37; color: #f3ead8; padding: 22px 26px; border-radius: 14px 14px 0 0;">
      <div style="font-size: 22px; font-weight: bold;">eye<span style="color: #d9a441;">Know</span></div>
      <div style="opacity: 0.85; font-size: 13px;">Traditional iridology readings</div>
    </div>
    <div style="border: 1px solid #e4dcc8; border-top: none; border-radius: 0 0 14px 14px; padding: 24px 26px; background: #fbf8f1;">
      <h1 style="font-size: 21px; margin: 0 0 10px;">${heading}</h1>
      ${body}
      <p style="font-size: 12px; color: #7a7261; line-height: 1.5; margin: 14px 0 0;">
        eyeKnow readings are a traditional practice presented for interest and self-reflection — not medical advice, and never a diagnosis.
      </p>
    </div>
  </div>`;
}

/** Stage-1 reveal email. Deliberately price-free: NO $1 mention, NO
 *  offer — the offer does not exist until the reveal completes.
 *  Pure, so tests can assert the copy rule. */
export function stage1Email(link: string, expiresAt: number): { subject: string; html: string; text: string } {
  const date = formatExpiryDate(expiresAt);
  const html = emailShell(
    "👁️ Your iris reading is ready",
    `
      <p style="line-height: 1.55; margin: 0 0 12px;">
        You scanned your iris but didn't open the full reading. It's saved and waiting —
        use the link below to open it. You'll set a password (or sign in) so your reading
        stays saved in your account on any device.
      </p>
      <p style="margin: 18px 0;">
        <a href="${link}" style="background: #0d3b37; color: #f3ead8; text-decoration: none; padding: 13px 22px; border-radius: 999px; font-weight: bold; display: inline-block;">Open my reading →</a>
      </p>
      <p style="line-height: 1.55; font-size: 14px; margin: 0 0 6px;">
        This link works until ${date} — 7 days from your scan. Your email is only used
        to send you this link.
      </p>`,
  );
  return {
    subject: "Your iris reading is ready",
    html,
    text: `You scanned your iris but didn't open the full reading. It's saved and waiting — open it here: ${link} — you'll set a password (or sign in) so your reading stays saved in your account on any device. This link works until ${date} (7 days from your scan). Your email is only used to send you this link. Traditional iridology reading for interest and self-reflection — not medical advice, never a diagnosis.`,
  };
}

/** Stage-2 $1 offer email. Sent ONLY after the reveal flag is set
 *  and the reading is still locked. Names the $1 price, the 7-day
 *  window, and the traditional-reading framing plainly. */
export function stage2Email(link: string, expiresAt: number): { subject: string; html: string; text: string } {
  const date = formatExpiryDate(expiresAt);
  const html = emailShell(
    "Your first basic reading is $1 👁️",
    `
      <p style="line-height: 1.55; margin: 0 0 12px;">
        Your iris reading is still locked. Your first basic reading — your top signs in
        full, with the body map — is $1. The offer lasts 7 days from your scan, until ${date}.
      </p>
      <p style="margin: 18px 0;">
        <a href="${link}" style="background: #0d3b37; color: #f3ead8; text-decoration: none; padding: 13px 22px; border-radius: 999px; font-weight: bold; display: inline-block;">Open my reading — $1 basic →</a>
      </p>
      <p style="line-height: 1.55; font-size: 14px; margin: 0 0 6px;">
        One-time payment. Your email is only used to send you this link.
      </p>`,
  );
  return {
    subject: "Your first basic reading is $1",
    html,
    text: `Your iris reading is still locked. Your first basic reading — your top signs in full, with the body map — is $1. The offer lasts 7 days from your scan, until ${date}. Open your reading: ${link} — one-time payment. Your email is only used to send you this link. Traditional iridology reading for interest and self-reflection — not medical advice, never a diagnosis.`,
  };
}

/** One email attempt for one scan at one stage. Mints a fresh
 *  reveal-link token, sends, and — for stage 2 only — creates the
 *  offer row (idempotent; the push stage-2 send may have created
 *  it first) before marking the stage sent. A failed send marks
 *  nothing, so a later run retries; the offer row is never created
 *  by a send that didn't go out. */
async function attemptEmailSend(
  scanId: string,
  stage: "reveal" | "offer",
  created: number,
  now: number,
  recipient: { email: string; userId: string | null },
): Promise<"sent" | "failed"> {
  const token = await mintOfferLinkToken(scanId);
  const link = offerLinkForToken(token);
  const expiresAt = created + OFFER_WINDOW_MS;
  const mail = stage === "reveal" ? stage1Email(link, expiresAt) : stage2Email(link, expiresAt);
  const ok = await sendViaResend(recipient.email, mail.subject, mail.html, mail.text);
  if (!ok) return "failed";
  if (stage === "offer") {
    await createOfferForScan(scanId, recipient.userId, created, now);
  }
  // Ensure the row exists (account-email sends have none yet), then
  // mark the stage. saveOfferEmail never resets sent flags.
  await saveOfferEmail(scanId, recipient.email);
  await markEmailDecision(scanId, stage, now);
  return "sent";
}

/** Send whichever email stage applies to one scan, given the scan
 *  is locked, in-window, and due. Mirrors the push stage decision
 *  exactly: stage 1 before the reveal flag, stage 2 after it (with
 *  the same eligibility check), each at most once per scan. */
async function attemptStageEmailSend(
  scanId: string,
  created: number,
  now: number,
  revealed: boolean,
  row: OfferEmailRow | null,
  recipient: { email: string; userId: string | null } | null,
): Promise<"reveal" | "offer" | "failed" | "skipped"> {
  if (!recipient) return "skipped"; // no email on file anywhere
  if (!revealed) {
    if (row?.reveal_sent_at != null) return "skipped";
    return (await attemptEmailSend(scanId, "reveal", created, now, recipient)) === "sent" ? "reveal" : "failed";
  }
  if (row && row.reveal_sent_at == null) {
    await markEmailDecision(scanId, "reveal", -1); // moot once revealed
  }
  if (row?.email_sent_at != null) return "skipped";
  const ineligible = recipient.userId
    ? await accountHasBasicUnlock(recipient.userId)
    : await sharedScanIsBasic(scanId);
  if (ineligible) {
    await saveOfferEmail(scanId, recipient.email);
    await markEmailDecision(scanId, "offer", -1);
    return "skipped";
  }
  return (await attemptEmailSend(scanId, "offer", created, now, recipient)) === "sent" ? "offer" : "failed";
}

export interface EmailSendCounts {
  revealSent: number;
  offerSent: number;
  skipped: number;
  failed: number;
}

const zeroCounts = (): EmailSendCounts => ({ revealSent: 0, offerSent: 0, skipped: 0, failed: 0 });

/** Exit-triggered offer email (both stages): the person left the
 *  reading without unlocking. Sends promptly — no 1-hour delay.
 *  An email attached by the exit beacon (the first-scan gate's
 *  address, stored on the device) is saved first, so the exit
 *  send can use it. The push channel runs alongside this in the
 *  exit route — same stages, same gating, separate flags. */
export async function sendExitEmails(scanId: string, attachedEmail?: string): Promise<EmailSendCounts> {
  const counts = zeroCounts();
  if (!offerEmailConfigured()) return counts;
  await ensureSchema();
  if (attachedEmail && validEmail(attachedEmail)) {
    await saveOfferEmail(scanId, attachedEmail);
  }
  const now = Date.now();
  const created = await scanCreatedAt(scanId);
  const row = await getOfferEmailRow(scanId);
  if (created === null || (await personSettled(scanId)) || now >= created + OFFER_WINDOW_MS) {
    await closeEmailRow(scanId, row);
    counts.skipped += 1;
    return counts;
  }
  const revealed = (await getRevealAt(scanId)) !== null;
  const recipient = await resolveOfferEmail(scanId);
  const outcome = await attemptStageEmailSend(scanId, created, now, revealed, row, recipient);
  if (outcome === "reveal") counts.revealSent += 1;
  else if (outcome === "offer") counts.offerSent += 1;
  else if (outcome === "failed") counts.failed += 1;
  else counts.skipped += 1;
  return counts;
}

/** Sweep backstop for offer email (both stages): stage-1 reveal
 *  emails for locked scans with no reveal, stage-2 $1 offer emails
 *  for revealed-but-locked scans — each at most once per scan,
 *  starting one hour after the scan. Covers captured-email rows
 *  with a stage undecided AND account scans with no captured row
 *  (their account email is on file). Same gating and dedupe as the
 *  exit trigger; the same 7-day window from the scan. */
export async function runOfferEmails(): Promise<EmailSendCounts> {
  const counts = zeroCounts();
  if (!offerEmailConfigured()) return counts;
  await ensureSchema();
  const now = Date.now();
  const emailed = await query<{ scan_id: string }>(
    `SELECT scan_id FROM iris_offer_emails WHERE reveal_sent_at IS NULL OR email_sent_at IS NULL LIMIT 200`,
    [],
  );
  const owned = await query<{ scan_id: string }>(
    `SELECT s.scan_id FROM iris_scans s LEFT JOIN iris_offer_emails e ON e.scan_id = s.scan_id
     WHERE e.scan_id IS NULL AND s.created_at > $1 LIMIT 200`,
    [now - OFFER_WINDOW_MS],
  );
  const scanIds = [...new Set([...emailed.map((r) => r.scan_id), ...owned.map((r) => r.scan_id)])];
  for (const scanId of scanIds) {
    const created = await scanCreatedAt(scanId);
    const row = await getOfferEmailRow(scanId);
    if (created === null || (await personSettled(scanId))) {
      await closeEmailRow(scanId, row);
      counts.skipped += 1;
      continue;
    }
    if (now < created + OFFER_DELAY_MS) continue; // not due yet; stays undecided
    if (now >= created + OFFER_WINDOW_MS) {
      await closeEmailRow(scanId, row);
      counts.skipped += 1;
      continue;
    }
    const revealed = (await getRevealAt(scanId)) !== null;
    const recipient = await resolveOfferEmail(scanId);
    const outcome = await attemptStageEmailSend(scanId, created, now, revealed, row, recipient);
    if (outcome === "reveal") counts.revealSent += 1;
    else if (outcome === "offer") counts.offerSent += 1;
    else if (outcome === "failed") counts.failed += 1;
    else counts.skipped += 1;
  }
  return counts;
}
