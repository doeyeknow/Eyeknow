"use client";

import { useEffect, useRef } from "react";
import { OFFER_EMAIL_STORAGE_KEY, validEmail } from "@/lib/emailGate";

/**
 * Exit-triggered funnel beacon (Adam, 2026-11-15 23:42 + 23:51):
 * when the person leaves a still-locked reading, one best-effort
 * report goes to the server, which sends whichever stage applies —
 * the stage-1 reveal prompt before the reveal flag, the $1 offer
 * after it. Fires when the page hides and on unload, once per scan
 * per page session. Never blocks unload, never shows anything, and
 * a failed report is silently ignored — the sweep catches whatever
 * this misses. The first-scan gate's email, when stored on the
 * device, rides along so the server can use it for the email stage.
 * Renders nothing.
 */
export default function ExitPromptBeacon({
  scanId,
  accessToken,
  shouldSend,
  suppress,
}: {
  scanId: string;
  accessToken?: string;
  /** True while the reading is still locked at the basic tier. */
  shouldSend: boolean;
  /** True while checkout is opening — leaving for checkout is not
   *  leaving without unlocking. */
  suppress?: boolean;
}) {
  const latest = useRef({ scanId, accessToken, shouldSend, suppress });
  latest.current = { scanId, accessToken, shouldSend, suppress };
  const sentFor = useRef<string | null>(null);

  useEffect(() => {
    const report = () => {
      const s = latest.current;
      if (!s.shouldSend || s.suppress || !s.scanId) return;
      if (sentFor.current === s.scanId) return;
      sentFor.current = s.scanId;
      let email: string | undefined;
      try {
        const stored = localStorage.getItem(OFFER_EMAIL_STORAGE_KEY);
        if (stored && validEmail(stored)) email = stored.trim().toLowerCase();
      } catch {
        // Storage unavailable — the report goes without the email.
      }
      const payload = JSON.stringify({ scanId: s.scanId, accessToken: s.accessToken ?? "", email });
      try {
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          const blob = new Blob([payload], { type: "application/json" });
          if (navigator.sendBeacon("/api/scans/offer/exit", blob)) return;
        }
      } catch {
        // Fall through to the keepalive fetch.
      }
      try {
        void fetch("/api/scans/offer/exit", {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: payload,
        });
      } catch {
        // Best effort only — the sweep is the backstop.
      }
    };
    const onVisibility = () => {
      if (document.hidden) report();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", report);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", report);
    };
  }, []);

  return null;
}
