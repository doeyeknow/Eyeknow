"use client";

/**
 * Auto-print the full flier PDF through JSPrintManager (Adam,
 * 2026-11-05): when the affiliate turns this on, the panel connects
 * to the JSPrintManager app installed on THIS device (a small free
 * client from Neodynamic — browsers alone cannot reach printers
 * silently), snapshots the printers it can already see, and then
 * polls: the moment a NEW printer appears, the full all-designs
 * flier PDF is sent to that printer. Guards: once per printer per
 * 30 minutes, and jobs are spaced out, so a flaky wifi printer
 * dropping in and out cannot burn through paper. A license
 * (NEXT_PUBLIC_JSPM_LICENSE_URL) removes Neodynamic's trial mode;
 * without one the integration still runs, in their trial mode.
 */
import { useEffect, useRef, useState } from "react";

const STORE_KEY = "eyeknow-autoprint-jspm";
const POLL_MS = 12_000;
const JOB_GAP_MS = 90_000;
const SAME_PRINTER_MS = 30 * 60_000;

type Props = {
  /** Fliers are built (singles ready to compose). */
  ready: boolean;
  pageCount: number;
  /** Changes when the referral link changes (PDF cache key). */
  pdfKey: string;
  getPdfBlob: () => Promise<Blob | null>;
};

export default function FlierAutoPrint({ ready, pageCount, pdfKey, getPdfBlob }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState("Off");
  const [connected, setConnected] = useState(false);

  const jspmRef = useRef<any>(null);
  const knownRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<string[]>([]);
  const printedRef = useRef<Map<string, number>>(new Map());
  const lastJobRef = useRef(0);
  const busyRef = useRef(false);
  const pdfCacheRef = useRef<{ key: string; blob: Blob } | null>(null);
  const getPdfRef = useRef(getPdfBlob);
  getPdfRef.current = getPdfBlob;
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const pageCountRef = useRef(pageCount);
  pageCountRef.current = pageCount;

  useEffect(() => {
    try {
      setEnabled(window.localStorage.getItem(STORE_KEY) === "1");
    } catch {
      /* storage blocked: stays off until toggled */
    }
  }, []);

  function toggle() {
    setEnabled((on) => {
      const next = !on;
      try {
        window.localStorage.setItem(STORE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      if (!next) setStatus("Off");
      return next;
    });
  }

  async function printerNames(JSPM: any): Promise<string[]> {
    const list: any = await JSPM.JSPrintManager.getPrinters();
    if (!Array.isArray(list)) return [];
    return list
      .map((p: any) => (typeof p === "string" ? p : p?.name))
      .filter((n: any): n is string => typeof n === "string" && n.length > 0);
  }

  async function sendJob(printer: string) {
    const JSPM = jspmRef.current;
    if (!JSPM) return;
    busyRef.current = true;
    try {
      setStatus(`Preparing the ${pageCountRef.current}-design PDF…`);
      let blob: Blob | null = null;
      if (pdfCacheRef.current && pdfCacheRef.current.key === pdfKey) {
        blob = pdfCacheRef.current.blob;
      } else {
        blob = await getPdfRef.current();
        if (blob) pdfCacheRef.current = { key: pdfKey, blob };
      }
      if (!blob) {
        setStatus("Fliers are not built yet — set your link name first.");
        return;
      }
      const cpj = new JSPM.ClientPrintJob();
      const printerObj = new JSPM.InstalledPrinter(printer);
      printerObj.printToDefaultIfNotFound = false;
      cpj.clientPrinter = printerObj;
      cpj.files.push(
        new JSPM.PrintFilePDF(blob, JSPM.FileSourceType.BLOB, "eyeknow-fliers.pdf", 1),
      );
      setStatus(`Sending ${pageCountRef.current} flier designs to ${printer}…`);
      await cpj.sendToClient();
      printedRef.current.set(printer, Date.now());
      lastJobRef.current = Date.now();
      setStatus(
        `Sent all ${pageCountRef.current} flier designs to ${printer} — ${new Date().toLocaleTimeString()}`,
      );
    } catch {
      setStatus(`Could not print to ${printer} — is it on and reachable?`);
    } finally {
      busyRef.current = false;
    }
  }

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    (async () => {
      setStatus("Looking for the JSPrintManager app on this device…");
      try {
        if (!jspmRef.current) {
          let mod: any;
          try {
            mod = await import("jsprintmanager");
          } catch {
            if (!live) return;
            setConnected(false);
            setStatus(
              "The print library file couldn't load — fully close and reopen the app, check your connection, then turn this on again.",
            );
            return;
          }
          jspmRef.current = mod?.JSPrintManager ? mod : (mod?.default ?? mod);
          const lic = process.env.NEXT_PUBLIC_JSPM_LICENSE_URL;
          if (lic && jspmRef.current.JSPrintManager) {
            try {
              jspmRef.current.JSPrintManager.license_url = lic;
            } catch {
              /* trial mode */
            }
          }
        }
        const JSPM = jspmRef.current;
        JSPM.JSPrintManager.auto_reconnect = true;
        // start() alone is not proof of a connection — its promise
        // can settle before the socket is really open, and it can
        // reject while auto-reconnect later succeeds. The socket
        // status is the truth (WSStatus: 0 Open, 2 Blocked,
        // 3 WaitingForUserResponse, 4 NotInstalled, 5 CertError).
        await JSPM.JSPrintManager.start().catch(() => undefined);
        const wsStatus = (): number =>
          typeof JSPM.JSPrintManager.WS?.status === "number"
            ? JSPM.JSPrintManager.WS.status
            : -1;
        let st = wsStatus();
        const t0 = Date.now();
        while (st !== 0 && Date.now() - t0 < 65_000) {
          if (!live) return;
          if (st === 4 || st === 5 || st === 2) break;
          if (st === 3) {
            setStatus(
              "The JSPrintManager app is asking permission — open the app and allow this website. Waiting…",
            );
          }
          if (st !== 3 && Date.now() - t0 > 20_000) break;
          await new Promise((r) => setTimeout(r, 1000));
          st = wsStatus();
        }
        if (!live) return;
        if (st !== 0) {
          setConnected(false);
          setStatus(
            st === 4
              ? "The JSPrintManager app isn't installed on this device (or isn't running). Install the free JSPrintManager app, open it once so it's running, then turn this off and on."
              : st === 5
                ? "The app answered, but the browser rejected its security certificate. Open the JSPrintManager app once — that usually clears it — then turn this off and on."
                : st === 2
                  ? "The JSPrintManager app blocked this website. Open the app, allow eyeknow.app, then turn this off and on."
                  : "The JSPrintManager app isn't answering. Make sure it's installed and open on this device, then turn this off and on.",
          );
          return;
        }
        const baseline = await printerNames(JSPM);
        if (!live) return;
        knownRef.current = new Set(baseline);
        setConnected(true);
        setStatus(
          baseline.length
            ? `Watching — ${baseline.length} printer${baseline.length === 1 ? "" : "s"} on this device. A new one gets all ${pageCountRef.current} fliers automatically.`
            : `Watching — no printers yet. The first one that appears gets all ${pageCountRef.current} fliers.`,
        );
        timer = setInterval(async () => {
          if (!live || busyRef.current) return;
          let names: string[];
          try {
            names = await printerNames(JSPM);
          } catch {
            return;
          }
          if (!live) return;
          const now = Date.now();
          const current = new Set(names);
          // Printers that vanished stop being "known", so a genuine
          // return counts as a new detection (still rate-limited).
          for (const n of Array.from(knownRef.current)) {
            if (!current.has(n)) knownRef.current.delete(n);
          }
          for (const n of names) {
            if (!knownRef.current.has(n)) {
              knownRef.current.add(n);
              const last = printedRef.current.get(n) ?? 0;
              if (now - last > SAME_PRINTER_MS && !queueRef.current.includes(n)) {
                queueRef.current.push(n);
              }
            }
          }
          if (
            queueRef.current.length > 0 &&
            now - lastJobRef.current >= JOB_GAP_MS &&
            readyRef.current
          ) {
            const next = queueRef.current.shift();
            if (next) {
              lastJobRef.current = now;
              void sendJob(next);
            }
          }
        }, POLL_MS);
      } catch (e) {
        if (!live) return;
        setConnected(false);
        setStatus(
          `Something failed while connecting (${(e as Error)?.name || "Error"}: ${(e as Error)?.message || "unknown"}). Turn this off and on to retry.`,
        );
      }
    })();

    return () => {
      live = false;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pdfKey]);

  function testPrint() {
    const first = knownRef.current.values().next().value as string | undefined;
    if (first) {
      lastJobRef.current = Date.now();
      void sendJob(first);
    } else {
      setStatus("No printer is visible to JSPrintManager yet.");
    }
  }

  return (
    <div
      style={{
        marginTop: 14,
        border: "1px solid rgba(216, 178, 90, 0.35)",
        borderRadius: 10,
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <b>🖨 Auto-print fliers — JSPrintManager</b>
        <button
          type="button"
          className={enabled ? "btn" : "btn ghost"}
          onClick={toggle}
          aria-pressed={enabled}
        >
          {enabled ? "On — watching" : "Turn on"}
        </button>
      </div>
      <p className="muted" style={{ margin: "8px 0 0" }}>
        When a <b>new printer</b> shows up on this device, the full {pageCount}-design
        flier PDF prints to it automatically — once per printer. Needs the free{" "}
        <b>JSPrintManager app</b> installed on this device (Windows, Mac, Linux,
        Android). Printers already visible when you turn this on are counted as
        known, so nothing prints until a new one appears.
      </p>
      <p className="muted" style={{ margin: "6px 0 0" }}>
        Status: {status}
      </p>
      {connected && ready && (
        <button
          type="button"
          className="btn ghost"
          style={{ marginTop: 8 }}
          onClick={testPrint}
        >
          Send one copy to the first printer now (test)
        </button>
      )}
    </div>
  );
}
