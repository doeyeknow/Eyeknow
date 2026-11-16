import webpush from "web-push";
import { ensureSchema, query } from "./db";
import {
  accountHasBasicUnlock,
  createOfferForScan,
  getRevealAt,
  OFFER_DELAY_MS,
  OFFER_WINDOW_MS,
  sharedScanIsBasic,
} from "./firstBasicOffer";

// Unlock-reminder Web Push (Adam, 2026-11-05): someone scans an iris,
// leaves the reading locked, and — if they opted into notifications —
// gets at most two gentle nudges (about a day later, then about two
// days after that). Everything fails closed: without VAPID keys in
// the environment nothing is stored or sent.
//
// Keys (Adam adds them in Vercel → irisread → Environment Variables):
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY — the public key (also read by the
//     browser at build time to subscribe)
//   VAPID_PRIVATE_KEY — the private key, server only
//   VAPID_SUBJECT — optional, defaults to the studio mailbox

export function pushConfigured(): boolean {
  return Boolean(
    (process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) &&
      process.env.VAPID_PRIVATE_KEY,
  );
}

let vapidReady = false;
function client(): typeof webpush | null {
  if (!pushConfigured()) return null;
  if (!vapidReady) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:taoswoodz@gmail.com",
      process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
      process.env.VAPID_PRIVATE_KEY || "",
    );
    vapidReady = true;
  }
  return webpush;
}

export interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export function validSubscription(v: unknown): v is PushSubscriptionJSON {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  const keys = o.keys as Record<string, unknown> | undefined;
  return (
    typeof o.endpoint === "string" &&
    o.endpoint.startsWith("https://") &&
    typeof keys?.p256dh === "string" &&
    typeof keys?.auth === "string"
  );
}

/** Store (or refresh) a device subscription, and arm an unlock
 *  reminder for the given scan when one is named. Idempotent. */
export async function saveSubscription(
  sub: PushSubscriptionJSON,
  scanId: string | null,
  userId: string | null,
): Promise<void> {
  await ensureSchema();
  await query(
    `INSERT INTO iris_push_subscriptions (endpoint, p256dh, auth, user_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE
       SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
           user_id = COALESCE(EXCLUDED.user_id, iris_push_subscriptions.user_id)`,
    [sub.endpoint, sub.keys.p256dh, sub.keys.auth, userId],
  );
  if (scanId) {
    await query(
      `INSERT INTO iris_unlock_reminders (endpoint, scan_id, created_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (endpoint, scan_id) DO NOTHING`,
      [sub.endpoint, scanId, Date.now()],
    );
  }
}

/** Has this person's reading been unlocked (full or basic) anywhere
 *  it is stored? Mirrors the person rule used by getSharedScan:
 *  a scan counts as settled when it, its person root, or any scan
 *  carrying its person id is unlocked or basic, in either table.
 *  Exported: the offer-email module applies the same check. */
export async function personSettled(scanId: string): Promise<boolean> {
  const roots = await query<{ pid: string }>(
    `SELECT COALESCE(data->>'personId', scan_id) AS pid FROM iris_scans WHERE scan_id = $1
     UNION ALL
     SELECT COALESCE(data->>'personId', scan_id) AS pid FROM iris_shared_scans WHERE scan_id = $1`,
    [scanId],
  );
  if (roots.length === 0) return true; // scan is gone — nothing to remind about
  const pid = roots[0].pid;
  const rows = await query<{ settled: boolean }>(
    `SELECT (unlocked OR basic) AS settled FROM iris_scans WHERE scan_id = $1 OR data->>'personId' = $1
     UNION ALL
     SELECT (unlocked OR basic) AS settled FROM iris_shared_scans WHERE scan_id = $1 OR data->>'personId' = $1`,
    [pid],
  );
  return rows.some((r) => r.settled);
}

interface ReminderRow {
  endpoint: string;
  scan_id: string;
  stage: number;
  last_sent_at: number | null;
  created_at: number;
  p256dh: string;
  auth: string;
}

const STAGE0_AFTER_MS = 20 * 60 * 60 * 1000; // first nudge ~a day after the scan
const STAGE1_AFTER_MS = 48 * 60 * 60 * 1000; // second ~two days after the first

/** Send every due reminder once. Returns counts for the caller (the
 *  cron route) to report. Dead subscriptions (404/410 from the push
 *  service) are removed with their reminders. */
export async function runUnlockReminders(): Promise<{ sent: number; cleared: number; gone: number }> {
  const wp = client();
  if (!wp) return { sent: 0, cleared: 0, gone: 0 };
  await ensureSchema();
  const now = Date.now();
  const due = await query<ReminderRow>(
    `SELECT r.endpoint, r.scan_id, r.stage, r.last_sent_at, r.created_at, s.p256dh, s.auth
     FROM iris_unlock_reminders r
     JOIN iris_push_subscriptions s ON s.endpoint = r.endpoint
     WHERE r.stage < 2
       AND (
         (r.stage = 0 AND r.created_at < $1)
         OR (r.stage = 1 AND r.last_sent_at IS NOT NULL AND r.last_sent_at < $2)
       )
     LIMIT 200`,
    [now - STAGE0_AFTER_MS, now - STAGE1_AFTER_MS],
  );
  let sent = 0;
  let cleared = 0;
  let gone = 0;
  for (const r of due) {
    if (await personSettled(r.scan_id)) {
      await query(`DELETE FROM iris_unlock_reminders WHERE endpoint = $1 AND scan_id = $2`, [r.endpoint, r.scan_id]);
      cleared += 1;
      continue;
    }
    try {
      await wp.sendNotification(
        { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
        JSON.stringify({
          title: "Your eyeKnow reading is waiting 👁️",
          body:
            r.stage === 0
              ? "You scanned your iris but never unlocked the full report — it's saved and ready when you are."
              : "Your full iris report is still locked and waiting — unlock it any time to see every sign.",
          url: "/",
        }),
      );
      await query(
        `UPDATE iris_unlock_reminders SET stage = stage + 1, last_sent_at = $3 WHERE endpoint = $1 AND scan_id = $2`,
        [r.endpoint, r.scan_id, now],
      );
      sent += 1;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await query(`DELETE FROM iris_unlock_reminders WHERE endpoint = $1`, [r.endpoint]);
        await query(`DELETE FROM iris_push_subscriptions WHERE endpoint = $1`, [r.endpoint]);
        gone += 1;
      }
      // Any other failure: leave the row; it retries on the next run.
    }
  }
  return { sent, cleared, gone };
}

interface OfferRow {
  endpoint: string;
  scan_id: string;
  reveal_sent_at: number | null;
  offer_sent_at: number | null;
  p256dh: string;
  auth: string;
  user_id: string | null;
}

/** The scan's own creation time (ms epoch), from either store.
 *  Null when the scan is gone from both. Exported: the offer-email
 *  module and the redeem route use the same lookup. */
export async function scanCreatedAt(scanId: string): Promise<number | null> {
  const rows = await query<{ created_at: number }>(
    `SELECT created_at FROM iris_scans WHERE scan_id = $1
     UNION ALL
     SELECT created_at FROM iris_shared_scans WHERE scan_id = $1
     LIMIT 1`,
    [scanId],
  );
  // pg returns BIGINT as a string — coerce, or the delay/window
  // arithmetic below would concatenate instead of add.
  return rows.length ? Number(rows[0].created_at) : null;
}

/** Mark a reminder row's stage-1 (reveal prompt) decision: -1 =
 *  never send (moot, settled, or expired), or a timestamp = sent
 *  at. Same semantics as the offer flag, one flag per stage. */
async function markRevealDecision(endpoint: string, scanId: string, value: number): Promise<void> {
  await query(
    `UPDATE iris_unlock_reminders SET reveal_sent_at = $3 WHERE endpoint = $1 AND scan_id = $2`,
    [endpoint, scanId, value],
  );
}

/** Mark a reminder row's offer decision: -1 = never send (settled
 *  or expired scan), or a timestamp = sent at. */
async function markOfferDecision(endpoint: string, scanId: string, value: number): Promise<void> {
  await query(
    `UPDATE iris_unlock_reminders SET offer_sent_at = $3 WHERE endpoint = $1 AND scan_id = $2`,
    [endpoint, scanId, value],
  );
}

/** Close out both stage decisions as never — used when the scan is
 *  settled or past its window. COALESCE keeps a flag that already
 *  records a send; only undecided flags become -1. */
async function markBothNever(endpoint: string, scanId: string): Promise<void> {
  await query(
    `UPDATE iris_unlock_reminders
     SET reveal_sent_at = COALESCE(reveal_sent_at, -1), offer_sent_at = COALESCE(offer_sent_at, -1)
     WHERE endpoint = $1 AND scan_id = $2`,
    [endpoint, scanId],
  );
}

/** Close out the stage-1 decision as moot when it is still
 *  undecided — the reveal already happened, so the prompt that
 *  leads to it is pointless. A recorded send is left alone. */
async function closeRevealIfUndecided(endpoint: string, scanId: string): Promise<void> {
  await query(
    `UPDATE iris_unlock_reminders SET reveal_sent_at = COALESCE(reveal_sent_at, -1) WHERE endpoint = $1 AND scan_id = $2`,
    [endpoint, scanId],
  );
}

/** Is this row's account (or shared person) still eligible for a
 *  FIRST basic? An account that already holds a basic anywhere
 *  never gets the $1 notification — it would promise a price
 *  checkout cannot give. The decision is permanent: once a basic
 *  exists, eligibility never comes back. Shared by the sweep and
 *  the exit trigger so both stages gate identically. */
async function rowEligible(r: OfferRow): Promise<boolean> {
  const ineligible = r.user_id
    ? await accountHasBasicUnlock(r.user_id)
    : await sharedScanIsBasic(r.scan_id);
  return !ineligible;
}

/** One stage-1 (reveal prompt) push for one (device, scan) row: a
 *  reminder that points back to the reading. NO $1 mention
 *  anywhere and NO offer row — the offer does not exist until the
 *  person completes the reveal. Returns "sent", "gone" (dead
 *  subscription — rows removed), or "failed" (leave the row
 *  undecided so a later run retries). */
async function attemptRevealSend(
  wp: typeof webpush,
  r: OfferRow,
  now: number,
): Promise<"sent" | "gone" | "failed"> {
  try {
    await wp.sendNotification(
      { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
      JSON.stringify({
        title: "Your eyeKnow reading is ready 👁️",
        body: "Your iris reading is saved and waiting — open it to see what your eyes show.",
        url: `/?scan=${encodeURIComponent(r.scan_id)}`,
      }),
    );
    await markRevealDecision(r.endpoint, r.scan_id, now);
    return "sent";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await query(`DELETE FROM iris_unlock_reminders WHERE endpoint = $1`, [r.endpoint]);
      await query(`DELETE FROM iris_push_subscriptions WHERE endpoint = $1`, [r.endpoint]);
      return "gone";
    }
    return "failed";
  }
}

/** One stage-2 ($1 offer) notification attempt for one (device,
 *  scan) row: send the push, create the offer row, and mark the
 *  decision. Returns "sent", "gone" (dead subscription — rows
 *  removed), or "failed" (leave the row undecided so a later run
 *  retries). Shared by the hourly sweep and the exit trigger: one
 *  send path, one copy, one dedupe flag. The offer row is created
 *  ONLY here (and in the email stage-2 send) — never before the
 *  reveal, never by the stage-1 prompt. */
async function attemptOfferSend(
  wp: typeof webpush,
  r: OfferRow,
  created: number,
  now: number,
): Promise<"sent" | "gone" | "failed"> {
  try {
    await wp.sendNotification(
      { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
      JSON.stringify({
        title: "Your first basic reading is $1 👁️",
        body: "Your iris reading is still locked. Your first basic reading — your top signs in full, with the body map — is $1. The offer lasts 7 days from your scan.",
        url: `/?scan=${encodeURIComponent(r.scan_id)}`,
      }),
    );
    await createOfferForScan(r.scan_id, r.user_id, created, now);
    await markOfferDecision(r.endpoint, r.scan_id, now);
    return "sent";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await query(`DELETE FROM iris_unlock_reminders WHERE endpoint = $1`, [r.endpoint]);
      await query(`DELETE FROM iris_push_subscriptions WHERE endpoint = $1`, [r.endpoint]);
      return "gone";
    }
    return "failed";
  }
}

/** Send whichever push stage applies to one (device, scan) row,
 *  given the scan is locked, in-window, and due. Before the reveal
 *  flag: the stage-1 prompt (once — a recorded stage-1 send waits
 *  silently for the reveal). After it: the stage-1 decision closes
 *  as moot when undecided, and the $1 offer stage runs only when
 *  the account is still eligible. Returns the outcome for the
 *  caller's counts; "skipped" covers already-sent and ineligible. */
async function attemptStagePushSend(
  wp: typeof webpush,
  r: OfferRow,
  created: number,
  now: number,
  revealed: boolean,
): Promise<"reveal" | "offer" | "gone" | "failed" | "skipped"> {
  if (!revealed) {
    if (r.reveal_sent_at !== null) return "skipped";
    const outcome = await attemptRevealSend(wp, r, now);
    if (outcome === "sent") return "reveal";
    return outcome;
  }
  await closeRevealIfUndecided(r.endpoint, r.scan_id);
  if (r.offer_sent_at !== null) return "skipped";
  if (!(await rowEligible(r))) {
    await markOfferDecision(r.endpoint, r.scan_id, -1);
    return "skipped";
  }
  const outcome = await attemptOfferSend(wp, r, created, now);
  if (outcome === "sent") return "offer";
  return outcome;
}

/** Sweep backstop for the two-stage funnel (push channel): stage-1
 *  reveal prompts for locked scans with no reveal, stage-2 $1
 *  offers for revealed-but-locked scans — each once per (device,
 *  scan), starting one hour after the scan. The offer row is
 *  created only when a stage-2 notification actually goes out —
 *  the row is what checkout prices from, so no notification means
 *  no $1 price, and the stage-1 prompt never creates one. Scans
 *  older than the 7-day window never get either stage. Dead
 *  subscriptions are removed with their reminders, as above. */
export async function runFirstBasicOffers(): Promise<{
  revealSent: number;
  offerSent: number;
  skipped: number;
  gone: number;
}> {
  const wp = client();
  if (!wp) return { revealSent: 0, offerSent: 0, skipped: 0, gone: 0 };
  await ensureSchema();
  const now = Date.now();
  const due = await query<OfferRow>(
    `SELECT r.endpoint, r.scan_id, r.reveal_sent_at, r.offer_sent_at, s.p256dh, s.auth, s.user_id
     FROM iris_unlock_reminders r
     JOIN iris_push_subscriptions s ON s.endpoint = r.endpoint
     WHERE r.reveal_sent_at IS NULL OR r.offer_sent_at IS NULL
     LIMIT 200`,
    [],
  );
  let revealSent = 0;
  let offerSent = 0;
  let skipped = 0;
  let gone = 0;
  for (const r of due) {
    const created = await scanCreatedAt(r.scan_id);
    if (created === null || (await personSettled(r.scan_id))) {
      await markBothNever(r.endpoint, r.scan_id);
      skipped += 1;
      continue;
    }
    if (now < created + OFFER_DELAY_MS) continue; // not due yet; stays undecided
    if (now >= created + OFFER_WINDOW_MS) {
      await markBothNever(r.endpoint, r.scan_id);
      skipped += 1;
      continue;
    }
    const revealed = (await getRevealAt(r.scan_id)) !== null;
    const outcome = await attemptStagePushSend(wp, r, created, now, revealed);
    if (outcome === "reveal") revealSent += 1;
    else if (outcome === "offer") offerSent += 1;
    else if (outcome === "gone") gone += 1;
    else if (outcome === "skipped") skipped += 1;
    // "failed" leaves the row undecided; it retries on the next run.
  }
  return { revealSent, offerSent, skipped, gone };
}

/** Exit-triggered prompts (Adam, 2026-11-15 23:42 + 23:51): the
 *  person left the reading without unlocking and the app reported
 *  the exit. Sends promptly — no 1-hour delay — to every armed
 *  device for the scan, at whichever stage applies: the stage-1
 *  reveal prompt before the reveal flag, the $1 offer after it.
 *  Only when the reading is still locked at send time, inside the
 *  7-day window, and never sent before at that stage (the same
 *  flags the sweep uses). The sweep stays as the backstop for
 *  exits the app couldn't report (killed app, offline at exit,
 *  dropped beacon); the shared flags mean a person never gets
 *  either stage twice. The email channel runs alongside this in
 *  the exit route (lib/offerEmail.ts) — same stages, same gating,
 *  separate per-channel flags. */
export async function sendExitPushPrompts(
  scanId: string,
): Promise<{ revealSent: number; offerSent: number; skipped: number; gone: number }> {
  const wp = client();
  if (!wp) return { revealSent: 0, offerSent: 0, skipped: 0, gone: 0 };
  await ensureSchema();
  const now = Date.now();
  const rows = await query<OfferRow>(
    `SELECT r.endpoint, r.scan_id, r.reveal_sent_at, r.offer_sent_at, s.p256dh, s.auth, s.user_id
     FROM iris_unlock_reminders r
     JOIN iris_push_subscriptions s ON s.endpoint = r.endpoint
     WHERE r.scan_id = $1 AND (r.reveal_sent_at IS NULL OR r.offer_sent_at IS NULL)`,
    [scanId],
  );
  let revealSent = 0;
  let offerSent = 0;
  let skipped = 0;
  let gone = 0;
  const created = await scanCreatedAt(scanId);
  if (created === null || (await personSettled(scanId)) || now >= created + OFFER_WINDOW_MS) {
    for (const r of rows) {
      await markBothNever(r.endpoint, r.scan_id);
      skipped += 1;
    }
    return { revealSent, offerSent, skipped, gone };
  }
  const revealed = (await getRevealAt(scanId)) !== null;
  for (const r of rows) {
    const outcome = await attemptStagePushSend(wp, r, created, now, revealed);
    if (outcome === "reveal") revealSent += 1;
    else if (outcome === "offer") offerSent += 1;
    else if (outcome === "gone") gone += 1;
    else if (outcome === "skipped") skipped += 1;
  }
  return { revealSent, offerSent, skipped, gone };
}
