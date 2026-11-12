"use client";

import { useEffect, useRef, useState } from "react";
import type { ScanRecord } from "@/lib/chart";
import { SIGN_COLORS } from "@/lib/chart";
import IrisIllustration from "./IrisIllustration";
import PlotPhoto, { type PlotDot } from "./PlotPhoto";

/** The report's iris visual (Adam, 2026-11-02): the illustration
 *  and the photo with its points, back to back — swipe sideways
 *  on the iris to flip between them with a 3D card flip (the
 *  rotate button was replaced by the swipe, and the zoom buttons
 *  and reset removed, at Adam's direction). The photo plots
 *  EVERY sign the reader found (numbered where the findings list
 *  numbers them — in a locked preview the rest are smaller plain
 *  dots, the standing rule). The iris itself is zoomable —
 *  pinch, double-tap, drag to pan — while the page and the
 *  container stay fixed: only the iris scales, inside its own
 *  box. Swiping flips only at 1×; while zoomed, a drag pans. */
interface Zoom {
  s: number;
  x: number;
  y: number;
}
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;

export default function IrisFlip({
  scan,
  fullScan,
  personReps,
  onSelectEye,
}: {
  /** Display scan: preview-capped + confidence-sorted when locked;
   *  its marker order is the findings numbering. */
  scan: ScanRecord;
  /** The full scan — every marker, for the illustration + dots. */
  fullScan: ScanRecord;
  /** The person's representative scans — the eye-icon switch
   *  under the iris (moved here from beside the date, and the
   *  big Left/Right buttons dropped, Adam, 2026-11-02). */
  personReps?: ScanRecord[];
  onSelectEye?: (rep: ScanRecord) => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const [zoom, setZoom] = useState<Zoom>({ s: 1, x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ d: number; mid: { x: number; y: number } } | null>(null);
  const swipeRef = useRef<{
    id: number;
    x0: number;
    y0: number;
    done: boolean;
    vertical: boolean;
  } | null>(null);

  // A new scan starts unzoomed, on the illustration.
  useEffect(() => {
    setZoom({ s: 1, x: 0, y: 0 });
    setFlipped(false);
  }, [fullScan.id]);

  const numbered = new Map(scan.markers.map((m, i) => [m.id, i + 1]));
  const dots: PlotDot[] = fullScan.markers.map((m) => {
    const n = numbered.get(m.id);
    return {
      key: m.id,
      x: m.x,
      y: m.y,
      className: n ? "report-dot" : "report-dot extra",
      style: {
        background: SIGN_COLORS[m.sign].bg,
        color: SIGN_COLORS[m.sign].fg,
      },
      children: n ?? "",
    };
  });

  const clampPan = (z: Zoom): Zoom => {
    const el = stageRef.current;
    if (!el) return z;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const mx = ((z.s - 1) * w) / 2;
    const my = ((z.s - 1) * h) / 2;
    return {
      s: z.s,
      x: Math.min(mx, Math.max(-mx, z.x)),
      y: Math.min(my, Math.max(-my, z.y)),
    };
  };

  /** Zoom to scale `sNew`, keeping the stage point `f` (px,
   *  relative to the stage's top-left) stationary. */
  const zoomAt = (sNew: number, f: { x: number; y: number }) => {
    const el = stageRef.current;
    if (!el) return;
    const z = zoomRef.current;
    const s = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, sNew));
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    const fx = f.x - cx;
    const fy = f.y - cy;
    const x = fx - (s * (fx - z.x)) / z.s;
    const y = fy - (s * (fy - z.y)) / z.s;
    setZoom(clampPan({ s, x: s === 1 ? 0 : x, y: s === 1 ? 0 : y }));
  };

  const stagePoint = (clientX: number, clientY: number) => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      swipeRef.current = null;
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = {
        d: Math.hypot(a.x - b.x, a.y - b.y),
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
    } else if (pointersRef.current.size === 1 && zoomRef.current.s <= 1) {
      // A sideways swipe at 1× flips between photo and
      // illustration; a mostly-vertical gesture is a page scroll
      // and cancels the swipe.
      swipeRef.current = {
        id: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        done: false,
        vertical: false,
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const pts = pointersRef.current;
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId)!;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const sw = swipeRef.current;
    if (sw && sw.id === e.pointerId && !sw.done) {
      const dx = e.clientX - sw.x0;
      const dy = e.clientY - sw.y0;
      if (!sw.vertical && Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) {
        sw.vertical = true;
      } else if (!sw.vertical && Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        sw.done = true;
        setFlipped((f) => !f);
      }
    }
    if (pinchRef.current && pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const z = zoomRef.current;
      const k = pinchRef.current.d > 0 ? d / pinchRef.current.d : 1;
      // Zoom toward the moving pinch midpoint, then follow it.
      const f = stagePoint(mid.x, mid.y);
      const s = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z.s * k));
      const el = stageRef.current!;
      const fx = f.x - el.clientWidth / 2;
      const fy = f.y - el.clientHeight / 2;
      const x = fx - (s * (fx - z.x)) / z.s + (mid.x - pinchRef.current.mid.x);
      const y = fy - (s * (fy - z.y)) / z.s + (mid.y - pinchRef.current.mid.y);
      pinchRef.current = { d, mid };
      setZoom(clampPan({ s, x: s === 1 ? 0 : x, y: s === 1 ? 0 : y }));
    } else if (pts.size === 1 && zoomRef.current.s > 1) {
      const z = zoomRef.current;
      setZoom(
        clampPan({ s: z.s, x: z.x + (e.clientX - prev.x), y: z.y + (e.clientY - prev.y) }),
      );
    }
  };

  const endPointer = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (swipeRef.current?.id === e.pointerId) swipeRef.current = null;
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (zoomRef.current.s > 1) setZoom({ s: 1, x: 0, y: 0 });
    else zoomAt(2.4, stagePoint(e.clientX, e.clientY));
  };

  // Wheel zoom (ctrl+wheel, or plain wheel once zoomed) without
  // scrolling the page — needs a non-passive listener.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const z = zoomRef.current;
      if (!e.ctrlKey && z.s <= 1) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const f = { x: e.clientX - r.left, y: e.clientY - r.top };
      const cx = el.clientWidth / 2;
      const cy = el.clientHeight / 2;
      const s = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z.s * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      const fx = f.x - cx;
      const fy = f.y - cy;
      const x = fx - (s * (fx - z.x)) / z.s;
      const y = fy - (s * (fy - z.y)) / z.s;
      const mx = ((s - 1) * el.clientWidth) / 2;
      const my = ((s - 1) * el.clientHeight) / 2;
      setZoom({
        s,
        x: s === 1 ? 0 : Math.min(mx, Math.max(-mx, x)),
        y: s === 1 ? 0 : Math.min(my, Math.max(-my, y)),
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomStyle: React.CSSProperties = {
    transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})`,
  };
  const zoomed = zoom.s > 1.01;

  return (
    <div className="iris-flip">
      <div
        className="iris-flip-stage"
        ref={stageRef}
        style={{ touchAction: zoomed ? "none" : "pan-y", cursor: zoomed ? "grab" : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onDoubleClick={onDoubleClick}
        onDragStart={(e) => e.preventDefault()}
      >
        <div className={`iris-flip-inner${flipped ? " flipped" : ""}`}>
          <div className="iris-flip-face front" aria-hidden={flipped}>
            <div className="iris-zoom" style={zoomStyle}>
              <IrisIllustration scan={fullScan} bare />
            </div>
          </div>
          <div className="iris-flip-face back" aria-hidden={!flipped}>
            <div className="iris-zoom" style={zoomStyle}>
              <PlotPhoto
                image={fullScan.image}
                alt="Your iris photo with the signs plotted on it"
                frameClass="report-iris flip-photo"
                dots={dots}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="iris-flip-controls no-print">
        {personReps && personReps.length > 1 && (
          <span className="eye-switch" role="group" aria-label="Choose iris">
            {(["left", "right"] as const).map((side) => {
              const rep = personReps.find((s) => s.eye === side);
              const isCurrent = fullScan.eye === side;
              if (!rep && !isCurrent) return null;
              const label = side === "left" ? "Left iris" : "Right iris";
              return (
                <button
                  key={side}
                  type="button"
                  className={`eye-icon-btn${isCurrent ? " on" : ""}`}
                  aria-label={label}
                  aria-pressed={isCurrent}
                  title={label}
                  disabled={isCurrent || !rep}
                  onClick={() => {
                    if (rep && rep.id !== fullScan.id) onSelectEye?.(rep);
                  }}
                >
                  <span className="eye-glyph" aria-hidden="true">👁</span>
                  <span className="eye-letter" aria-hidden="true">
                    {side === "left" ? "L" : "R"}
                  </span>
                </button>
              );
            })}
          </span>
        )}
      </div>
    </div>
  );
}
