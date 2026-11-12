import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured, ensureSchema, query } from "@/lib/db";
import { unlockPersonForScan } from "@/lib/shared";

export const dynamic = "force-dynamic";

/** Free-unlock coupon codes (Adam, 2026-11-12). The client never
 * decides on its own: the server re-checks the code, the reader,
 * the account, and the person before unlocking. Case-insensitive,
 * whitespace-trimmed. */
const COUPON_CODES = new Set(["jewlz"]);

/** Validate a coupon code and, when it grants a free full unlock,
 * unlock the reader's whole person (both irises) server-side. */
export async function POST(req: NextRequest) {
  if (!dbConfigured()) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | { scanId?: string; code?: string }
    | null;
  const scanId = (body?.scanId ?? "").trim();
  const code = (body?.code ?? "").trim().toLowerCase();
  if (!scanId) {
    return NextResponse.json({ error: "reading not found" }, { status: 404 });
  }
  if (!COUPON_CODES.has(code)) {
    // Same message whether the code is unknown or mistyped — no
    // hint about which codes exist.
    return NextResponse.json(
      { ok: false, free: false, error: "That coupon code isn’t valid." },
      { status: 200 },
    );
  }
  await ensureSchema();
  const rows = await query<{ unlocked: boolean }>(
    `SELECT unlocked FROM iris_scans WHERE user_id = $1 AND scan_id = $2`,
    [user.id, scanId],
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "reading not found" }, { status: 404 });
  }
  if (rows[0].unlocked) {
    return NextResponse.json({ ok: true, free: true, alreadyUnlocked: true });
  }
  await unlockPersonForScan(scanId);
  return NextResponse.json({ ok: true, free: true, unlocked: true });
}
