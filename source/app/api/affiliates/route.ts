import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured, ensureSchema } from "@/lib/db";
import {
  completeAffiliateSignup,
  getAffiliateStats,
} from "@/lib/affiliates";

export const dynamic = "force-dynamic";

/** Affiliate status + stats for the signed-in user. Fail-closed:
 *  unauthenticated → 401, and a user only ever sees their own data. */
export async function GET(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const stats = await getAffiliateStats(user.id);
  return NextResponse.json({ affiliate: stats });
}

/** Join the program through the setup flow. Terms agreement is
 *  required (422 without it); the flow's link name and price are
 *  applied by completeAffiliateSignup. A bare legacy join (no
 *  slug/price in the body) still works ONLY for someone who is
 *  already an affiliate — it just returns their code. */
export async function POST(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as {
    action?: string;
    termsAgreed?: unknown;
    slug?: unknown;
    priceCents?: unknown;
  } | null;
  if (body?.action !== "join") return NextResponse.json({ error: "unknown action" }, { status: 400 });
  await ensureSchema();
  const origin = req.nextUrl.origin;
  const hasSetup = body.slug !== undefined || body.priceCents !== undefined;
  if (!hasSetup) {
    const existing = await getAffiliateStats(user.id);
    if (existing) return NextResponse.json({ code: existing.code, link: `${origin}/?ref=${existing.code}` });
  }
  if (body.termsAgreed !== true) {
    return NextResponse.json(
      { error: "Please agree to the affiliate terms to join." },
      { status: 422 },
    );
  }
  try {
    const { code, slug } = await completeAffiliateSignup(user.id, {
      slug: body.slug,
      priceCents: body.priceCents,
    });
    return NextResponse.json({ code, slug, link: `${origin}/${slug}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Couldn't join — try again.";
    if (msg === "taken") {
      return NextResponse.json({ error: "That name is taken — pick another." }, { status: 409 });
    }
    if (msg === "locked") {
      return NextResponse.json(
        { error: "Your link name is already set, and link names are permanent." },
        { status: 409 },
      );
    }
    if (msg === "price out of range") {
      return NextResponse.json(
        { error: "Price must be between $5.99 and $19.99." },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
