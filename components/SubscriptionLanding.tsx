"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import SubscriptionOffer from "./SubscriptionOffer";

/**
 * The subscription landing + checkout-success page. A guest buyer
 * lands here with ?session_id=… and can attach the subscription to
 * their account with one tap; a signed-in buyer already has it
 * attached by the webhook, so the claim reports already-attached.
 * The offer component below doubles as the status display once the
 * subscription is attached.
 */
export default function SubscriptionLanding() {
  const params = useSearchParams();
  const paramSessionId = params.get("session_id") ?? "";
  const bought = params.get("bought") === "success";
  const [sessionId, setSessionId] = useState(paramSessionId);
  const [claimState, setClaimState] = useState<
    "idle" | "busy" | "claimed" | "already" | "failed" | "signin"
  >("idle");
  const [claimError, setClaimError] = useState<string | null>(null);
  const [offerKey, setOfferKey] = useState(0);

  // A guest buyer lands here signed out: remember the session id on
  // the device so that after they sign in and come back, the claim
  // still works without the original success URL.
  useEffect(() => {
    try {
      if (paramSessionId) {
        window.localStorage.setItem("iris_sub_claim", paramSessionId);
        setSessionId(paramSessionId);
      } else {
        const stored = window.localStorage.getItem("iris_sub_claim");
        if (stored) setSessionId(stored);
      }
    } catch {
      // Storage unavailable — the claim still works from the URL.
    }
  }, [paramSessionId]);

  useEffect(() => {
    if (!bought && !sessionId) return;
    if (!sessionId) return;
    setClaimState("busy");
    fetch("/api/subscriptions/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then(async (r) => {
        if (r.status === 401) {
          setClaimState("signin");
          return;
        }
        const d = (await r.json().catch(() => null)) as {
          claimed?: boolean;
          already?: boolean;
          error?: string;
        } | null;
        if (r.ok && d?.claimed) {
          setClaimState("claimed");
          try {
            window.localStorage.removeItem("iris_sub_claim");
          } catch {
            // Non-fatal.
          }
          setOfferKey((k) => k + 1);
        } else if (r.ok && d?.already) {
          setClaimState("already");
          try {
            window.localStorage.removeItem("iris_sub_claim");
          } catch {
            // Non-fatal.
          }
          setOfferKey((k) => k + 1);
        } else {
          setClaimState("failed");
          setClaimError(d?.error ?? "Could not attach the subscription.");
        }
      })
      .catch(() => {
        setClaimState("failed");
        setClaimError("Could not attach the subscription — try again in a moment.");
      });
  }, [bought, sessionId]);

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "28px 18px 80px" }}>
      <p>
        <a href="/">← Back to eyeKnow</a>
      </p>
      <h1 style={{ marginTop: 0 }}>Timeline subscription</h1>
      {bought && claimState === "busy" && <p className="muted">Attaching your subscription…</p>}
      {bought && claimState === "claimed" && (
        <p>Your subscription is attached to your account — welcome to the Timeline.</p>
      )}
      {bought && claimState === "already" && (
        <p>Your subscription is already on your account — see its status below.</p>
      )}
      {bought && claimState === "signin" && (
        <p>
          Your subscription is bought — sign in (or create an account) from the home page,
          then come back here to attach it to your account.
        </p>
      )}
      {bought && claimState === "failed" && (
        <p className="warn" role="alert">
          {claimError}
        </p>
      )}
      <SubscriptionOffer key={offerKey} />
    </main>
  );
}
