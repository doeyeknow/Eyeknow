import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured, query } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/** Owner-only virtual-card details, fetched on demand from Stripe.
 *  The card number/CVC are NEVER stored in our database and are
 *  returned only to the affiliate who owns a paid payout. Any
 *  mismatch (wrong owner, unpaid payout, no card) is a flat 404 so
 *  nothing about other affiliates' payouts leaks. */
export async function GET(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const payoutId = req.nextUrl.searchParams.get("payoutId") ?? "";
  // Malformed ids can never match a row; answer 404 rather than
  // letting the UUID comparison throw.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payoutId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const rows = await query<{ stripe_card_id: string }>(
    `SELECT stripe_card_id FROM iris_affiliate_payouts
     WHERE id = $1 AND affiliate_user_id = $2 AND status = 'paid' AND stripe_card_id IS NOT NULL`,
    [payoutId, user.id],
  );
  if (!rows[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "not configured" }, { status: 503 });
  try {
    const card = await stripe.issuing.cards.retrieve(rows[0].stripe_card_id);
    return NextResponse.json({
      last4: card.last4,
      number: card.number ?? null,
      cvc: card.cvc ?? null,
      exp_month: card.exp_month,
      exp_year: card.exp_year,
      status: card.status,
    });
  } catch {
    return NextResponse.json({ error: "could not load card" }, { status: 502 });
  }
}
