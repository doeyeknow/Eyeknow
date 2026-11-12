import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured, ensureSchema, query } from "@/lib/db";
import { BASIC_PRICE_CENTS, UNLOCK_PRICE_CENTS, getStripe } from "@/lib/stripe";
import { FOLLOWUP_PRICE_CENTS, accountUnlockPriceCents, applyUnlockDiscount } from "@/lib/pricing";
import { normalizeRefCode, resolveAffiliate } from "@/lib/affiliates";
import { getScanDiscountPct } from "@/lib/supporterGifts";
import type { ScanRecord } from "@/lib/chart";

export const dynamic = "force-dynamic";

/** Start a Stripe Checkout for unlocking one reading's full report. */
export async function POST(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Purchases aren't turned on yet — check back soon." },
      { status: 503 },
    );
  }
  const body = (await req.json().catch(() => null)) as {
    scanId?: string;
    embedded?: boolean;
    ref?: string;
    kind?: string;
  } | null;
  const scanId = body?.scanId ?? "";
  const embedded = body?.embedded === true;
  const basic = body?.kind === "basic";
  // Referral code travels into the Stripe session metadata; the
  // webhook (and only the webhook) may credit it. Unknown or invalid
  // codes are dropped here and can never break a checkout.
  const refCode = normalizeRefCode(body?.ref);
  await ensureSchema();
  const rows = await query<{ unlocked: boolean; basic: boolean; data: ScanRecord }>(
    `SELECT unlocked, basic, data FROM iris_scans WHERE user_id = $1 AND scan_id = $2`,
    [user.id, scanId],
  );
  if (rows.length === 0) return NextResponse.json({ error: "reading not found" }, { status: 404 });
  if (rows[0].unlocked) return NextResponse.json({ ok: true, alreadyUnlocked: true });
  if (basic && rows[0].basic) return NextResponse.json({ ok: true, alreadyBasic: true });
  // Person rule: if any other scan of the same person is already
  // unlocked, this one is covered — never charge twice for a pair.
  {
    const pid = rows[0].data.personId ?? rows[0].data.id;
    const sibs = await query<{ unlocked: boolean }>(
      `SELECT unlocked FROM iris_scans WHERE user_id = $1 AND (scan_id = $2 OR data->>'personId' = $2)`,
      [user.id, pid],
    );
    if (sibs.some((r) => r.unlocked)) {
      return NextResponse.json({ ok: true, alreadyUnlocked: true });
    }
  }

  // Follow-up scans in a Timeline chain unlock for $1 when the
  // chain's original reading is unlocked (server-verified).
  const basePriceCents = await accountUnlockPriceCents(user.id, scanId);
  const followup = basePriceCents === FOLLOWUP_PRICE_CENTS;
  // Affiliate pricing (full readings only): a valid referral charges
  // the affiliate's CURRENT stored price — never a client or cookie
  // value. The price is recorded in metadata so the webhook can
  // verify the charge before crediting. Follow-ups stay $1 and carry
  // no referral metadata, so they can never earn commission.
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
  // affiliate stored price when attributed, else $19.99. The
  // discount comes from the server's own discount row, never from
  // the client, and is recorded in metadata so the webhook can
  // validate the charge before unlocking or crediting.
  let giftDiscountPct = 0;
  if (!followup) {
    giftDiscountPct = await getScanDiscountPct(scanId);
    if (giftDiscountPct > 0) priceCents = applyUnlockDiscount(priceCents, giftDiscountPct);
  }
  // Basic reading (Adam, 2026-11-05): flat $3, never a follow-up
  // (those unlock in full for $1), never affiliate-priced or
  // gift-discounted. The referral code still rides along in the
  // metadata for attribution.
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

  const origin = req.nextUrl.origin;
  const successUrl = `${origin}/?checkout=success&scan=${encodeURIComponent(scanId)}&session_id={CHECKOUT_SESSION_ID}`;
  if (embedded) {
    // In-app checkout: Stripe's form renders inside our own modal;
    // after payment Stripe returns the page to the same success URL
    // the hosted flow uses, where the unlock is verified.
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
        userId: user.id,
        scanId,
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
      userId: user.id,
      scanId,
      ...(affiliatePrice !== null && refCode ? { ref: refCode, affiliatePrice: String(affiliatePrice) } : {}),
        ...(giftDiscountPct > 0 ? { giftDiscount: String(giftDiscountPct) } : {}),
        ...(basic ? { basic: "1", ...(refCode ? { ref: refCode } : {}) } : {}),
    },
    success_url: successUrl,
    cancel_url: `${origin}/?checkout=cancelled&scan=${encodeURIComponent(scanId)}`,
  });
  return NextResponse.json({ url: session.url });
}
