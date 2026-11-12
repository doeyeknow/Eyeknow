import { ensureSchema, hashAccessToken, query } from "./db";
import type { ScanRecord } from "./chart";

/** Server-side helpers for shared readings (QR-link access). */

export async function registerSharedScan(scan: ScanRecord, accessToken: string): Promise<void> {
  await ensureSchema();
  await query(
    `INSERT INTO iris_shared_scans (scan_id, access_token_hash, created_at, data)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (scan_id) DO UPDATE SET data = EXCLUDED.data, created_at = EXCLUDED.created_at`,
    [scan.id, hashAccessToken(accessToken), scan.createdAt, JSON.stringify(scan)],
  );
}

export async function getSharedScan(
  scanId: string,
  accessToken: string,
): Promise<ScanRecord | null> {
  if (!scanId || !accessToken) return null;
  await ensureSchema();
  const rows = await query<{ data: ScanRecord; unlocked: boolean; basic: boolean; access_token_hash: string }>(
    `SELECT data, unlocked, basic, access_token_hash FROM iris_shared_scans WHERE scan_id = $1`,
    [scanId],
  );
  if (rows.length === 0) return null;
  if (rows[0].access_token_hash !== hashAccessToken(accessToken)) return null;
  let unlocked = rows[0].unlocked;
  // Person rule (Adam, 2026-11-01): one full unlock covers the
  // whole person — if any shared scan of the same person is
  // unlocked, this one is too. Group members match by carrying
  // the person's id, or by BEING the person's root scan.
  if (!unlocked) {
    const pid = rows[0].data.personId ?? rows[0].data.id;
    const sibs = await query<{ unlocked: boolean }>(
      `SELECT unlocked FROM iris_shared_scans
       WHERE scan_id = $1 OR data->>'personId' = $1`,
      [pid],
    );
    unlocked = sibs.some((r) => r.unlocked);
  }
  // Basic tier (Adam, 2026-11-05): the same person rule — one
  // basic purchase covers both irises.
  let basic = rows[0].basic;
  if (!basic) {
    const pid = rows[0].data.personId ?? rows[0].data.id;
    const sibs = await query<{ basic: boolean }>(
      `SELECT basic FROM iris_shared_scans
       WHERE scan_id = $1 OR data->>'personId' = $1`,
      [pid],
    );
    basic = sibs.some((r) => r.basic);
  }
  return { ...rows[0].data, unlocked, basic };
}

/** Flip every stored copy of a PERSON unlocked (both tables):
 *  the scan itself, the person's root scan, and every scan that
 *  carries the person's id — one unlock covers both irises. */
export async function unlockPersonForScan(scanId: string): Promise<void> {
  await ensureSchema();
  const rows = await query<{ data: ScanRecord }>(
    `SELECT data FROM iris_shared_scans WHERE scan_id = $1
     UNION ALL SELECT data FROM iris_scans WHERE scan_id = $1 LIMIT 1`,
    [scanId],
  );
  const pid = rows.length > 0 ? (rows[0].data.personId ?? rows[0].data.id) : scanId;
  await query(
    `UPDATE iris_shared_scans SET unlocked = true, unlocked_at = now()
     WHERE scan_id = $1 OR data->>'personId' = $1`,
    [pid],
  );
  await query(
    `UPDATE iris_scans SET unlocked = true, unlocked_at = now()
     WHERE scan_id = $1 OR data->>'personId' = $1`,
    [pid],
  );
}

/** Mark a reading unlocked in the shared store AND in any account
 *  that holds a copy of the same reading (one purchase unlocks the
 *  reading wherever it lives) — and, per the person rule, every
 *  other scan of the same person (both irises) with it. */
/** Mark a PERSON basic (both tables, both irises) after a paid
 *  $3 basic purchase — the basic counterpart of unlockPersonForScan.
 *  Never touches the unlocked columns. */
export async function markScanBasic(scanId: string): Promise<void> {
  await ensureSchema();
  const rows = await query<{ data: ScanRecord }>(
    `SELECT data FROM iris_shared_scans WHERE scan_id = $1
     UNION ALL SELECT data FROM iris_scans WHERE scan_id = $1 LIMIT 1`,
    [scanId],
  );
  const pid = rows.length > 0 ? (rows[0].data.personId ?? rows[0].data.id) : scanId;
  await query(
    `UPDATE iris_shared_scans SET basic = true
     WHERE scan_id = $1 OR data->>'personId' = $1`,
    [pid],
  );
  await query(
    `UPDATE iris_scans SET basic = true
     WHERE scan_id = $1 OR data->>'personId' = $1`,
    [pid],
  );
}

export async function unlockSharedScan(scanId: string): Promise<void> {
  await ensureSchema();
  await query(
    `UPDATE iris_shared_scans SET unlocked = true, unlocked_at = now() WHERE scan_id = $1`,
    [scanId],
  );
  await query(
    `UPDATE iris_scans SET unlocked = true, unlocked_at = now() WHERE scan_id = $1`,
    [scanId],
  );
  await unlockPersonForScan(scanId);
}
