"use client";

import { useEffect, useRef, useState } from "react";

/** Photo + marker plot that can never put a marker on letterbox bars.
 *
 * The stored scan image is normally a square crop and markers are
 * fractions of it — in that case this renders exactly like the old
 * plain <img> + % dots. But stored images are not always square
 * (older scans, uploads), and at least one real scan's stored image
 * carries the photo in only the top-left ~56% of a square canvas with
 * the rest black. A plain object-fit: cover + raw % dots misplaces
 * markers in both cases: the cover crop shifts them, and bars put
 * them on black.
 *
 * So this component measures the image and maps every marker through
 * the rect that is ACTUALLY displayed:
 *  1. The photo-content box inside the image, found by scanning pixels
 *     (bars are near-black; skin/sclera/iris are not). Falls back to
 *     the full image when detection fails or the image is opaque to
 *     canvas (tainted), so the worst case is today's behavior.
 *  2. The center-square crop of that box, which is what fills the
 *     square frame with no bars, no squish, and the iris centered.
 * Markers outside the displayed rect are not plotted at all — a sign
 * whose point is not in the displayed photo has no honest position
 * on it, and a half-clipped badge at the frame edge is worse than
 * none. Dots stay hidden until geometry resolves, so a marker never
 * flashes at a wrong position first.
 */

export interface PlotDot {
  key: string;
  /** Fractions of the stored image (the reader's coordinate space). */
  x: number;
  y: number;
  className: string;
  style?: React.CSSProperties;
  title?: string;
  children?: React.ReactNode;
  /** Dot diameter in px, for keeping badges fully inside the frame. */
  sizePx?: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function detectPhotoBox(img: HTMLImageElement): Box | null {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) return null;
  try {
    const scale = Math.min(1, 512 / Math.max(iw, ih));
    const w = Math.max(1, Math.round(iw * scale));
    const h = Math.max(1, Math.round(ih * scale));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    const rowBright = new Float32Array(h);
    const colBright = new Float32Array(w);
    const rowCount = new Uint32Array(h);
    const colCount = new Uint32Array(w);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        if (lum > 24) {
          rowCount[y]++;
          colCount[x]++;
        }
      }
    }
    for (let y = 0; y < h; y++) rowBright[y] = rowCount[y] / w;
    for (let x = 0; x < w; x++) colBright[x] = colCount[x] / h;
    let x0 = -1;
    let x1 = -1;
    let y0 = -1;
    let y1 = -1;
    for (let x = 0; x < w; x++) {
      if (colBright[x] > 0.03) {
        if (x0 < 0) x0 = x;
        x1 = x;
      }
    }
    for (let y = 0; y < h; y++) {
      if (rowBright[y] > 0.03) {
        if (y0 < 0) y0 = y;
        y1 = y;
      }
    }
    if (x0 < 0 || y0 < 0) return null;
    // No padding: padding would reintroduce a sliver of the very bars
    // this box exists to exclude. Rows/cols need >3% bright pixels to
    // count, so dark photo edges survive; only near-black bars drop.
    // Essentially the whole image: call it full, no jitter.
    if (x0 <= w * 0.015 && y0 <= h * 0.015 && x1 >= w * 0.985 && y1 >= h * 0.985) {
      return { x: 0, y: 0, w: iw, h: ih };
    }
    return {
      x: (x0 / w) * iw,
      y: (y0 / h) * ih,
      w: ((x1 - x0 + 1) / w) * iw,
      h: ((y1 - y0 + 1) / h) * ih,
    };
  } catch {
    return null;
  }
}

export default function PlotPhoto({
  image,
  alt,
  frameClass,
  dots,
  overlay,
}: {
  image: string;
  alt: string;
  /** Frame class from globals.css (report-iris, modal-iris): square,
   *  relative, overflow hidden. */
  frameClass: string;
  dots: PlotDot[];
  /** Optional overlay in image-fraction space (0–100 viewBox svg),
   *  rendered over exactly the displayed rect. */
  overlay?: React.ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [geom, setGeom] = useState<{
    iw: number;
    ih: number;
    sx: number;
    sy: number;
    s: number;
  } | null>(null);
  const [framePx, setFramePx] = useState(0);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setFramePx(el.getBoundingClientRect().width || 0);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setGeom(null);
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      if (!iw || !ih) return;
      const box = detectPhotoBox(img) ?? { x: 0, y: 0, w: iw, h: ih };
      const s = Math.min(box.w, box.h);
      if (s <= 0) return;
      setGeom({
        iw,
        ih,
        sx: box.x + (box.w - s) / 2,
        sy: box.y + (box.h - s) / 2,
        s,
      });
    };
    img.onerror = () => {
      if (!cancelled) setGeom(null);
    };
    img.src = image;
    return () => {
      cancelled = true;
    };
  }, [image]);

  // Displayed-rect geometry as % of the frame (square frame).
  const imgStyle: React.CSSProperties | undefined = geom
    ? {
        position: "absolute",
        left: `${(-geom.sx / geom.s) * 100}%`,
        top: `${(-geom.sy / geom.s) * 100}%`,
        width: `${(geom.iw / geom.s) * 100}%`,
        height: `${(geom.ih / geom.s) * 100}%`,
        // The global img { max-width: 100% } rule would otherwise cap
        // the width and stretch the photo vertically — the exact
        // distortion this component exists to prevent.
        maxWidth: "none",
        maxHeight: "none",
        objectFit: "fill",
      }
    : undefined;

  const mapDot = (d: PlotDot): { left: string; top: string } | null => {
    if (!geom) return null;
    const px = d.x * geom.iw;
    const py = d.y * geom.ih;
    const fx = (px - geom.sx) / geom.s;
    const fy = (py - geom.sy) / geom.s;
    // Keep the whole badge inside the frame: hide anything whose
    // center is outside the displayed rect or too close to its edge.
    const margin = framePx > 0 ? ((d.sizePx ?? 24) / 2 + 2) / framePx : 0.04;
    if (fx < margin || fx > 1 - margin || fy < margin || fy > 1 - margin) return null;
    return { left: `${fx * 100}%`, top: `${fy * 100}%` };
  };

  return (
    <div ref={frameRef} className={frameClass}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt={alt} style={imgStyle} />
      {geom && overlay && (
        <div style={{ position: "absolute", ...imgStyle }}>{overlay}</div>
      )}
      {geom &&
        dots.map((d) => {
          const pos = mapDot(d);
          if (!pos) return null;
          return (
            <span
              key={d.key}
              className={d.className}
              style={{ ...d.style, ...pos }}
              title={d.title}
            >
              {d.children}
            </span>
          );
        })}
    </div>
  );
}
