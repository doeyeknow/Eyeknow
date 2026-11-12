// Client-safe affiliate constants only. The server logic lives in
// lib/affiliates.ts (never import that file from a client component:
// it pulls in the database pool and the Stripe SDK).
export const REFERRAL_COOKIE = "iris_ref";
export const REFERRAL_PRICE_COOKIE = "iris_ref_price";
export const REFERRAL_TTL_DAYS = 30;

/** A referral reference is the auto code or a custom slug: lowercase
 *  alphanumerics and hyphens, 3–30 chars, at least one alnum. */
export function isValidRefValue(s: string): boolean {
  return /^[a-z0-9-]{3,30}$/.test(s) && /[a-z0-9]/.test(s);
}

/** A stored affiliate price is an integer number of cents, $5.99–$19.99. */
export function isValidAffiliatePrice(n: number): boolean {
  return Number.isInteger(n) && n >= 599 && n <= 1999;
}
