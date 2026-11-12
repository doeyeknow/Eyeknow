import webpush from "web-push";
import { ensureSchema, query } from "./db";

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
 *  carrying its person id is unlocked or basic, in either table. */
async function personSettled(scanId: string): Promise<boolean> {
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
