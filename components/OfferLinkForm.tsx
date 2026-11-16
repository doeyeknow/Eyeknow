"use client";

import { useState } from "react";

/**
 * Email-link reveal form (Adam, 2026-11-15 23:47): the signed link
 * lands here. No account for the email → set a password (the
 * existing auth system creates the account and signs in). An
 * account exists → the existing password is required; the link
 * alone never grants access. On success the reading opens — that
 * landing IS the reveal. The password step unlocks nothing; the $1
 * purchase, when the offer applies, still happens at checkout.
 * After the 7-day window the same flow lands on the reading at
 * normal $3 pricing, with the expiry said plainly here.
 */
export default function OfferLinkForm({
  token,
  email,
  accountExists,
  expired,
  signedInAs,
}: {
  token: string;
  email: string;
  accountExists: boolean;
  expired: boolean;
  signedInAs: string | null;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!password) {
      setError("Enter a password.");
      return;
    }
    if (!accountExists && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/scans/offer/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const d = (await res.json().catch(() => null)) as {
        scanId?: unknown;
        error?: unknown;
      } | null;
      if (!res.ok || typeof d?.scanId !== "string") {
        setError(typeof d?.error === "string" ? d.error : "Something went wrong — try again.");
        setBusy(false);
        return;
      }
      window.location.href = `/?scan=${encodeURIComponent(d.scanId)}`;
    } catch {
      setError("Something went wrong — try again.");
      setBusy(false);
    }
  };

  return (
    <div>
      {expired && (
        <p className="warn" style={{ marginTop: 0 }}>
          This link has expired — reading links last 7 days from the scan. Your reading is still
          available: sign in below to open it at the normal $3 basic price.
        </p>
      )}
      {signedInAs && (
        <p className="muted" style={{ marginTop: 0 }}>
          You&rsquo;re signed in as {signedInAs}. This link was sent to {email} — signing in here
          switches to that account.
        </p>
      )}
      <h1>{accountExists ? "Sign in to open your reading" : "Set a password to open your reading"}</h1>
      <p>
        This link was sent to <b>{email}</b>.{" "}
        {accountExists
          ? "Enter your password to open your reading."
          : "Set a password to create your account and open your reading — your reading stays saved in your account on any device."}
      </p>
      <p className="muted">
        Signing in doesn&rsquo;t unlock anything — the reading opens locked, and unlocking is a
        separate choice on the next screen.
      </p>
      <label style={{ display: "block", marginBottom: 8 }}>
        <span style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
          {accountExists ? "Password" : "Choose a password (at least 8 characters)"}
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          autoComplete={accountExists ? "current-password" : "new-password"}
          autoFocus
          style={{ width: "100%", padding: "11px 12px", fontSize: "1rem", borderRadius: 10 }}
        />
      </label>
      {error && (
        <p className="warn" role="alert" style={{ margin: "0 0 10px" }}>
          {error}
        </p>
      )}
      <button type="button" className="btn big" onClick={() => void submit()} disabled={busy} style={{ width: "100%" }}>
        {busy ? "Please wait…" : accountExists ? "Sign in & view my reading" : "Set password & view my reading"}
      </button>
    </div>
  );
}
