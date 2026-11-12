"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { DiscountedPrice, formatCents, PricePending, useAffiliatePrice } from "./AffiliatePrice";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * The unlock discount on one reading, in percent — null while
 * unknown. The initial 0 in the old code was indistinguishable from
 * "no discount", so a gift-discounted reading first painted its
 * full price and then dropped to the discounted price: the same
 * wrong-price-first flash as the affiliate price. Null means "not
 * resolved yet" and the display waits (placeholder) instead of
 * guessing. Fetched from the server — the discount lives in the
 * server's discount row, never in client state.
 */
export function useScanDiscount(scanId: string, accessToken?: string): number | null {
  const [pct, setPct] = useState<number | null>(null);
  useIsoLayoutEffect(() => {
    if (!scanId) {
      setPct(0);
      return;
    }
    let cancelled = false;
    const q = `/api/scans/discount?scanId=${encodeURIComponent(scanId)}${
      accessToken ? `&accessToken=${encodeURIComponent(accessToken)}` : ""
    }`;
    fetch(q)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const p = (d as { discountPct?: unknown } | null)?.discountPct;
        setPct(typeof p === "number" && p > 0 && p < 100 ? p : 0);
      })
      .catch(() => {
        if (!cancelled) setPct(0);
      });
    return () => {
      cancelled = true;
    };
  }, [scanId, accessToken]);
  return pct;
}

/**
 * The unlock price display for one reading: $1 for follow-ups, the
 * gift discount off the affiliate price (or the $19.99 base price)
 * when the reading
 * carries a redeemed supporter link, else the affiliate price.
 * While either input is unresolved the display is the neutral
 * placeholder — never a price that is about to change. Display-only;
 * checkout charges the server-computed price.
 */
export default function UnlockPrice({
  scanId,
  accessToken,
  followup = false,
}: {
  scanId: string;
  accessToken?: string;
  followup?: boolean;
}) {
  const affState = useAffiliatePrice();
  const pct = useScanDiscount(scanId, accessToken);
  // The follow-up price is fixed at $1 regardless of referral or
  // discount, so it needs no resolution and cannot flash.
  if (followup) return <>$1</>;
  if (affState.status === "pending" || pct === null) return <PricePending />;
  const affPrice = affState.price;
  if (pct > 0) {
    // The gift discount comes off the applicable price (the
    // affiliate's, or the base) — show that price struck through
    // so the discount itself is visible, not just its result.
    const base = affPrice ?? 1999;
    const now = Math.round((base * (100 - pct)) / 100);
    return now < base ? (
      <DiscountedPrice wasCents={base} nowCents={now} />
    ) : (
      <>{formatCents(now)}</>
    );
  }
  if (affPrice !== null) {
    return affPrice < 1999 ? (
      <DiscountedPrice wasCents={1999} nowCents={affPrice} />
    ) : (
      <>{formatCents(affPrice)}</>
    );
  }
  return <>$19.99</>;
}
