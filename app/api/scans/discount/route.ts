import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured, ensureSchema, query } from "@/lib/db";
import { getSharedScan } from "@/lib/shared";
import { getScanDiscountPct } from "@/lib/supporterGifts";

export const dynamic = "force-dynamic";

/** The unlock discount on one reading, in percent (0 when none).
 *  Authorized two ways: the signed-in owner of an account reading,
 *  or the shared reading's access token (the printed report's QR
 *  credential). Anything else answers 404 — no oracle for whether
 *  a reading carries a discount. Display-only; checkout and the
 *  webhook recompute the discount server-side regardless. */
export async function GET(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const scanId = req.nextUrl.searchParams.get("scanId") ?? "";
  const accessToken = req.nextUrl.searchParams.get("accessToken") ?? "";
  if (!scanId) return NextResponse.json({ error: "missing scan" }, { status: 400 });
  await ensureSchema();
  const user = await getSessionUser(req);
  if (user) {
    const own = await query<{ scan_id: string }>(
      `SELECT scan_id FROM iris_scans WHERE user_id = $1 AND scan_id = $2`,
      [user.id, scanId],
    );
    if (own.length) {
      return NextResponse.json({ discountPct: await getScanDiscountPct(scanId) });
    }
  }
  if (accessToken) {
    const shared = await getSharedScan(scanId, accessToken);
    if (shared) {
      return NextResponse.json({ discountPct: await getScanDiscountPct(scanId) });
    }
  }
  return NextResponse.json({ error: "reading not found" }, { status: 404 });
}
