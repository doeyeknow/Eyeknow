import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import { normalizeAffiliatePrice, setAffiliatePrice } from "@/lib/affiliates";

export const dynamic = "force-dynamic";

/** Save the signed-in affiliate's reading price ($5.99–$19.99).
 *  Bounds are enforced server-side; out-of-range or non-numeric
 *  input is a clean 400, never a 500. Affects future sales only. */
export async function POST(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { priceCents?: unknown } | null;
  const price = normalizeAffiliatePrice(body?.priceCents);
  if (price === null) {
    return NextResponse.json(
      { error: "Price must be between $5.99 and $19.99." },
      { status: 400 },
    );
  }
  try {
    await setAffiliatePrice(user.id, price);
    return NextResponse.json({ ok: true, priceCents: price });
  } catch (e) {
    if (e instanceof Error && e.message === "not an affiliate") {
      return NextResponse.json({ error: "Join the program first." }, { status: 400 });
    }
    return NextResponse.json({ error: "Couldn't save price — try again in a moment." }, { status: 500 });
  }
}
