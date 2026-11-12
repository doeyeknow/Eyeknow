"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { REFERRAL_CHANGED_EVENT, getReferralCode, getReferralPrice } from "./ReferralCapture";

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// useLayoutEffect runs before the browser paints on the client but
// warns on the server — this alias keeps the server render silent
// while still resolving the price before first visible paint.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * The affiliate price for this visitor, if any — resolved WITHOUT
 * ever painting a guessed price first.
 *
 * Why pending-first: the server render cannot see the visitor's
 * cookies, so any price painted during first render would be a
 * guess. On a referred visit the guess (the base price) is wrong, and the
 * swap to the affiliate price once the cookie or the server lookup
 * lands is exactly the wrong-price flash Adam reported. So first render
 * (server and client alike) is always the neutral placeholder, and
 * the layout effect below resolves the real price before the
 * browser's first visible paint whenever the answer is already on
 * the device (the price cookie). When only a referral code exists
 * and the price must come from the server, the placeholder stays
 * until the lookup lands — never a wrong price in between.
 * Display-only; checkout never trusts this value.
 */
export type AffiliatePriceState =
  | { status: "pending" }
  | { status: "ready"; price: number | null };

export function useAffiliatePrice(): AffiliatePriceState {
  const [state, setState] = useState<AffiliatePriceState>({ status: "pending" });
  useIsoLayoutEffect(() => {
    let cancelled = false;
    // Resolution is repeatable, not one-shot: on a ?ref= landing
    // the referral is stored only after this component first
    // mounts, so a mount-only resolution settles on the base
    // price and never recovers (the gift-price bug Adam reported
    // 2026-11-03). Re-resolve when the referral lands, when the
    // visitor returns to the tab, and once shortly after mount.
    const resolve = () => {
      const cookiePrice = getReferralPrice();
      if (cookiePrice !== null) {
        if (!cancelled) setState({ status: "ready", price: cookiePrice });
        return;
      }
      const code = getReferralCode();
      if (!code) {
        if (!cancelled) setState({ status: "ready", price: null });
        return;
      }
      fetch(`/api/affiliates/resolve?code=${encodeURIComponent(code)}`)
        .then((r) => r.json().catch(() => null))
        .then((d) => {
          if (cancelled) return;
          const p = (d as { priceCents?: unknown } | null)?.priceCents;
          setState({
            status: "ready",
            price: typeof p === "number" && p >= 599 && p <= 1999 ? p : null,
          });
        })
        .catch(() => {
          if (!cancelled) setState({ status: "ready", price: null });
        });
    };
    resolve();
    window.addEventListener(REFERRAL_CHANGED_EVENT, resolve);
    window.addEventListener("focus", resolve);
    const retry = window.setTimeout(resolve, 1500);
    return () => {
      cancelled = true;
      window.removeEventListener(REFERRAL_CHANGED_EVENT, resolve);
      window.removeEventListener("focus", resolve);
      window.clearTimeout(retry);
    };
  }, []);
  return state;
}

/** Neutral placeholder: blank-ish, never a wrong price. */
export function PricePending() {
  return (
    <span role="status" aria-label="Loading price">
      …
    </span>
  );
}

/** Struck-through regular price + the visitor's actual price,
 *  shown only when the visitor genuinely has a discount (Adam,
 *  2026-11-01: if the price is discounted, display that — on the
 *  site itself too, not just in the shares). Display-only. */
export function DiscountedPrice({ wasCents, nowCents }: { wasCents: number; nowCents: number }) {
  return (
    <>
      <s style={{ opacity: 0.6, fontSize: "0.85em", marginRight: 5 }}>{formatCents(wasCents)}</s>
      {formatCents(nowCents)}
    </>
  );
}

/** Renders the visitor's affiliate price, or the fallback when none —
 *  and the placeholder, never the fallback, while resolving. An
 *  affiliate price below the $19.99 base shows the base struck
 *  through beside it, so the discount is visible wherever the
 *  price appears. */
export default function AffPrice({ fallback = "$19.99" }: { fallback?: string }) {
  const state = useAffiliatePrice();
  if (state.status === "pending") return <PricePending />;
  if (state.price === null) return <>{fallback}</>;
  return state.price < 1999 ? (
    <DiscountedPrice wasCents={1999} nowCents={state.price} />
  ) : (
    <>{formatCents(state.price)}</>
  );
}
