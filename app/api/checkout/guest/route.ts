import { NextRequest, NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { BASIC_PRICE_CENTS, UNLOCK_PRICE_CENTS, getStripe } from "@/lib/stripe";
import { FOLLOWUP_PRICE_CENTS, sharedUnlockPriceCents, applyUnlockDiscount } from "@/lib/pricing";
import { getSharedScan } from "@/lib/shared";
import { normalizeRefCode, resolveAffiliate } from "@/lib/affiliates";
import { getScanDiscountPct } from "@/lib/supporterGifts";

export const dynamic = "force-dynamic";

/** Start a Stripe Checkout to unlock a SHARED reading — no account
 *  needed. The access token (from the printed report's QR link) is
 *  the credential; payment unlocks the shared copy, which can then
 *  be saved into an account. */
export async function POST(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as {
    scanId?: string;
    accessToken?: string;
    embedded?: boolean;
    ref?: string;
    kind?: string;
  } | null;
  const embedded = body?.embedded === true;
  const basic = body?.kind === "basic";
  const scanId = body?.scanId ?? "";
  const accessToken = body?.accessToken ?? "";
  // Referral code travels into the Stripe session metadata; the
  // webhook (and only the webhook) may credit it. Unknown or invalid
  // codes are dropped here and can never break a checkout.
  const refCode = normalizeRefCode(body?.ref);
  const shared = await getSharedScan(scanId, accessToken);
  if (!shared) return NextResponse.json({ error: "reading not found" }, { status: 404 });
  if (shared.unlocked) return NextResponse.json({ ok: true, alreadyUnlocked: true });
  if (basic && shared.basic) return NextResponse.json({ ok: true, alreadyBasic: true });

  // Follow-up scans in a Timeline chain unlock for $1 when the
  // chain's original reading is unlocked (server-verified).
  const basePriceCents = await sharedUnlockPriceCents(shared);
  const followup = basePriceCents === FOLLOWUP_PRICE_CENTS;
  // Affiliate pricing (full readings only): see /api/checkout.
  let priceCents = basePriceCents;
  let affiliatePrice: number | null = null;
  if (!followup && refCode) {
    const aff = await resolveAffiliate(refCode);
    if (aff) {
      priceCents = aff.price_cents;
      affiliatePrice = aff.price_cents;
    }
  }
  // Gift-redeemed readings (full readings only, never follow-ups)
  // unlock at 10% off the price that would otherwise apply —
  // affiliate stored price when attributed, else $5.99. Server-side
  // discount row only; recorded in metadata for webhook validation.
  let giftDiscountPct = 0;
  if (!followup) {
    giftDiscountPct = await getScanDiscountPct(scanId);
    if (giftDiscountPct > 0) priceCents = applyUnlockDiscount(priceCents, giftDiscountPct);
  }
  // Basic reading (Adam, 2026-11-05): flat $3 — see /api/checkout.
  if (basic) {
    if (followup) {
      return NextResponse.json(
        { error: "This follow-up reading unlocks in full for $1 — no basic tier needed." },
        { status: 400 },
      );
    }
    priceCents = BASIC_PRICE_CENTS;
    affiliatePrice = null;
    giftDiscountPct = 0;
  }
  const productName = basic
    ? "eyeKnow — Basic reading"
    : followup
      ? "eyeKnow — Follow-up reading"
      : "eyeKnow — Full detailed reading";
  const productDesc = basic
    ? "Unlocks your top signs in full, with the body map, for one iris reading."
    : followup
      ? "Unlocks the follow-up reading and its Timeline change comparison."
      : "Unlocks the complete report for one iris reading, including personalized diet recommendations.";
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Purchases aren't turned on yet — check back soon." },
      { status: 503 },
    );
  }

  const origin = req.nextUrl.origin;
  const back = `scan=${encodeURIComponent(scanId)}&t=${encodeURIComponent(accessToken)}`;
  const successUrl = `${origin}/?checkout=success&${back}&session_id={CHECKOUT_SESSION_ID}`;
  if (embedded) {
    let embeddedSession;
    try {
      embeddedSession = await stripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "embedded_page",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: priceCents,
            product_data: {
              name: productName,
              description: productDesc,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        scanId,
        guest: "1",
        ...(affiliatePrice !== null && refCode ? { ref: refCode, affiliatePrice: String(affiliatePrice) } : {}),
        ...(giftDiscountPct > 0 ? { giftDiscount: String(giftDiscountPct) } : {}),
        ...(basic ? { basic: "1", ...(refCode ? { ref: refCode } : {}) } : {}),
      },
      return_url: successUrl,
    });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown error";
      return NextResponse.json({ error: `Stripe: ${msg}` }, { status: 502 });
    }
    return NextResponse.json({ clientSecret: embeddedSession.client_secret });
  }
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: priceCents,
          product_data: {
            name: productName,
            description: productDesc,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      scanId,
      guest: "1",
      ...(affiliatePrice !== null && refCode ? { ref: refCode, affiliatePrice: String(affiliatePrice) } : {}),
        ...(giftDiscountPct > 0 ? { giftDiscount: String(giftDiscountPct) } : {}),
        ...(basic ? { basic: "1", ...(refCode ? { ref: refCode } : {}) } : {}),
    },
    success_url: successUrl,
    cancel_url: `${origin}/?checkout=cancelled&${back}`,
  });
  return NextResponse.json({ url: session.url });
}
