"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

/**
 * Home-view "Want to make money?" section (Adam, 2026-11-03):
 * sits above the Meet Kyle developer section and opens a modal
 * explaining the affiliate program. The footer affiliates link
 * was removed the same day — this section replaces it. All
 * numbers are the program's real terms.
 */
export default function JoinTeam() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <section
        aria-label="Join the Team"
        style={{
          opacity: 0.7,
          marginTop: 18,
          background: "#fbf3da",
          border: "1px solid rgba(201, 162, 39, 0.65)",
          borderRadius: 16,
          padding: "16px 18px",
        }}
      >
        <h2
          style={{
            margin: "0 0 6px",
            fontFamily: "var(--font-display)",
            fontSize: "1.35rem",
            color: "var(--brand)",
          }}
        >
          Want to make money?
        </h2>
        <p style={{ margin: "0 0 6px" }}>
          Since we just started, we're looking to spread the word and need help.
        </p>
        <p className="muted" style={{ margin: "0 0 14px" }}>
          Share eyeKnow with people you know and earn on every sale your link brings in —
          readings, books, and subscriptions.
        </p>
        <button type="button" className="btn" style={{ background: "var(--accent)", borderColor: "var(--accent)", color: "#231a04" }} onClick={() => setOpen(true)}>
          Join the Team
        </button>
      </section>
      {open && <JoinTeamModal onClose={() => setOpen(false)} />}
    </>
  );
}

function JoinTeamModal({ onClose }: { onClose: () => void }) {
  // Portalled to <body> (Adam, 2026-11-05): rendered in place, this
  // modal lives inside <main>, whose z-index-1 stacking context
  // traps it UNDER the foreground gorge (z-index 2) — the cliffs
  // painted over its bottom. At body level its backdrop z-index
  // works like every other modal's and it sits above the scene.
  return createPortal(<JoinTeamSheet onClose={onClose} />, document.body);
}

function JoinTeamSheet({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="modal-backdrop no-print"
      role="dialog"
      aria-modal="true"
      aria-label="Join the Team"
      onClick={onClose}
    >
      <div
        className="modal-card"
        style={{ paddingBottom: "calc(38px + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 className="modal-title" style={{ marginTop: 0 }}>
          Join the Team
        </h2>
        <p>
          eyeKnow is brand new, and the fastest way to grow is people telling people. The
          Team is our affiliate program — here's how it works:
        </p>
        <ol style={{ paddingLeft: 20, display: "grid", gap: 10, margin: "12px 0" }}>
          <li>
            <b>Sign up free.</b> Sign in (or create an account) and finish a quick setup:
            agree to the terms, pick your permanent link name, and set your reading price.
          </li>
          <li>
            <b>Share your link.</b> You get your own link — eyeknow.app/yourname — plus
            ready-made posts, printable fliers with your QR code, and a selling guide in
            the Team app.
          </li>
          <li>
            <b>Earn on every sale.</b> You set the reading price ($5.99–$19.99) and keep{" "}
            <b>50%</b> of every reading sold through your link. Books pay <b>$3.00</b>{" "}
            each, and Timeline subscriptions pay <b>$50</b> for the 1-year term or{" "}
            <b>$100</b> for longer terms.
          </li>
          <li>
            <b>Track it and cash out.</b> Every click and sale shows in your Team
            dashboard, and you can request a payout to a virtual debit card loaded with
            your earnings.
          </li>
        </ol>
        <a
          className="btn"
          href="https://team.eyeknow.app"
          style={{ display: "inline-block", background: "var(--accent)", borderColor: "var(--accent)", color: "#231a04" }}
        >
          Join the Team
        </a>
        <p className="muted" style={{ marginBottom: 0, marginTop: 12 }}>
          Free to join. Your link name is permanent once chosen, so pick one you like.
        </p>
      </div>
    </div>
  );
}
