import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured, ensureSchema, query } from "@/lib/db";
import { BASIC_PRICE_CENTS, UNLOCK_PRICE_CENTS, getStripe } from "@/lib/stripe";
import { accountUnlockPriceCents, sharedUnlockPriceCents, applyUnlockDiscount } from "@/lib/pricing";
import { getSharedScan, markScanBasic, unlockPersonForScan, unlockSharedScan } from "@/lib/shared";
import { getGiftById, settleGiftPayment } from "@/lib/gifts";
import { GIFT_UNLOCK_DISCOUNT_PCT, getScanDiscountPct } from "@/lib/supporterGifts";

export const dynamic = "force-dynamic";

function parseMetadataPrice(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

/** Strict validation for a gift-discounted unlock: the discount row
 *  must exist server-side AND the charge must be exactly 90% of the
 *  price that would otherwise apply (metadata affiliate price, else
 *  the $19.99 base price). Anything else fails closed — no unlock. */
async function giftDiscountedAmountValid(
  scanId: string,
  session: { metadata?: { giftDiscount?: string; affiliatePrice?: string } | null; amount_total?: number | null },
): Promise<boolean> {
  const rowPct = await getScanDiscountPct(scanId);
  if (rowPct !== GIFT_UNLOCK_DISCOUNT_PCT) return false;
  const metaAff = parseMetadataPrice(session.metadata?.affiliatePrice);
  const expected = applyUnlockDiscount(metaAff ?? UNLOCK_PRICE_CENTS, GIFT_UNLOCK_DISCOUNT_PCT);
  return (session.amount_total ?? 0) === expected;
}

/** After Stripe redirects back: confirm payment server-side and
 *  unlock. The webhook does the same as a backstop. Handles both
 *  account purchases and guest purchases from a QR link. */
export async function POST(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "purchases not configured" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as {
    sessionId?: string;
    scanId?: string;
    accessToken?: string;
    giftId?: string;
    giftToken?: string;
  } | null;
  const sessionId = body?.sessionId ?? "";
  if (!sessionId) return NextResponse.json({ error: "missing session" }, { status: 400 });

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  // Gift purchase: payment flips the gift to paid and the recipient
  // email goes out (exactly once, on the transition). The amount
  // must cover the price the gift was actually sold at: the
  // affiliate price in the session metadata, else the base price.
  if (session.metadata?.gift === "1") {
    const giftId = session.metadata?.giftId ?? "";
    const expectedGift =
      parseMetadataPrice(session.metadata?.affiliatePrice) ?? UNLOCK_PRICE_CENTS;
    if (
      session.payment_status !== "paid" ||
      !giftId ||
      giftId !== (body?.giftId ?? "") ||
      (session.amount_total ?? 0) < expectedGift
    ) {
      return NextResponse.json({ ok: false, error: "payment not confirmed" }, { status: 402 });
    }
    await ensureSchema();
    const origin = req.nextUrl.origin;
    const gift = await settleGiftPayment(giftId, sessionId, origin, body?.giftToken ?? null);
    const current = gift ?? (await getGiftById(giftId));
    return NextResponse.json({
      ok: true,
      gift: true,
      recipientEmail: current?.recipient_email ?? null,
      emailSent: current?.email_sent ?? false,
      status: current?.status ?? "paid",
    });
  }

  const scanId = session.metadata?.scanId ?? "";
  if (session.payment_status !== "paid" || !scanId) {
    return NextResponse.json({ ok: false, error: "payment not confirmed" }, { status: 402 });
  }
  // The expected amount is recomputed server-side: $1 for a Timeline
  // follow-up whose base reading is unlocked, $19.99 otherwise.
  await ensureSchema();

  // Guest purchase (printed report's QR link): the access token is
  // the credential — it must match the shared reading being unlocked.
  if (session.metadata?.guest === "1") {
    const shared = await getSharedScan(body?.scanId ?? "", body?.accessToken ?? "");
    if (!shared || shared.id !== scanId) {
      return NextResponse.json({ ok: false, error: "payment not confirmed" }, { status: 402 });
    }
    // Basic purchase (Adam, 2026-11-05): the charge must be
    // exactly $3; settlement marks the person basic, never unlocked.
    if (session.metadata?.basic === "1") {
      if ((session.amount_total ?? 0) !== BASIC_PRICE_CENTS) {
        return NextResponse.json({ ok: false, error: "payment not confirmed" }, { status: 402 });
      }
      await query(
        `INSERT INTO iris_purchases (user_id, scan_id, stripe_session_id, amount_cents)
         VALUES (NULL, $1, $2, $3) ON CONFLICT (stripe_session_id) DO NOTHING`,
        [scanId, sessionId, session.amount_total ?? BASIC_PRICE_CENTS],
      );
      await markScanBasic(scanId);
      return NextResponse.json({ ok: true, scanId, basic: true });
    }
    const expectedGuest =
      parseMetadataPrice(session.metadata?.affiliatePrice) ??
      (await sharedUnlockPriceCents(shared));
    if (session.metadata?.giftDiscount === String(GIFT_UNLOCK_DISCOUNT_PCT)) {
      if (!(await giftDiscountedAmountValid(scanId, session))) {
        return NextResponse.json({ ok: false, error: "payment not confirmed" }, { status: 402 });
      }
    } else if ((session.amount_total ?? 0) < expectedGuest) {
      return NextResponse.json({ ok: false, error: "payment not confirmed" }, { status: 402 });
    }
    await query(
      `INSERT INTO iris_purchases (user_id, scan_id, stripe_session_id, amount_cents)
       VALUES (NULL, $1, $2, $3) ON CONFLICT (stripe_session_id) DO NOTHING`,
      [scanId, sessionId, session.amount_total ?? expectedGuest],
    );
    await unlockSharedScan(scanId);
    return NextResponse.json({ ok: true, scanId });
  }

  const user = await getSessionUser(req);
  if (!user || session.metadata?.userId !== user.id) {
    return NextResponse.json({ ok: false, error: "payment not confirmed" }, { status: 402 });
  }
  // The expected amount: the affiliate price recorded in the
  // session metadata for a referred purchase (follow-ups never
  // carry one — they stay $1), else the server-recomputed price.
  // Basic purchase (Adam, 2026-11-05): exactly $3, marks basic.
  if (session.metadata?.basic === "1") {
    if ((session.amount_total ?? 0) !== BASIC_PRICE_CENTS) {
      return NextResponse.json({ ok: false, error: "payment not confirmed" }, { status: 402 });
    }
    await query(
      `INSERT INTO iris_purchases (user_id, scan_id, stripe_session_id, amount_cents)
       VALUES ($1, $2, $3, $4) ON CONFLICT (stripe_session_id) DO NOTHING`,
      [user.id, scanId, sessionId, session.amount_total ?? BASIC_PRICE_CENTS],
    );
    await markScanBasic(scanId);
    return NextResponse.json({ ok: true, scanId, basic: true });
  }
  const expected =
    parseMetadataPrice(session.metadata?.affiliatePrice) ??
    (await accountUnlockPriceCents(user.id, scanId));
  if (session.metadata?.giftDiscount === String(GIFT_UNLOCK_DISCOUNT_PCT)) {
    if (!(await giftDiscountedAmountValid(scanId, session))) {
      return NextResponse.json({ ok: false, error: "payment not confirmed" }, { status: 402 });
    }
  } else if ((session.amount_total ?? 0) < expected) {
    return NextResponse.json({ ok: false, error: "payment not confirmed" }, { status: 402 });
  }
  await query(
    `INSERT INTO iris_purchases (user_id, scan_id, stripe_session_id, amount_cents)
     VALUES ($1, $2, $3, $4) ON CONFLICT (stripe_session_id) DO NOTHING`,
    [user.id, scanId, sessionId, session.amount_total ?? expected],
  );
  await query(
    `UPDATE iris_scans SET unlocked = true, unlocked_at = now()
     WHERE user_id = $1 AND scan_id = $2`,
    [user.id, scanId],
  );
  await query(
    `UPDATE iris_shared_scans SET unlocked = true, unlocked_at = now() WHERE scan_id = $1`,
    [scanId],
  );
  // Person rule: the pair (both irises) unlocks with this purchase.
  await unlockPersonForScan(scanId);
  return NextResponse.json({ ok: true, scanId });
}
