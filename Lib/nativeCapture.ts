export interface NativeEyeCapture {
  display: string;
  analysis?: string;
  stackedFrames: number;
  source: "still" | "burst";
}

interface NativeReply {
  requestId: string;
  status: "captured" | "cancelled" | "error";
  capture?: NativeEyeCapture;
  message?: string;
}

interface NativeCaptureBridge {
  postMessage(message: string): void;
  onmessage: ((event: MessageEvent<string>) => void) | null;
}

declare global {
  interface Window {
    EyeknowCapture?: NativeCaptureBridge;
  }
}

let captureInProgress = false;

export function hasNativeEyeCapture(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.EyeknowCapture?.postMessage === "function"
  );
}

export async function requestNativeEyeCapture(
  eye: "left" | "right",
): Promise<NativeEyeCapture | null> {
  const bridge = window.EyeknowCapture;

  if (!bridge) {
    throw new Error("Native eye capture is unavailable.");
  }

  if (captureInProgress) {
    throw new Error("An eye capture is already in progress.");
  }

  captureInProgress = true;

  try {
    return await new Promise<NativeEyeCapture | null>(
      (resolve, reject) => {
        const requestId = crypto.randomUUID();
        const previousHandler = bridge.onmessage;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let settled = false;

        function finish(
          error: Error | null,
          capture: NativeEyeCapture | null = null,
        ) {
          if (settled) return;
          settled = true;

          if (timer !== undefined) clearTimeout(timer);
          bridge.onmessage = previousHandler;

          if (error) reject(error);
          else resolve(capture);
        }

        bridge.onmessage = (event) => {
          let reply: NativeReply;

          try {
            reply = JSON.parse(event.data) as NativeReply;
          } catch {
            return;
          }

          if (reply.requestId !== requestId) {
            previousHandler?.call(bridge, event);
            return;
          }

          if (reply.status === "cancelled") {
            finish(null);
            return;
          }

          if (reply.status === "error") {
            finish(
              new Error(reply.message || "Eye capture failed."),
            );
            return;
          }

          if (reply.status !== "captured") return;

          const capture = reply.capture;

          if (
            !capture ||
            typeof capture.display !== "string" ||
            !capture.display.startsWith("data:image/jpeg;base64,")
          ) {
            finish(new Error("The camera returned an invalid photo."));
            return;
          }

          finish(null, capture);
        };

        timer = setTimeout(() => {
          try {
            bridge.postMessage(
              JSON.stringify({
                type: "cancelEyeCapture",
                requestId,
              }),
            );
          } catch {
            // The native screen may already have closed.
          }

          finish(new Error("Eye capture timed out. Please try again."));
        }, 180_000);

        try {
          bridge.postMessage(
            JSON.stringify({
              type: "captureEye",
              requestId,
              eye,
            }),
          );
        } catch {
          finish(new Error("Could not open the native camera."));
        }
      },
    );
  } finally {
    captureInProgress = false;
  }
}
