"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { APP_VERSION, BUILD_ID, BUILT_AT } from "../lib/build-stamp";
import { REFMARK_KEY, readPngText } from "../lib/refmark";

/* Diagnostics (Adam, 2026-11-05; hidden modal 2026-11-06): the
   app version + build line stays visible where this component
   sits (bottom of /creator and inside the creator & books
   modal). Everything else moved into a hidden debug modal that
   opens when the build line is tapped 7 times — the Android
   developer-options gesture. All data is the visitor's own
   browser; cookie values are never shown except the affiliate
   referral code, which is public by design. */
type Diag = {
  cookieEnabled: boolean;
  cookieLine: string;
  refLine: string;
  lsLine: string;
  screen: string;
  dpr: number;
};

const TAPS_TO_OPEN = 7;

export default function AppDiagnostics() {
  const [open, setOpen] = useState(false);
  const [taps, setTaps] = useState(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleTap() {
    if (tapTimer.current) clearTimeout(tapTimer.current);
    const n = taps + 1;
    if (n >= TAPS_TO_OPEN) {
      setTaps(0);
      setOpen(true);
      return;
    }
    setTaps(n);
    tapTimer.current = setTimeout(() => setTaps(0), 3000);
  }

  const remaining = TAPS_TO_OPEN - taps;

  return (
    <div
      style={{
        marginTop: 22,
        paddingTop: 12,
        borderTop: "1px solid rgba(127,127,127,0.25)",
        fontSize: "0.72rem",
        lineHeight: 1.6,
        color: "var(--ink-soft)",
        textAlign: "left",
      }}
    >
      <div
        onClick={handleTap}
        role="button"
        aria-label="App version and build"
        style={{ cursor: "pointer", userSelect: "none", WebkitUserSelect: "none" }}
      >
        App version {APP_VERSION} · build {BUILD_ID} · {BUILT_AT}
        {taps >= 4 && (
          <span>
            {" "}
            · {remaining} tap{remaining === 1 ? "" : "s"} to debug
          </span>
        )}
      </div>
      {open && <DebugModal onClose={() => setOpen(false)} />}
    </div>
  );
}

/** The hidden debug modal: every diagnostic line that used to
 *  sit in the footer, collected fresh each time it opens. */
function DebugModal({ onClose }: { onClose: () => void }) {
  const [d, setD] = useState<Diag | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => {
    try {
      const raw = document.cookie ? document.cookie.split("; ").filter(Boolean) : [];
      const cookies = raw.map((c) => {
        const i = c.indexOf("=");
        return { name: i >= 0 ? c.slice(0, i) : c, size: c.length, value: i >= 0 ? c.slice(i + 1) : "" };
      });
      const refCookie = cookies.find((c) => c.name === "iris_ref")?.value || null;
      let shownRef = refCookie;
      if (shownRef) {
        try { shownRef = decodeURIComponent(shownRef); } catch { /* keep raw */ }
      }
      let lsRef: string | null = null;
      let lsPrice: number | null = null;
      try {
        lsRef = window.localStorage.getItem("iris_ref");
        const p = window.localStorage.getItem("iris_ref_price");
        if (p && Number.isFinite(Number(p))) lsPrice = Number(p);
      } catch { /* storage blocked */ }
      const cookieLine =
        cookies.length === 0
          ? "none visible"
          : cookies
              .map((c) => (c.name === "iris_ref" && shownRef ? `iris_ref = ${shownRef}` : `${c.name} (${c.size} B)`))
              .join(" · ");
      let lsLine = "unavailable";
      try {
        const keys: string[] = [];
        let total = 0;
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (!k) continue;
          const v = window.localStorage.getItem(k) ?? "";
          total += k.length + v.length;
          keys.push(`${k} (${v.length} B)`);
        }
        lsLine = keys.length ? `${keys.length} item${keys.length === 1 ? "" : "s"} · ${total} B — ${keys.join(" · ")}` : "empty";
      } catch {
        lsLine = "blocked";
      }
      const ref = shownRef ?? lsRef;
      const refLine = ref
        ? `code ${ref}${lsRef ? " · mirrored in local storage" : ""}${lsPrice ? ` · display price $${(lsPrice / 100).toFixed(2)} cached` : ""}`
        : "none on this device";
      setD({
        cookieEnabled: navigator.cookieEnabled,
        cookieLine,
        refLine,
        lsLine,
        screen: `${window.screen.width} × ${window.screen.height}`,
        dpr: window.devicePixelRatio || 1,
      });
    } catch {
      setD(null);
    }
  }, []);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(6, 20, 18, 0.72)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Debug info"
        style={{
          background: "#fffdf5",
          color: "#22312b",
          width: "100%",
          maxWidth: 560,
          maxHeight: "82vh",
          overflowY: "auto",
          borderRadius: "16px 16px 0 0",
          padding: "18px 18px calc(18px + env(safe-area-inset-bottom))",
          fontSize: "0.78rem",
          lineHeight: 1.65,
          textAlign: "left",
          boxShadow: "0 -12px 40px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <b style={{ fontSize: "0.95rem" }}>Debug info</b>
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div>
          App version {APP_VERSION} · build {BUILD_ID} · {BUILT_AT}
        </div>
        {d ? (
          <>
            <div>
              Cookies: {d.cookieEnabled ? "enabled" : "blocked"} · {d.cookieLine}
            </div>
            <div>Referral: {d.refLine}</div>
            <div>Local storage: {d.lsLine}</div>
            <RefmarkLine />
            <div>
              Pixels: no tracking pixels — no Meta Pixel, Google Analytics, or third-party trackers ·
              Screen {d.screen} @ {d.dpr}×
            </div>
          </>
        ) : (
          <div>Reading this browser…</div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** The third referral layer, made visible: fetches the refmark
 *  logo the way recovery does (force-cache) and reports what
 *  data the image itself carries — the referral code stamped in
 *  its PNG text chunk. */
function RefmarkLine() {
  const [line, setLine] = useState<string>("checking the cached logo…");
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch("/api/refmark", { cache: "force-cache", credentials: "same-origin" });
        const buf = new Uint8Array(await res.arrayBuffer());
        const code = readPngText(buf, REFMARK_KEY);
        if (!live) return;
        setLine(
          code
            ? `logo image (${buf.length} B) carries referral code ${code} in its PNG text chunk`
            : `logo image (${buf.length} B) — no stamped code in this browser's cache`,
        );
      } catch {
        if (live) setLine("logo image — could not be read");
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  return <div>Image data: {line}</div>;
}
