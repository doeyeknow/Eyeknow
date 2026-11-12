import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured, ensureSchema } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { normalizeRefCode } from "@/lib/affiliates";
import { isSubscriptionTermKey, SUBSCRIPTION_TERMS } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

/** Start a Stripe Checkout for one Timeline subscription term.
 *  One-time payment (mode: "payment") — never a Stripe recurring
 *  subscription. The price comes from the server term table, never
 *  from the client. Guest checkout is allowed, like books: a guest
 *  buyer claims the subscription into an account from the success
 *  page. A signed-in buyer gets it in their account directly. */
export async function POST(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Purchases aren't turned on yet — check back soon." },
      { status: 503 },
    );
  }
  const body = (await req.json().catch(() => null)) as {
    term?: string;
    ref?: string;
  } | null;
  const termKey = body?.term ?? "";
  if (!isSubscriptionTermKey(termKey)) {
    return NextResponse.json({ error: "unknown term" }, { status: 400 });
  }
  const term = SUBSCRIPTION_TERMS[termKey];
  await ensureSchema();
  const user = await getSessionUser(req);
  const origin = req.nextUrl.origin;
  // Referral attribution for the flat subscription share ($50 on
  // 1-year, $100 on longer terms and lifetime): the code travels in
  // metadata; the webhook resolves it, checks buyer ≠ affiliate,
  // and credits. Unknown or invalid codes are dropped here and can
  // never break a checkout.
  const refCode = normalizeRefCode(body?.ref);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: term.priceCents,
          product_data: {
            name: `eyeKnow — Timeline subscription (${term.label})`,
            description:
              "A free reading of each iris every week (48 per iris per year, full reports unlocked), a comprehensive Timeline report monitoring changes over time, and a professional overview written by a real person after each month.",
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      subscription: "1",
      term: termKey,
      userId: user?.id ?? "",
      ...(refCode ? { ref: refCode } : {}),
    },
    success_url: `${origin}/subscription?bought=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/subscription`,
  }).catch((e) => {
    const msg = e instanceof Error ? e.message : "unknown error";
    return { error: `Stripe: ${msg}` };
  });
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: 502 });
  }
  return NextResponse.json({ url: session.url });
}
