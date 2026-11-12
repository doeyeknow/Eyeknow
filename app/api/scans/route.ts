import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured, ensureSchema, query } from "@/lib/db";
import type { ScanRecord } from "@/lib/chart";
import { tryIncludeScan } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";
const MAX_SCANS = 100;

export async function GET(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  await ensureSchema();
  const rows = await query<{ data: ScanRecord; unlocked: boolean; basic: boolean }>(
    `SELECT data, unlocked, basic FROM iris_scans WHERE user_id = $1 ORDER BY created_at DESC`,
    [user.id],
  );
  // Person rule (Adam, 2026-11-01): one full unlock covers the
  // whole person — both irises. The flag still comes only from
  // the server column, never from the stored payload; it is
  // propagated here, within the owner's scans, from any unlocked
  // scan of the same person to all of them.
  const scans = rows.map((r) => ({ ...r.data, unlocked: r.unlocked, basic: r.basic }));
  const unlockedPersons = new Set(
    scans
      .filter((s) => s.unlocked)
      .map((s) => s.personId ?? s.id),
  );
  for (const s of scans) {
    if (!s.unlocked && unlockedPersons.has(s.personId ?? s.id)) s.unlocked = true;
  }
  const basicPersons = new Set(
    scans
      .filter((s) => s.basic)
      .map((s) => s.personId ?? s.id),
  );
  for (const s of scans) {
    if (!s.basic && basicPersons.has(s.personId ?? s.id)) s.basic = true;
  }
  return NextResponse.json({ scans });
}

export async function POST(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const scan = (await req.json().catch(() => null)) as ScanRecord | null;
  if (!scan || typeof scan.id !== "string" || typeof scan.createdAt !== "number" || !Array.isArray(scan.markers)) {
    return NextResponse.json({ error: "invalid scan" }, { status: 400 });
  }
  await ensureSchema();
  await query(
    `INSERT INTO iris_scans (user_id, scan_id, created_at, data) VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, scan_id) DO UPDATE SET data = EXCLUDED.data, created_at = EXCLUDED.created_at`,
    [user.id, scan.id, scan.createdAt, JSON.stringify(scan)],
  );
  // Timeline subscribers: a saved scan of an iris may be covered by
  // the weekly included allowance (at most one per iris per rolling
  // 7 days, 48 per iris per subscription-year) — when covered, the
  // scan row flips to unlocked in full, no charge. The attempt is
  // isolated: a failure here must never break the save above, and
  // non-subscribers see no change at all.
  let subscriptionIncluded = false;
  try {
    const included = await tryIncludeScan(user.id, scan.id, scan.eye);
    subscriptionIncluded = included.included;
  } catch (e) {
    console.error("subscription include failed", e);
  }
  // Keep the newest MAX_SCANS per user.
  await query(
    `DELETE FROM iris_scans WHERE user_id = $1 AND scan_id NOT IN (
       SELECT scan_id FROM iris_scans WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2
     )`,
    [user.id, MAX_SCANS],
  );
  return NextResponse.json({ ok: true, subscriptionIncluded }, { status: 201 });
}
