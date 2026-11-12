import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import { claimSubscription } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

/** Attach a guest-bought subscription to the signed-in account.
 *  The claim key is the Stripe session id from the buyer's own
 *  success URL. Only an unclaimed (guest) row can be claimed. */
export async function POST(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { sessionId?: string } | null;
  const sessionId = body?.sessionId ?? "";
  if (!sessionId) return NextResponse.json({ error: "missing session" }, { status: 400 });
  const result = await claimSubscription(sessionId, user.id);
  if (result.claimed) return NextResponse.json({ ok: true, claimed: true });
  if (result.already) return NextResponse.json({ ok: true, claimed: false, already: true });
  return NextResponse.json({ error: "subscription not found or already claimed" }, { status: 404 });
}
