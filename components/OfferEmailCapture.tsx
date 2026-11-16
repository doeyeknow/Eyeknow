"use client";

import { useEffect, useRef, useState } from "react";
import { OFFER_EMAIL_STORAGE_KEY, validEmail } from "@/lib/emailGate";

/**
 * Unlock-panel email field (Adam, 2026-11-15 23:45 + 23:46): the
 * FALLBACK capture for the funnel's email — people who scanned
 * before the first-scan gate existed, and guests who cleared
 * storage. It shows only while no email is on file for the scan or
 * person and the funnel is still relevant (locked, in-window).
 * When the gate's email is already stored on the device, it saves
 * that address silently and shows nothing — never asks twice.
 *
 * Copy names the READING link only. The $1 offer must not be
 * mentioned before the reveal (Adam, 2026-11-15 23:51), and this
 * field renders before any reveal happens.
 */
export default function OfferEmailCapture({
  scanId,
  accessToken,
}: {
  scanId: string;
  accessToken?: string;
}) {
  const [state, setState] = useState<"checking" | "hidden" | "form" | "saved">("checking");
  const [email, setEmail] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      // The gate's address, stored on the device: save it against
      // this scan so the sweep can use it, and show nothing.
      try {
        const stored = localStorage.getItem(OFFER_EMAIL_STORAGE_KEY);
        if (stored && validEmail(stored)) {
          await fetch("/api/scans/offer/email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scanId, accessToken: accessToken ?? "", email: stored.trim().toLowerCase() }),
          }).catch(() => undefined);
          setState("hidden");
          return;
        }
      } catch {
        // Storage unavailable — fall through to the server check.
      }
      try {
        const q = `/api/scans/offer/email?scanId=${encodeURIComponent(scanId)}&t=${encodeURIComponent(accessToken ?? "")}`;
        const res = await fetch(q);
        if (!res.ok) {
          setState("hidden");
          return;
        }
        const d = (await res.json()) as { hasEmail?: unknown; relevant?: unknown };
        setState(d.hasEmail === true || d.relevant !== true ? "hidden" : "form");
      } catch {
        setState("hidden");
      }
    })();
  }, [scanId, accessToken]);

  if (state === "checking" || state === "hidden") return null;

  if (state === "saved") {
    return (
      <p className="muted" style={{ margin: "10px 0 0" }}>
        We&rsquo;ll email your reading link to <b>{savedEmail}</b> if you leave without unlocking.
      </p>
    );
  }

  const submit = async () => {
    const clean = email.trim();
    if (!validEmail(clean)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/scans/offer/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId, accessToken: accessToken ?? "", email: clean.toLowerCase() }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { error?: unknown } | null;
        setError(typeof d?.error === "string" ? d.error : "Couldn't save that email — try again.");
        setBusy(false);
        return;
      }
      try {
        localStorage.setItem(OFFER_EMAIL_STORAGE_KEY, clean.toLowerCase());
      } catch {
        // Storage unavailable — the server copy is what matters.
      }
      setSavedEmail(clean.toLowerCase());
      setState("saved");
    } catch {
      setError("Couldn't save that email — try again.");
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <p className="muted" style={{ margin: "0 0 8px" }}>
        Leaving without unlocking? Leave an email and we&rsquo;ll send you a link back to your
        reading. Your email is only used for that link — no marketing, nothing shared.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          placeholder="you@example.com"
          autoComplete="email"
          aria-label="Email for your reading link"
          disabled={busy}
          style={{ flex: "1 1 200px", padding: "10px 12px", fontSize: "1rem", borderRadius: 10 }}
        />
        <button type="button" className="btn" onClick={() => void submit()} disabled={busy}>
          {busy ? "Saving…" : "Email me my reading link"}
        </button>
      </div>
      {error && (
        <p className="warn" role="alert" style={{ margin: "8px 0 0" }}>
          {error}
        </p>
      )}
    </div>
  );
}
