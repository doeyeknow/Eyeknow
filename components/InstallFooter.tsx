import { useState } from "react";

// Fixed footer shown INSTEAD of the bottom bar when eyeKnow is opened
// in a browser tab rather than as the installed app (Adam's direction,
// 2026-10-19): one job — get the app installed — plus a small sign-in
// link. Same height as the bottom bar, so page spacing never shifts.
interface Props {
  canInstall: boolean;
  installed: boolean;
  accountEmail: string | null;
  isAdmin?: boolean;
  onInstall: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

export default function InstallFooter(p: Props) {
  const [help, setHelp] = useState(false);
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const ios =
    /iphone|ipad|ipod/i.test(ua) ||
    (/macintosh/i.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1);
  const helpText = ios
    ? "To install: tap the Share button in your browser, then “Add to Home Screen”."
    : "To install: open your browser menu and choose “Install app” or “Add to Home screen”.";
  return (
    <footer className="install-footer no-print">
      {p.installed ? (
        <span className="if-done">✓ eyeKnow is installed — open it from your home screen</span>
      ) : (
        <button
          type="button"
          className="if-install"
          onClick={() => (p.canInstall ? p.onInstall() : setHelp((v) => !v))}
        >
          📲 Install eyeKnow
        </button>
      )}
      {p.accountEmail ? (
        <span className="if-account">
          <span className="if-email">{p.accountEmail}</span>
          {p.isAdmin && (
            <button
              type="button"
              className="if-link"
              onClick={() => { window.location.href = "/admin"; }}
            >
              Admin
            </button>
          )}
          <button type="button" className="if-link" onClick={p.onSignOut}>
            Sign out
          </button>
        </span>
      ) : (
        <button type="button" className="if-link" onClick={p.onSignIn}>
          Sign in
        </button>
      )}
      {help && !p.installed && <p className="if-help">{helpText}</p>}
    </footer>
  );
}
