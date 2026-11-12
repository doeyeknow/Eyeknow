import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured, ensureSchema } from "@/lib/db";
import { UNLOCK_PRICE_CENTS, getStripe } from "@/lib/stripe";
import { createGift, setGiftSession } from "@/lib/gifts";
import { normalizeRefCode, resolveAffiliate } from "@/lib/affiliates";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Start a gift purchase: create the gift record, then a Stripe
 *  Checkout session (hosted or embedded). No account needed. The
 *  gift email goes out when the payment settles (verify/webhook). */
export async function POST(req: NextRequest) {
  if (!dbConfigured()) {
    return NextResponse.json({ error: "Gifts aren't available right now." }, { status: 503 });
  }
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Purchases aren't turned on yet — please check back soon." },
      { status: 503 },
    );
  }
  const body = (await req.json().catch(() => null)) as {
    recipientEmail?: string;
    recipientName?: string;
    fromName?: string;
    message?: string;
    embedded?: boolean;
    ref?: string;
  } | null;
  const recipientEmail = (body?.recipientEmail ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(recipientEmail)) {
    return NextResponse.json({ error: "Please enter the recipient's email address." }, { status: 400 });
  }
  // Affiliate pricing: a valid referral charges the affiliate's
  // CURRENT stored price (never a client or cookie value), recorded
  // in metadata so the webhook can verify before crediting the
  // 50/50 split. No referral → standard $19.99.
  const refCode = normalizeRefCode(body?.ref);
  let priceCents = UNLOCK_PRICE_CENTS;
  let affiliatePrice: number | null = null;
  if (refCode) {
    await ensureSchema();
    const aff = await resolveAffiliate(refCode);
    if (aff) {
      priceCents = aff.price_cents;
      affiliatePrice = aff.price_cents;
    }
  }
  // The buyer (for the affiliate self-purchase check at webhook time).
  const buyer = await getSessionUser(req);
  const clean = (s: string | undefined, max: number) => (s ?? "").trim().slice(0, max) || undefined;
  const { id, token } = await createGift({
    recipientEmail,
    recipientName: clean(body?.recipientName, 60),
    fromName: clean(body?.fromName, 60),
    message: clean(body?.message, 300),
  });

  const origin = req.nextUrl.origin;
  const successUrl = `${origin}/?gift_bought=success&g=${encodeURIComponent(id)}&gt=${encodeURIComponent(token)}&session_id={CHECKOUT_SESSION_ID}`;
  const lineItems = [
    {
      price_data: {
        currency: "usd",
        unit_amount: priceCents,
        product_data: {
          name: "eyeKnow — Gift reading",
          description:
            "A full detailed eyeKnow reading, gifted: the recipient takes their scan and the complete report unlocks free.",
        },
      },
      quantity: 1,
    },
  ] as const;

  try {
    if (body?.embedded === true) {
      const embeddedSession = await stripe.checkout.sessions.create({
        mode: "payment",
        ui_mode: "embedded_page",
        line_items: [...lineItems],
        metadata: {
          giftId: id,
          gift: "1",
          userId: buyer?.id ?? "",
          ...(affiliatePrice !== null && refCode ? { ref: refCode, affiliatePrice: String(affiliatePrice) } : {}),
        },
        return_url: successUrl,
      });
      await setGiftSession(id, embeddedSession.id);
      return NextResponse.json({ clientSecret: embeddedSession.client_secret });
    }
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [...lineItems],
      metadata: {
        giftId: id,
        gift: "1",
        userId: buyer?.id ?? "",
        ...(affiliatePrice !== null && refCode ? { ref: refCode, affiliatePrice: String(affiliatePrice) } : {}),
      },
      success_url: successUrl,
      cancel_url: `${origin}/?gift_bought=cancelled`,
    });
    await setGiftSession(id, session.id);
    return NextResponse.json({ url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: `Stripe: ${msg}` }, { status: 502 });
  }
}
