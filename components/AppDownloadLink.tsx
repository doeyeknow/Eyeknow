"use client";

// Android-app button on the capture step. Tapping it opens a modal
// describing what the native app does, with the download inside it.
// Android browsers only, and never inside the app itself (detected via
// the synchronously-injected native object, so the button can never
// flash in before the capture shim lands). The stored referral code
// rides along on the download link
// when there is one, so the downloaded APK is stamped for the
// affiliate — the same code checkout would credit. Inline styles only:
// globals.css is at the deploy cap. Theme values mirror the site's
// paper/gold palette via its CSS variables, with fallbacks.
import { useEffect, useState } from "react";
import { getReferralCode, REFERRAL_CHANGED_EVENT } from "./ReferralCapture";
import { isNativeShell } from "@/lib/nativeCapture";
import { isValidRefValue } from "@/lib/affiliates-client";

const FEATURES: Array<{ title: string; text: string }> = [
  {
    title: "Macro camera",
    text: "Uses your phone's closest-focusing rear lens, with the light on, tap-to-focus, and pinch zoom.",
  },
  {
    title: "Auto-capture",
    text: "Takes the photo the moment an iris is detected in focus and held steady — no shutter tap.",
  },
  {
    title: "Auto-crop",
    text: "Frames the iris and sends it straight to your reading. If the framing is off, it shows you the crop screen instead of sending a bad photo.",
  },
  {
    title: "Rotate and full detail",
    text: "Turn the photo after capture, and crops keep the camera's full detail instead of a shrunken copy.",
  },
  {
    title: "Referral links open in the app",
    text: "Affiliate links land straight in the app with the affiliate's price, through to checkout.",
  },
];

export default function AppDownloadLink() {
  const [href, setHref] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!/Android/i.test(navigator.userAgent)) return;
    if (isNativeShell()) return;
    const refresh = () => {
      const code = getReferralCode();
      const stamped = Boolean(code && isValidRefValue(code));
      setHref(
        stamped
          ? `/api/app/download?ref=${encodeURIComponent(code as string)}`
          : "/api/app/download",
      );
    };
    refresh();
    window.addEventListener(REFERRAL_CHANGED_EVENT, refresh);
    return () =>
      window.removeEventListener(REFERRAL_CHANGED_EVENT, refresh);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  if (!href) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "block",
          margin: "18px auto 4px",
          padding: "12px 16px",
          width: "100%",
          maxWidth: 340,
          border: "1px solid var(--accent, #c9a227)",
          borderRadius: 999,
          background: "var(--card, #fffdf8)",
          color: "inherit",
          font: "inherit",
          cursor: "pointer",
        }}
      >
        <span style={{ display: "block", fontWeight: 700 }}>
          📱 Get the Android app
        </span>
        <span
          style={{ display: "block", fontSize: 13, opacity: 0.75, marginTop: 2 }}
        >
          Sharper macro photos with auto-capture
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="About the Android app"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(20, 18, 10, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--card, #fffdf8)",
              color: "#2b2620",
              border: "1px solid var(--accent, #c9a227)",
              borderRadius: 16,
              boxShadow: "var(--shadow, 0 10px 30px rgba(0,0,0,0.25))",
              maxWidth: 440,
              width: "100%",
              maxHeight: "calc(100dvh - 32px)",
              overflowY: "auto",
              padding: "20px 20px 16px",
              position: "relative",
              textAlign: "left",
            }}
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                border: "none",
                background: "none",
                font: "inherit",
                fontSize: 22,
                lineHeight: 1,
                padding: 8,
                cursor: "pointer",
                color: "inherit",
              }}
            >
              ×
            </button>
            <h3
              style={{
                margin: "0 32px 4px 0",
                fontFamily: "var(--font-display, Georgia, serif)",
                color: "var(--brand, #0d3b37)",
              }}
            >
              The eyeKnow Android app
            </h3>
            <p style={{ margin: "0 0 12px", lineHeight: 1.5, fontSize: "0.95rem" }}>
              The same readings, with a camera built for close-up iris photos.
            </p>
            <ul style={{ margin: "0 0 16px", paddingLeft: 18, display: "grid", gap: 8 }}>
              {FEATURES.map((f) => (
                <li key={f.title} style={{ lineHeight: 1.45, fontSize: "0.92rem" }}>
                  <b>{f.title}.</b> {f.text}
                </li>
              ))}
            </ul>
            <a
              href={href}
              style={{
                display: "block",
                padding: "12px 16px",
                borderRadius: 999,
                background: "var(--accent, #c9a227)",
                color: "#221d12",
                textAlign: "center",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              ⬇ Download the app
            </a>
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 13,
                lineHeight: 1.5,
                opacity: 0.75,
              }}
            >
              Your phone will ask you to allow installs from your browser —
              that&apos;s normal for apps downloaded outside the Play Store.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
