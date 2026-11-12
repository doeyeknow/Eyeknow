import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, query } from "@/lib/db";
import { getStripe, SUPPORTER_GRANT_MIN_CENTS, UNLOCK_PRICE_CENTS } from "@/lib/stripe";
import { markScanBasic, unlockPersonForScan, unlockSharedScan } from "@/lib/shared";
import { markGiftPaid } from "@/lib/gifts";
import { grantSupporterGifts, GIFT_UNLOCK_DISCOUNT_PCT, getScanDiscountPct } from "@/lib/supporterGifts";
import { BOOK_PRICE_CENTS, BOOKS, isBookSlug, recordBookPurchase, type BookSlug } from "@/lib/books";
import { recordAffiliateSale } from "@/lib/affiliates";
import { applyUnlockDiscount } from "@/lib/pricing";
import {
  activateSubscription,
  recordSubscriptionAffiliateSale,
} from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

/** Parse the affiliate price recorded in session metadata at
 *  checkout time. Anything unparseable becomes null, which the
 *  sale gate treats as "no credit" — never a guessed amount. */
function parseMetadataPrice(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

/** Backstop settlement: unlock on checkout.session.completed even
 *  if the buyer never returns to the site. */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "no signature" }, { status: 400 });
  const raw = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    // Timeline subscription activation: one-time payment per term,
    // webhook-only, idempotent on the session. The amount must
    // EXACTLY equal the term price — any mismatch activates
    // nothing and is logged. Affiliate credit (flat $50 on 1-year,
    // $100 on longer terms and lifetime) is isolated: a
    // bookkeeping failure here must never break the activation.
    if (session.metadata?.subscription === "1" && session.payment_status === "paid") {
      await ensureSchema();
      const termKey = session.metadata?.term ?? "";
      const activation = await activateSubscription({
        stripeSessionId: session.id,
        userId: session.metadata?.userId || null,
        guestEmail:
          (session as unknown as { customer_details?: { email?: string }; customer_email?: string })
            .customer_details?.email ??
          (session as unknown as { customer_email?: string }).customer_email ??
          null,
        term: termKey,
        amountCents: session.amount_total ?? 0,
      });
      if (!activation.activated) {
        console.error("subscription activation skipped", {
          sessionId: session.id,
          term: termKey,
          amount: session.amount_total,
          reason: activation.reason,
        });
      } else {
        try {
          const sess = session as unknown as {
            customer_details?: { email?: string };
            customer_email?: string;
          };
          await recordSubscriptionAffiliateSale({
            stripeSessionId: session.id,
            refCode: session.metadata?.ref ?? null,
            buyerUserId: session.metadata?.userId || null,
            buyerEmail: sess.customer_details?.email ?? sess.customer_email ?? null,
            term: termKey,
            amountCents: session.amount_total ?? 0,
          });
        } catch (e) {
          console.error("affiliate credit failed (subscription)", e);
        }
      }
    }
    // Gift purchase backstop: flip the gift to paid. The buyer-facing
    // verify normally sends the email first; if the buyer never
    // returned, the email can't be sent from here (the token lives
    // only in the buyer's success URL), but the gift is still valid
    // via the link the buyer received.
    if (session.metadata?.gift === "1" && session.payment_status === "paid") {
      await ensureSchema();
      await markGiftPaid(session.metadata?.giftId ?? "", session.id);
      // Affiliates: a PAID gift buy is a reading purchase and earns
      // the 50/50 split (the buyer is the gift purchaser). Free
      // supporter-gift grants are not Stripe sessions and never
      // reach this code. Isolated: a bookkeeping failure here must
      // never break the gift flip above.
      try {
        const sess = session as unknown as {
          customer_details?: { email?: string };
          customer_email?: string;
        };
        await recordAffiliateSale({
          stripeSessionId: session.id,
          refCode: session.metadata?.ref ?? null,
          buyerUserId: session.metadata?.userId || null,
          buyerEmail: sess.customer_details?.email ?? sess.customer_email ?? null,
          amountCents: session.amount_total ?? 0,
          metadataPriceCents: parseMetadataPrice(session.metadata?.affiliatePrice),
          isBook: false,
        });
      } catch (e) {
        console.error("affiliate credit failed (gift)", e);
      }
    }
    // Book purchase fulfillment: one paid $9.99 session creates
    // exactly one download row (idempotent on the session). This
    // webhook is the only fulfillment path — verify only reads it.
    if (
      session.metadata?.book === "1" &&
      session.payment_status === "paid" &&
      isBookSlug(session.metadata?.bookSlug ?? "") &&
      (session.amount_total ?? 0) >= BOOK_PRICE_CENTS
    ) {
      await ensureSchema();
      await recordBookPurchase(
        session.metadata?.userId || null,
        session.metadata.bookSlug as BookSlug,
        session.id,
      );
      // Affiliates: $3.00 flat per attributed book sale (the slider
      // sets reading prices only). Isolated: a bookkeeping failure
      // here must never break the download row above.
      try {
        const sess = session as unknown as {
          customer_details?: { email?: string };
          customer_email?: string;
        };
        await recordAffiliateSale({
          stripeSessionId: session.id,
          refCode: session.metadata?.ref ?? null,
          buyerUserId: session.metadata?.userId || null,
          buyerEmail: sess.customer_details?.email ?? sess.customer_email ?? null,
          amountCents: session.amount_total ?? 0,
          metadataPriceCents: null,
          isBook: true,
          title: BOOKS[session.metadata.bookSlug as BookSlug].title,
        });
      } catch (e) {
        console.error("affiliate credit failed (book)", e);
      }
    }
    const userId = session.metadata?.userId ?? "";
    const scanId = session.metadata?.scanId ?? "";
    const guest = session.metadata?.guest === "1";
    const basic = session.metadata?.basic === "1";
    if (scanId && session.payment_status === "paid") {
      await ensureSchema();
      // Gift-discounted unlocks fail closed: the discount row must
      // exist server-side and the charge must be exactly 90% of the
      // price that would otherwise apply (metadata affiliate price,
      // else the $19.99 base price). A mismatch unlocks nothing, grants nothing,
      // and credits nothing.
      const giftDiscounted = session.metadata?.giftDiscount === String(GIFT_UNLOCK_DISCOUNT_PCT);
      let discountBlocked = false;
      if (giftDiscounted) {
        const rowPct = await getScanDiscountPct(scanId);
        const metaAff = parseMetadataPrice(session.metadata?.affiliatePrice);
        const expectedDiscounted = applyUnlockDiscount(metaAff ?? UNLOCK_PRICE_CENTS, GIFT_UNLOCK_DISCOUNT_PCT);
        if (rowPct !== GIFT_UNLOCK_DISCOUNT_PCT || (session.amount_total ?? 0) !== expectedDiscounted) {
          console.error("discounted unlock blocked: amount/discount mismatch", {
            sessionId: session.id,
            scanId,
            amount: session.amount_total,
            expected: expectedDiscounted,
            rowPct,
          });
          discountBlocked = true;
        }
      }
      if (basic) {
        // Basic purchase (Adam, 2026-11-05): record the sale and
        // mark the person basic — never unlocked, no supporter
        // grants, no affiliate credit (the $3 charge can never
        // match a full-price affiliate validation).
        await query(
          `INSERT INTO iris_purchases (user_id, scan_id, stripe_session_id, amount_cents)
           VALUES ($1, $2, $3, $4) ON CONFLICT (stripe_session_id) DO NOTHING`,
          [guest ? null : userId || null, scanId, session.id, session.amount_total ?? 0],
        );
        await markScanBasic(scanId);
      } else if (!discountBlocked && guest) {
        // Guest purchase from a printed report's QR link: unlock the
        // shared copy (and any account copy of the same reading).
        await query(
          `INSERT INTO iris_purchases (user_id, scan_id, stripe_session_id, amount_cents)
           VALUES (NULL, $1, $2, $3) ON CONFLICT (stripe_session_id) DO NOTHING`,
          [scanId, session.id, session.amount_total ?? 0],
        );
        await unlockSharedScan(scanId);
      } else if (!discountBlocked && userId) {
        await query(
          `INSERT INTO iris_purchases (user_id, scan_id, stripe_session_id, amount_cents)
           VALUES ($1, $2, $3, $4) ON CONFLICT (stripe_session_id) DO NOTHING`,
          [userId, scanId, session.id, session.amount_total ?? 0],
        );
        await query(
          `UPDATE iris_scans SET unlocked = true, unlocked_at = now()
           WHERE user_id = $1 AND scan_id = $2`,
          [userId, scanId],
        );
        await query(
          `UPDATE iris_shared_scans SET unlocked = true, unlocked_at = now() WHERE scan_id = $1`,
          [scanId],
        );
        // Person rule: the pair (both irises) unlocks together.
        await unlockPersonForScan(scanId);
      }
      // Early supporters: a paid full reading purchase (base price
      // or any affiliate price) includes 10 shareable basic
      // readings. $1 Timeline follow-ups do not grant.
      // Idempotent on the session: a redelivered webhook grants zero
      // more. This webhook is the only granting path, and the grants
      // never send purchase emails.
      if (!basic && !discountBlocked && (session.amount_total ?? 0) >= SUPPORTER_GRANT_MIN_CENTS) {
        await grantSupporterGifts(guest ? null : userId || null, scanId, session.id);
      }
      // Affiliates: 50/50 split on a reading sale, credited here
      // and nowhere else, idempotent on the session — on the
      // DISCOUNTED amount for gift-discounted unlocks. A bookkeeping
      // failure here must never break the unlock above, so it is
      // isolated in try/catch.
      try {
        const sess = session as unknown as {
          customer_details?: { email?: string };
          customer_email?: string;
        };
        if (!basic && !discountBlocked) {
          await recordAffiliateSale({
            stripeSessionId: session.id,
            refCode: session.metadata?.ref ?? null,
            buyerUserId: userId || null,
            buyerEmail: sess.customer_details?.email ?? sess.customer_email ?? null,
            amountCents: session.amount_total ?? 0,
            metadataPriceCents: parseMetadataPrice(session.metadata?.affiliatePrice),
            isBook: false,
            discounted: giftDiscounted,
          });
        }
      } catch (e) {
        console.error("affiliate credit failed", e);
      }
    }
  }
  return NextResponse.json({ received: true });
}
