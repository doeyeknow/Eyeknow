import { NextRequest, NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { getGiftByToken, redeemGift } from "@/lib/gifts";

export const dynamic = "force-dynamic";

/** Public gift info for the recipient landing page (no emails or
 *  other private fields — the token itself is the credential). */
export async function GET(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const gift = await getGiftByToken(token);
  if (!gift) return NextResponse.json({ error: "gift not found" }, { status: 404 });
  return NextResponse.json({
    fromName: gift.from_name,
    recipientName: gift.recipient_name,
    message: gift.message,
    status: gift.status,
  });
}

/** Redeem a paid gift against one reading, unlocking it in full. */
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
  const result = await redeemGift(token, scanId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, unlocked: true, scanId });
}
