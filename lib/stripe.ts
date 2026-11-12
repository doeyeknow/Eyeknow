// Stripe for the $19.99 full-report unlock (base price raised
// from $5.99 on 2026-11-01). Lazy client; returns null until
// STRIPE_SECRET_KEY is set on the project, so the app (and the
// paywall's "not turned on yet" state) behaves cleanly before then.

import Stripe from "stripe";

/** The standard full-reading price — what a visitor with no
 *  affiliate referral pays. Affiliate referrals charge the
 *  affiliate's own stored price instead ($5.99–$19.99). */
export const UNLOCK_PRICE_CENTS = 1999;

/** The basic reading (Adam, 2026-11-05): a flat $3 tier — the
 *  reading's top signs in full, with the body map. Never
 *  affiliate-priced, never gift-discounted; follow-ups never use
 *  it (they unlock in full for $1). */
export const BASIC_PRICE_CENTS = 300;

/** A paid full reading at ANY valid price — the $19.99 base or an
 *  affiliate's price down to the $5.99 floor — grants the buyer
 *  their 10 supporter readings. This threshold is deliberately the
 *  affiliate floor, NOT the base price: it must not rise when the
 *  base price does. $1 follow-ups never reach it. */
export const SUPPORTER_GRANT_MIN_CENTS = 599;

let client: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (client === undefined) {
    const key = process.env.STRIPE_SECRET_KEY;
    client = key ? new Stripe(key) : null;
  }
  return client;
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
