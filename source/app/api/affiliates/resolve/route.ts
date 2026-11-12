import { NextRequest, NextResponse } from "next/server";
import { dbConfigured, ensureSchema } from "@/lib/db";
import { normalizeRefCode, resolveAffiliate } from "@/lib/affiliates";

export const dynamic = "force-dynamic";

/**
 * Resolve a referral reference (auto code or custom slug) to the
 * affiliate's CURRENT stored price, for display. The price a visitor
 * sees here is exactly what checkout will charge — checkout itself
 * re-checks server-side and never trusts the cookie. Unknown
 * references answer priceCents null (standard price).
 */
export async function GET(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ priceCents: null });
  try {
    await ensureSchema();
    const code = normalizeRefCode(req.nextUrl.searchParams.get("code"));
    if (!code) return NextResponse.json({ priceCents: null });
    const aff = await resolveAffiliate(code);
    return NextResponse.json({ priceCents: aff ? aff.price_cents : null });
  } catch {
    return NextResponse.json({ priceCents: null });
  }
}
