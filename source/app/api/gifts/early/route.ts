import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import {
  getSupporterGiftByToken,
  listSupporterGiftsForScan,
  listSupporterGiftsForUser,
  redeemSupporterGift,
  supporterGiftToken,
  supporterGiftUrl,
} from "@/lib/supporterGifts";

export const dynamic = "force-dynamic";

/** Early-supporter shareable basic readings (10 per $5.99 purchase,
 *  granted by the Stripe webhook only). Links are rebuilt from grant
 *  ids, so the buyer can fetch them any time; only hashes are stored. */
export async function GET(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (token) {
    const gift = await getSupporterGiftByToken(token);
    if (!gift) return NextResponse.json({ error: "gift not found" }, { status: 404 });
    return NextResponse.json({ status: gift.status });
  }
  const origin = req.nextUrl.origin;
  const user = await getSessionUser(req);
  if (user) {
    const rows = await listSupporterGiftsForUser(user.id);
    return NextResponse.json({
      gifts: rows.map((g) => ({
        url: supporterGiftUrl(origin, supporterGiftToken(g.id)),
        status: g.status,
      })),
    });
  }
  const scanId = req.nextUrl.searchParams.get("scanId") ?? "";
  const accessToken = req.nextUrl.searchParams.get("accessToken") ?? "";
  if (scanId && accessToken) {
    const rows = await listSupporterGiftsForScan(scanId, accessToken);
    if (!rows) return NextResponse.json({ error: "not authorized" }, { status: 403 });
    return NextResponse.json({
      gifts: rows.map((g) => ({
        url: supporterGiftUrl(origin, supporterGiftToken(g.id)),
        status: g.status,
      })),
    });
  }
  return NextResponse.json({ error: "sign in required" }, { status: 401 });
}

/** Redeem one supporter link against one reading: the reading stays
 *  at the basic preview level and gains 10% off the full unlock —
 *  the link never unlocks a reading in full. */
export async function POST(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as {
    token?: string;
    scanId?: string;
  } | null;
  const token = body?.token ?? "";
  const scanId = body?.scanId ?? "";
  if (!token || !scanId) {
    return NextResponse.json({ error: "missing token or scan" }, { status: 400 });
  }
  const result = await redeemSupporterGift(token, scanId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, basic: true, discountPct: result.discountPct, scanId });
}
