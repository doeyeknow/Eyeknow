"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { PricePending } from "./AffiliatePrice";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * The first-basic $1 offer on one reading (Adam, 2026-11-15) —
 * null while unknown, so the display waits (placeholder) instead of
 * painting $3 and then dropping to $1: never a price that is about
 * to change. Fetched from the server — the offer lives in the
 * server's offer row, never in client state. Display-only; checkout
 * charges the server-computed price.
 */
export interface FirstBasicOfferState {
  offer: boolean;
  priceCents: number;
  expiresAt: number | null;
}

export function useFirstBasicOffer(
  scanId: string,
  accessToken?: string,
): FirstBasicOfferState | null {
  const [state, setState] = useState<FirstBasicOfferState | null>(null);
  useIsoLayoutEffect(() => {
    if (!scanId) {
      setState({ offer: false, priceCents: 300, expiresAt: null });
      return;
    }
    let cancelled = false;
    const q = `/api/scans/offer?scanId=${encodeURIComponent(scanId)}${
      accessToken ? `&accessToken=${encodeURIComponent(accessToken)}` : ""
    }`;
    fetch(q)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const o = d as { offer?: unknown; priceCents?: unknown; expiresAt?: unknown } | null;
        setState({
          offer: o?.offer === true,
          priceCents: typeof o?.priceCents === "number" ? o.priceCents : 300,
          expiresAt: typeof o?.expiresAt === "number" ? o.expiresAt : null,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ offer: false, priceCents: 300, expiresAt: null });
      });
    return () => {
      cancelled = true;
    };
  }, [scanId, accessToken]);
  return state;
}

/** The basic price display for one reading: $1 while the first-basic
 *  offer is live, else the flat $3. Display-only. */
export default function BasicPrice({
  scanId,
  accessToken,
}: {
  scanId: string;
  accessToken?: string;
}) {
  const state = useFirstBasicOffer(scanId, accessToken);
  if (state === null) return <PricePending />;
  return <>{state.offer ? "$1" : "$3"}</>;
}

/** The offer note under the basic button: only when the offer is
 *  live, naming the real expiry date — no urgency tricks. */
export function FirstBasicOfferNote({
  scanId,
  accessToken,
}: {
  scanId: string;
  accessToken?: string;
}) {
  const state = useFirstBasicOffer(scanId, accessToken);
  if (!state?.offer || !state.expiresAt) return null;
  const date = new Date(state.expiresAt).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });
  return (
    <p className="muted" style={{ margin: "8px 0 0" }}>
      Your first basic reading is $1 — this offer is good until {date}.
    </p>
  );
}
