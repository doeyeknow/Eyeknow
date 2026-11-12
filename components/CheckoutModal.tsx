import type { RefObject } from "react";
import AffPrice from "./AffiliatePrice";
import UnlockPrice from "./DiscountPrice";

/** The in-app Stripe checkout modal. Stripe's embedded form mounts
 *  into the mount div (the mounting effect lives in IrisApp); if the
 *  form stalls on a bad connection, a fallback offers the standard
 *  hosted checkout instead of an endlessly empty box. */
export default function CheckoutModal({
  kind,
  tier = "full",
  followup,
  stalled,
  mountRef,
  onClose,
  onHosted,
  scanId,
  accessToken,
}: {
  kind: "unlock" | "gift";
  /** Which unlock is being bought — the title and note must match
   *  it (a basic checkout titled "full reading" was Adam's
   *  2026-11-06 bug report). */
  tier?: "full" | "basic";
  followup: boolean;
  stalled: boolean;
  mountRef: RefObject<HTMLDivElement>;
  onClose: () => void;
  onHosted: () => void;
  /** The reading being unlocked — lets the title show its gift
   *  discount when it carries one. Absent for gift checkouts. */
  scanId?: string;
  accessToken?: string;
}) {
  return (
    <div
      className="modal-backdrop no-print"
      role="dialog"
      aria-modal="true"
      aria-label="Checkout"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card checkout-card">
        <button
          type="button"
          className="modal-close"
          aria-label="Close checkout"
          onClick={onClose}
        >
          ×
        </button>
        <p className="report-brand">eyeKnow · Secure checkout</p>
        <h2 style={{ marginTop: 0 }}>
          {kind === "gift" ? (
            <>Gift a reading — <AffPrice /></>
          ) : followup ? (
            "Unlock the full reading — $1"
          ) : tier === "basic" ? (
            "Unlock the basic reading — $3"
          ) : scanId ? (
            <>Unlock the full reading — <UnlockPrice scanId={scanId} accessToken={accessToken} /></>
          ) : (
            <>Unlock the full reading — <AffPrice /></>
          )}
        </h2>
        {kind === "unlock" && !followup && tier === "basic" && (
          <p className="muted" style={{ marginTop: -6 }}>
            The basic reading opens your <b>5 most important signs in full</b> —
            complete descriptions, colour stages and sign shapes — with the{" "}
            <b>complete body map</b>, for <b>both irises</b> of this person.
          </p>
        )}
        {kind === "unlock" && !followup && tier !== "basic" && (
          <p className="muted" style={{ marginTop: -6 }}>
            eyeKnow is still being developed, and it can make mistakes sometimes. Thank you
            for supporting it early — unlocking also gives you{" "}
            <b>10 free basic readings to share</b> with friends and family.
          </p>
        )}
        <div ref={mountRef} className="checkout-mount" />
        {stalled && (
          <div className="unlock-note" role="alert">
            <p style={{ marginTop: 0 }}>
              The payment form is taking too long to load — the connection may have stalled.
            </p>
            {kind === "unlock" ? (
              <button type="button" className="btn" onClick={onHosted}>
                Use the standard checkout instead
              </button>
            ) : (
              <p style={{ marginBottom: 0 }}>Close this and try again in a moment.</p>
            )}
          </div>
        )}
        <p className="muted" style={{ marginBottom: 0 }}>
          Payment is handled securely by Stripe — eyeKnow never sees your card.
        </p>
      </div>
    </div>
  );
}
