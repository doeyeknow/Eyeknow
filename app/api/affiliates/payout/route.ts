import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import {
  attemptPayoutFulfillment,
  getOpenAffiliatePayout,
  requestAffiliatePayout,
} from "@/lib/affiliates";

export const dynamic = "force-dynamic";

/** Payout requests. Fail-closed: unauthenticated → 401, non-affiliate
 *  or empty balance → 400.
 *
 *  POST {} — open a request for the full available balance, then
 *  immediately attempt to fulfill it with a Stripe Issuing virtual
 *  card. If fulfillment can't proceed (Issuing not activated, key
 *  lacks permission, or the account has no legal name/billing
 *  address to create a cardholder from), the request stays pending
 *  with a clear reason and the balance untouched — never marked
 *  paid, never lost.
 *
 *  POST { action: "retry" } — re-attempt fulfillment for the open
 *  request (e.g. after Issuing is activated). Idempotent: the card
 *  is created with an idempotency key per payout, so a retry can
 *  never double-issue. */
export async function POST(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { action?: string } | null;
  try {
    let payout: { id: string; amountCents: number };
    if (body?.action === "retry") {
      const open = await getOpenAffiliatePayout(user.id);
      if (!open) return NextResponse.json({ error: "no pending payout to retry" }, { status: 400 });
      payout = open;
    } else {
      payout = await requestAffiliatePayout(user.id);
    }
    const attempt = await attemptPayoutFulfillment(payout.id, user.id);
    return NextResponse.json({ ok: true, payout, fulfillment: attempt.outcome, detail: attempt.detail });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "could not request payout" },
      { status: 400 },
    );
  }
}
