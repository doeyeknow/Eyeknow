// Timeline subscription terms — pure constants, safe to import from
// client components. The server lib (lib/subscriptions.ts) imports
// these; the prices here are the server's source of truth only when
// read through that lib — the client copy is display-only and the
// checkout route charges from its own server-side table.

/** One-time term prices, in cents. Per-year cost falls with term
 *  length: $149 → $99.80 → $89.90 → $74.95, then lifetime. */
export const SUBSCRIPTION_TERMS = {
  "1y": { label: "1 year", years: 1, priceCents: 14900, affiliateFlatCents: 5000 },
  "5y": { label: "5 years", years: 5, priceCents: 49900, affiliateFlatCents: 10000 },
  "10y": { label: "10 years", years: 10, priceCents: 89900, affiliateFlatCents: 10000 },
  "20y": { label: "20 years", years: 20, priceCents: 149900, affiliateFlatCents: 10000 },
  lifetime: { label: "Lifetime", years: null, priceCents: 249900, affiliateFlatCents: 10000 },
} as const;

export type SubscriptionTermKey = keyof typeof SUBSCRIPTION_TERMS;

export function isSubscriptionTermKey(v: unknown): v is SubscriptionTermKey {
  return typeof v === "string" && v in SUBSCRIPTION_TERMS;
}
