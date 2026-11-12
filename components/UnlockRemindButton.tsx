"use client";

import { useEffect, useState } from "react";
import { pushSupported, requestAndSubscribe, subscribeForScan } from "../lib/pushClient";

// Paywall opt-in for the unlock reminder (Adam, 2026-11-05): one tap
// asks for notification permission and arms up to two reminders about
// THIS reading if it stays locked. Renders nothing when push isn't
// available on this device or isn't configured — never a dead button.
export default function UnlockRemindButton({ scanId }: { scanId: string }) {
  const [state, setState] = useState<"hidden" | "idle" | "busy" | "done" | "denied">("hidden");

  useEffect(() => {
    if (!pushSupported()) return;
    if (Notification.permission === "granted") {
      void subscribeForScan(scanId).then((ok) => setState(ok ? "done" : "idle"));
    } else if (Notification.permission === "default") {
      setState("idle");
    }
  }, [scanId]);

  if (state === "hidden") return null;
  if (state === "done") {
    return (
      <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
        🔔 You&apos;re set — if this reading stays locked, we&apos;ll send a reminder. Just
        the one nudge or two, never a stream.
      </p>
    );
  }
  return (
    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        className="btn ghost"
        disabled={state === "busy"}
        onClick={async () => {
          setState("busy");
          const r = await requestAndSubscribe(scanId);
          setState(r === "done" ? "done" : r === "denied" ? "denied" : "hidden");
        }}
      >
        {state === "busy" ? "Setting it up…" : "🔔 Remind me to unlock this reading"}
      </button>
      {state === "denied" && (
        <p className="muted" style={{ marginTop: 6, marginBottom: 0 }}>
          Notifications are off for eyeKnow in your browser settings, so no reminder can be
          sent — your reading stays saved here either way.
        </p>
      )}
    </div>
  );
}
