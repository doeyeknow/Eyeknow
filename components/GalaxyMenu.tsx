"use client";

// The full-screen menu, ported from the Palm Reading app at Adam's
// direction (2026-11-03): a full-viewport galaxy overlay that
// slides in from the right (and back out on close — it stays
// mounted through the slide-out), with the items centered in large
// type. Escape, the × button, or a backdrop tap closes it, and the
// page behind it does not scroll while it is open.

import { useEffect, useRef, useState } from "react";
import Galaxy from "./Galaxy";

type Phase = "closed" | "entering" | "open" | "closing";

export default function GalaxyMenu(props: {
  open: boolean;
  onClose: () => void;
  savedCount: number;
  accountEmail: string | null;
  isAdmin: boolean;
  onHome: () => void;
  onScan: () => void;
  onHistory: () => void;
  onHow: () => void;
  onSignIn: () => void;
  onCreateAccount: () => void;
  onSignOut: () => void;
}) {
  const { onClose } = props;
  const [phase, setPhase] = useState<Phase>("closed");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (props.open) {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      setPhase((p) => (p === "closing" ? "open" : p === "open" ? p : "entering"));
    } else {
      setPhase((p) => {
        if (p === "closed" || p === "closing") return p;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "closed";
        timer.current = setTimeout(() => setPhase("closed"), 560);
        return "closing";
      });
    }
  }, [props.open]);

  /* Mounted off-screen, then eased to open on the next frames so
     the slide-in actually plays. */
  useEffect(() => {
    if (phase !== "entering") return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setPhase("open"));
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [phase]);

  useEffect(() => {
    if (phase === "closed") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [phase, onClose]);

  if (phase === "closed") return null;

  const act = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <div
      className={`menu-overlay no-print${phase === "open" ? " open" : phase === "closing" ? " closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Galaxy variant="full" />
      <button type="button" className="menu-overlay-x" aria-label="Close menu" onClick={onClose}>
        ×
      </button>
      <nav className="menu-overlay-items" aria-label="Menu">
        <button type="button" onClick={act(props.onHome)}>
          Home
        </button>
        <button type="button" onClick={act(props.onScan)}>
          New scan
        </button>
        <button type="button" onClick={act(props.onHistory)}>
          My readings{props.savedCount > 0 ? ` (${props.savedCount})` : ""}
        </button>
        <button type="button" onClick={act(props.onHow)}>
          How it works
        </button>
        <a href="/affiliates" onClick={onClose}>
          Join the Team
        </a>
        <a href="/subscription" onClick={onClose}>
          Subscription
        </a>
        {props.isAdmin && (
          <a href="/admin" onClick={onClose}>
            Admin dashboard
          </a>
        )}
        {props.accountEmail ? (
          <button type="button" onClick={act(props.onSignOut)}>
            Sign out
          </button>
        ) : (
          <>
            <button type="button" onClick={act(props.onSignIn)}>
              Sign in
            </button>
            <button type="button" onClick={act(props.onCreateAccount)}>
              Create account
            </button>
          </>
        )}
        <p className="menu-overlay-note">
          {props.accountEmail ? `Signed in as ${props.accountEmail}. ` : ""}A traditional
          reading, never a diagnosis.
        </p>
      </nav>
    </div>
  );
}
