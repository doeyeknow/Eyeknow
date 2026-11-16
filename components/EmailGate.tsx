"use client";

import { useEffect, useRef, useState } from "react";
import {
  countLocalScans,
  LOCAL_SCANS_KEY,
  OFFER_EMAIL_STORAGE_KEY,
  shouldShowGate,
  validEmail,
} from "@/lib/emailGate";

/**
 * First-scan email gate (Adam, 2026-11-15 23:46): before the FIRST
 * scan starts, the person must enter a valid email — the reading
 * and the link back to it come to their email, and the email is
 * used only for that. The scan does not begin until one is entered.
 * Rendered by CaptureTips, which lives on the capture step for
 * both the web and native-app flows, so the gate sits before
 * capture starts in the shared flow without touching IrisApp (at
 * the deploy cap) or the native bridge.
 *
 * Never asked again once stored: signed-in accounts have their
 * email on file; guests keep a local marker plus the address the
 * exit beacon attaches to the scan. Returning guests (prior scans
 * on the device) never see it. Renders nothing once dismissed or
 * when the gate doesn't apply.
 */
export default function EmailGate() {
  const [visible, setVisible] = useState(false);
  const [decided, setDecided] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let stored: string | null = null;
    let scans = 0;
    try {
      stored = localStorage.getItem(OFFER_EMAIL_STORAGE_KEY);
      scans = countLocalScans(localStorage.getItem(LOCAL_SCANS_KEY));
    } catch {
      // Storage unavailable — fall through to the account check.
    }
    if (!shouldShowGate({ signedIn: false, storedEmail: stored, localScanCount: scans })) {
      setDecided(true);
      return;
    }
    // No local reason to skip — a signed-in account has its email on
    // file. A failed check fails toward SHOWING the gate: a network
    // blip must not let a first scan start without the email.
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((d: { user?: unknown } | null) => {
        if (d?.user) {
          setDecided(true);
          return;
        }
        setVisible(true);
        setDecided(true);
      })
      .catch(() => {
        setVisible(true);
        setDecided(true);
      });
  }, []);

  if (!decided || !visible) return null;

  const submit = () => {
    const clean = email.trim();
    if (!validEmail(clean)) {
      setError("Enter a valid email address to continue to your scan.");
      return;
    }
    try {
      localStorage.setItem(OFFER_EMAIL_STORAGE_KEY, clean.toLowerCase());
    } catch {
      // Storage unavailable — the gate still lifts for this session;
      // the panel field below the reading can capture it later.
    }
    setVisible(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(10, 20, 17, 0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div className="panel" style={{ maxWidth: 430, width: "100%" }}>
        <h2>Your email, before your first scan</h2>
        <p>
          Your reading — and the link to come back to it if you leave without unlocking — comes
          to your email. Your email is only used for that. No marketing, nothing shared.
        </p>
        <label style={{ display: "block", marginBottom: 8 }}>
          <span style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Email address</span>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
            style={{ width: "100%", padding: "11px 12px", fontSize: "1rem", borderRadius: 10 }}
          />
        </label>
        {error && (
          <p className="warn" role="alert" style={{ margin: "0 0 10px" }}>
            {error}
          </p>
        )}
        <button type="button" className="btn big" onClick={submit} style={{ width: "100%" }}>
          Continue to scan
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => window.location.assign("/")}
          style={{ width: "100%", marginTop: 8 }}
        >
          Cancel scan
        </button>
      </div>
    </div>
  );
}
