"use client";

import { useEffect, useState } from "react";

/** Team PWA plumbing: registers the team service worker and, when
 *  the browser offers one, shows an install banner. Rendered by the
 *  team layout only — the consumer app keeps its own worker and
 *  install flow. iOS has no prompt event; the team page carries the
 *  Add to Home Screen hint for that case. */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

export default function TeamPwaSetup() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (
      "serviceWorker" in navigator &&
      (window.location.protocol === "https:" || window.location.hostname === "localhost")
    ) {
      navigator.serviceWorker.register("/team-sw.js").catch(() => undefined);
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!installEvent) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        flexWrap: "wrap",
        padding: "10px 16px",
        background: "#0d3b37",
        color: "#f3ead8",
      }}
    >
      <span>Install the eyeKnow Team app on this device.</span>
      <button
        type="button"
        className="btn"
        onClick={async () => {
          await installEvent.prompt().catch(() => undefined);
          setInstallEvent(null);
        }}
      >
        Install app
      </button>
      <button
        type="button"
        className="btn"
        onClick={() => setInstallEvent(null)}
        aria-label="Dismiss install banner"
      >
        Not now
      </button>
    </div>
  );
}
