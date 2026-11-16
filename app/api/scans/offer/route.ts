import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured, ensureSchema, query } from "@/lib/db";
import { getSharedScan } from "@/lib/shared";
import { accountBasicOfferStatus, guestBasicOfferStatus } from "@/lib/firstBasicOffer";

export const dynamic = "force-dynamic";

/** The first-basic $1 offer on one reading: whether the $1 price
 *  applies, the price that applies, and the offer's expiry.
 *  Authorized two ways: the signed-in owner of an account reading,
 *  or the shared reading's access token (the printed report's QR
 *  credential). Anything else answers 404 — no oracle for whether
 *  a reading carries an offer. Display-only; checkout, verify, and
 *  the webhook recompute the price server-side regardless. */
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
      const status = await accountBasicOfferStatus(user.id, scanId);
      return NextResponse.json(status);
    }
  }
  if (accessToken) {
    const shared = await getSharedScan(scanId, accessToken);
    if (shared) {
      const status = await guestBasicOfferStatus(scanId);
      return NextResponse.json(status);
    }
  }
  return NextResponse.json({ error: "reading not found" }, { status: 404 });
}
