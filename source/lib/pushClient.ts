// Browser side of the unlock-reminder push (Adam, 2026-11-05).
// Everything here is opt-in and fail-silent: without a configured
// public key, without notification permission, or without a service
// worker, nothing happens and nothing is stored.

export function pushPublicKey(): string {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    Boolean(pushPublicKey())
  );
}

function vapidKeyBytes(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out.buffer;
}

/** Subscribe this device (permission must already be granted) and
 *  arm the reminder for one scan. Returns true on success. */
export async function subscribeForScan(scanId: string): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    if (Notification.permission !== "granted") return false;
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKeyBytes(pushPublicKey()),
      });
    }
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), scanId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Ask for permission (from a user tap), then subscribe. */
export async function requestAndSubscribe(
  scanId: string,
): Promise<"done" | "denied" | "unsupported"> {
  if (!pushSupported()) return "unsupported";
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return "denied";
    return (await subscribeForScan(scanId)) ? "done" : "unsupported";
  } catch {
    return "unsupported";
  }
}
