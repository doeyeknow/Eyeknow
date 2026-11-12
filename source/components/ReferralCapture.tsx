"use client";

import { useEffect } from "react";
import {
  REFERRAL_COOKIE,
  REFERRAL_PRICE_COOKIE,
  REFERRAL_TTL_DAYS,
  isValidAffiliatePrice,
  isValidRefValue,
} from "@/lib/affiliates-client";
import { REFMARK_KEY, readPngText } from "@/lib/refmark";

/** Read the stored referral reference (cookie first, localStorage second).
 *  Used at checkout time so the reference travels into the Stripe session. */
export function getReferralCode(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${REFERRAL_COOKIE}=([^;]*)`));
  const fromCookie = m ? decodeURIComponent(m[1]) : null;
  if (fromCookie && isValidRefValue(fromCookie)) return fromCookie;
  try {
    const ls = window.localStorage.getItem(REFERRAL_COOKIE);
    if (ls && isValidRefValue(ls)) return ls;
  } catch {
    // Storage unavailable — no referral.
  }
  // Third layer (Adam, 2026-11-05): a code recovered this session
  // from the refmark image cache, held in memory when even
  // localStorage is unavailable.
  return memoryRef;
}

/** Referral code recovered from the refmark image cache during
 *  this session (see recoverRefmark below). */
let memoryRef: string | null = null;

/** Stamp the referral into the refmark image cache: fetching the
 *  personalized logo with cache:"reload" makes the browser file
 *  the stamped copy under the refmark URL, where a later visit
 *  can read the code back out of the image bytes. Best-effort —
 *  any failure just leaves the first two layers in charge. */
function stampRefmark(code: string) {
  try {
    void fetch("/api/refmark", {
      cache: "reload",
      credentials: "same-origin",
      headers: { "x-refmark-code": code },
    })
      .then((r) => r.arrayBuffer())
      .catch(() => undefined);
  } catch {
    // The image layer simply won't exist for this visitor.
  }
}

/** Recover a referral from the refmark image cache: force-cache
 *  fetches the URL the browser filed at capture time and reads
 *  the code out of the PNG's text chunk. Returns null on a cache
 *  miss (the network then serves the plain logo, which carries
 *  no chunk) or any failure. */
async function recoverRefmark(): Promise<string | null> {
  try {
    const res = await fetch("/api/refmark", { cache: "force-cache", credentials: "same-origin" });
    if (!res.ok) return null;
    const code = readPngText(new Uint8Array(await res.arrayBuffer()), REFMARK_KEY);
    return code && isValidRefValue(code) ? code : null;
  } catch {
    return null;
  }
}

/**
 * Append the visitor's stored referral reference to a share URL, so
 * links shared onward (share buttons, gift links) carry the affiliate
 * attribution with them: the next visitor lands with the affiliate
 * cookie set and the affiliate's pricing in effect. The price itself
 * never travels in the URL — it is resolved from the affiliate's
 * stored price when the link is visited, so nothing in the link can
 * be tampered with. URLs that already carry a ref, and visitors with
 * no stored referral, pass through unchanged.
 */
export function withReferral(url: string): string {
  const code = getReferralCode();
  if (!code) return url;
  try {
    const u = new URL(url);
    if (u.searchParams.has("ref")) return url;
    u.searchParams.set("ref", code);
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Read the stored affiliate price (cookie first, localStorage second).
 * Display-only: checkout always re-checks the affiliate's stored price
 * server-side, so a tampered or stale cookie can never set a charge.
 * Returns null when there is no referral price (standard $19.99).
 */
export function getReferralPrice(): number | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${REFERRAL_PRICE_COOKIE}=([^;]*)`));
  const fromCookie = m ? Number(decodeURIComponent(m[1])) : NaN;
  if (isValidAffiliatePrice(fromCookie)) return fromCookie;
  try {
    const ls = Number(window.localStorage.getItem(REFERRAL_PRICE_COOKIE));
    if (isValidAffiliatePrice(ls)) return ls;
  } catch {
    // Storage unavailable — no referral price.
  }
  return null;
}

/** Fired whenever the stored referral (code or price) changes, so
 *  prices already on screen can re-resolve — a ?ref= landing stores
 *  the referral only after the first paint, and a price that
 *  resolved once at mount would otherwise sit at the base price
 *  for the whole session (Adam, 2026-11-03: the gift price kept
 *  showing $19.99 instead of the affiliate's price). */
export const REFERRAL_CHANGED_EVENT = "eyeknow:referral-changed";
export function notifyReferralChanged() {
  try {
    window.dispatchEvent(new Event(REFERRAL_CHANGED_EVENT));
  } catch {
    // No window (server) — nothing to notify.
  }
}

function storePrice(priceCents: number) {
  try {
    const maxAge = REFERRAL_TTL_DAYS * 24 * 60 * 60;
    document.cookie = `${REFERRAL_PRICE_COOKIE}=${priceCents}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    window.localStorage.setItem(REFERRAL_PRICE_COOKIE, String(priceCents));
    notifyReferralChanged();
  } catch {
    // Storage unavailable — the price simply won't display.
  }
}

/**
 * Capture a ?ref=CODE visit: store the reference (cookie + localStorage,
 * 30 days), record one click, and — when the reference resolves to a
 * real affiliate — store that affiliate's current price in the price
 * cookie so the app shows the affiliate's price. Invalid references
 * are ignored, and a click is recorded at most once per browser
 * session per reference.
 */
export default function ReferralCapture() {
  useEffect(() => {
    try {
      const raw = new URLSearchParams(window.location.search).get("ref");
      if (!raw) return;
      const code = raw.trim().toLowerCase();
      if (!isValidRefValue(code)) return;
      const maxAge = REFERRAL_TTL_DAYS * 24 * 60 * 60;
      document.cookie = `${REFERRAL_COOKIE}=${code}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
      window.localStorage.setItem(REFERRAL_COOKIE, code);
      notifyReferralChanged();
      stampRefmark(code);
      const firedKey = `${REFERRAL_COOKIE}_fired_${code}`;
      if (!window.sessionStorage.getItem(firedKey)) {
        window.sessionStorage.setItem(firedKey, "1");
        fetch("/api/affiliates/click", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        })
          .then((r) => r.json().catch(() => null))
          .then((d) => {
            const price = (d as { priceCents?: unknown } | null)?.priceCents;
            if (typeof price === "number" && isValidAffiliatePrice(price)) storePrice(price);
          })
          .catch(() => undefined);
      }
    } catch {
      // Referral capture must never break the page.
    }
  }, []);

  /* Third-layer recovery: no referral in the URL, none in the
     cookie or localStorage — try the refmark image cache. On a
     hit, restore the referral everywhere it can go (cookie and
     localStorage attempts included; when both are blocked the
     code still lives in memoryRef for this session) and resolve
     the affiliate's display price WITHOUT recording a click —
     a recovery is not a new visit. */
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("ref")) return;
      if (getReferralCode()) return;
    } catch {
      return;
    }
    void (async () => {
      const code = await recoverRefmark();
      if (!code) return;
      memoryRef = code;
      try {
        const maxAge = REFERRAL_TTL_DAYS * 24 * 60 * 60;
        document.cookie = `${REFERRAL_COOKIE}=${code}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
      } catch {
        // Cookie blocked — memory + localStorage carry it.
      }
      try {
        window.localStorage.setItem(REFERRAL_COOKIE, code);
      } catch {
        // Storage blocked — memoryRef carries it this session.
      }
      notifyReferralChanged();
      try {
        const r = await fetch(`/api/affiliates/resolve?code=${encodeURIComponent(code)}`);
        const d = (await r.json().catch(() => null)) as { priceCents?: unknown } | null;
        if (typeof d?.priceCents === "number" && isValidAffiliatePrice(d.priceCents)) {
          storePrice(d.priceCents);
        }
      } catch {
        // Price display is best-effort; checkout re-resolves.
      }
    })();
  }, []);
  return null;
}
