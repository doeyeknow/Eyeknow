"use client";

import { useEffect, useState } from "react";

// Install invite as a toast (Adam, 2026-11-05): in a browser tab the
// bottom bar is always shown now, so the old fixed InstallFooter is
// replaced by this dismissible toast. It appears once, a couple of
// seconds after the page settles; dismissing it silences it for two
// weeks. It never shows in the installed app.
const KEY = "eyeknow-install-toast-dismissed";
const RESHOW_MS = 14 * 24 * 60 * 60 * 1000;

// Top-drop presentation (Adam, 2026-11-07): the install invite is a
// toast that comes in from the TOP of the page, not up from the
// bottom bar. globals.css is at the deploy cap, so the override
// lives here; the keyframes carry the -50% centering because a CSS
// animation overrides the element's own transform while it runs.
const topStyle = `
.app-toast-top { bottom: auto; top: calc(10px + env(safe-area-inset-top)); animation: toastDrop 0.38s cubic-bezier(0.22, 1.1, 0.36, 1) both; }
@keyframes toastDrop { from { opacity: 0; transform: translate(-50%, -135%); } to { opacity: 1; transform: translate(-50%, 0); } }
@media (prefers-reduced-motion: reduce) { .app-toast-top { animation: none; } }
`;

export default function InstallToast({
  canInstall,
  installed,
  standalone,
  onInstall,
}: {
  canInstall: boolean;
  installed: boolean;
  standalone: boolean;
  onInstall: () => void;
}) {
  const [show, setShow] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    if (standalone || installed) {
      setShow(false);
      return;
    }
    let dismissed = 0;
    try {
      dismissed = Number(localStorage.getItem(KEY) ?? 0);
    } catch {
      /* storage unavailable — treat as never dismissed */
    }
    if (dismissed && Date.now() - dismissed < RESHOW_MS) return;
    const t = window.setTimeout(() => setShow(true), 2000);
    return () => window.clearTimeout(t);
  }, [standalone, installed]);

  if (!show || standalone || installed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const ios =
    /iphone|ipad|ipod/i.test(ua) ||
    (/macintosh/i.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1);
  const helpText = ios
    ? "To install: tap the Share button in your browser, then “Add to Home Screen”."
    : "To install: open your browser menu and choose “Install app” or “Add to Home screen”.";

  const doInstallClick = () => {
    if (canInstall) {
      onInstall();
      dismiss();
    } else {
      setHelp(true);
    }
  };

  return (
    <>
    <style>{topStyle}</style>
    <div className="app-toast app-toast-top no-print" role="status">
      <span className="app-toast-text">
        📲 <b>Install eyeKnow</b> — add it to your home screen for one-tap scans.
        {help && <span className="app-toast-help">{helpText}</span>}
      </span>
      <span className="app-toast-actions">
        {help ? (
          <button type="button" className="btn" onClick={dismiss}>
            Got it
          </button>
        ) : (
          <button type="button" className="btn" onClick={doInstallClick}>
            Install
          </button>
        )}
        <button type="button" className="app-toast-x" aria-label="Dismiss" onClick={dismiss}>
          ×
        </button>
      </span>
    </div>
    </>
  );
}
