import { NextRequest, NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { recordAffiliateClick } from "@/lib/affiliates";

export const dynamic = "force-dynamic";

/** Record a referral-link click. Deliberately uninformative on
 *  failure: it always answers ok (even for unknown codes or when the
 *  DB is down), so it can never break the page that linked here.
 *  For a valid reference it also returns the affiliate's current
 *  price, so the visit can set the price cookie. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { code?: string } | null;
    if (dbConfigured() && body?.code) {
      const hit = await recordAffiliateClick(body.code);
      if (hit) return NextResponse.json({ ok: true, priceCents: hit.priceCents });
    }
  } catch {
    // Clicks are non-critical; never surface an error.
  }
  return NextResponse.json({ ok: true });
}
