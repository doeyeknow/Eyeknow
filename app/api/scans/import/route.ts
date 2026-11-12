import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured, ensureSchema, query } from "@/lib/db";
import type { ScanRecord } from "@/lib/chart";

export const dynamic = "force-dynamic";

/** Bulk-import readings saved on this device into the account. */
export async function POST(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { scans?: ScanRecord[] } | null;
  const scans = Array.isArray(body?.scans) ? body!.scans : [];
  await ensureSchema();
  let imported = 0;
  for (const scan of scans.slice(0, 100)) {
    if (!scan || typeof scan.id !== "string" || typeof scan.createdAt !== "number") continue;
    await query(
      `INSERT INTO iris_scans (user_id, scan_id, created_at, data) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, scan_id) DO NOTHING`,
      [user.id, scan.id, scan.createdAt, JSON.stringify(scan)],
    );
    imported += 1;
  }
  return NextResponse.json({ ok: true, imported });
}
