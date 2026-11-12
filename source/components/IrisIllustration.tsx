"use client";

import { useEffect, useRef, useState } from "react";
import type { IrisColor, ScanRecord } from "@/lib/chart";

/* The iris illustration — the FIRST version's design with its
 * colouring sampled from the scan's own photo (Adam: "the
 * coloring to be an exact match"), drawn in front of the viewer
 * in Adam's order (the animated build he asked for on
 * 2026-11-01): first the pupil, then the fibers and colouring,
 * then every sign one at a time. The finished frame is exactly
 * the static v1 drawing — ~1,500 segmented fibers in toned
 * wedges with mottling, fine grain, natural crypts, a wavy
 * collarette, a pupil pigment ruff, and a limbal ring, every
 * colour sampled from the photo (polar grid over the annulus,
 * tones from the photo's own percentiles, each fiber tinted by
 * the photo colour at its spot, each sign shaded from its local
 * photo colour). The colour-family palettes remain only as a
 * fallback when the photo cannot be sampled. The photo itself
 * never appears — it is only measured. Reduced motion and print
 * settle straight on the finished drawing. */

type RGB = [number, number, number];

// ------------------------------------------------------------------
// Finished-frame cache. The staged canvas build is expensive
// (~1,500 fibers plus per-sign steps), so once a scan's drawing
// settles, its final frame is snapshotted and every later mount
// shows the stored image instead of redrawing (Adam, 2026-11-06:
// "only draw the illustration once and then store and reuse that
// image across the site"). In-memory for the session, mirrored to
// localStorage (a few entries, size-guarded) across sessions.
const illusMem = new Map<string, string>();
const ILLUS_LS_PREFIX = "eyeknow-illus:";
const ILLUS_LS_INDEX = "eyeknow-illus-index";

function illusKey(
  scan: Pick<ScanRecord, "id" | "eye" | "color" | "markers" | "profile" | "image">,
): string {
  const fp = [
    scan.id,
    scan.eye,
    scan.color,
    String(scan.profile?.pupilRatio ?? ""),
    String(scan.markers.map((m) => m.id).join(",")),
    String((scan.image ?? "").length),
  ].join("|");
  return `${scan.id}:${(hashStr(fp) >>> 0).toString(36)}`;
}

function illusCacheGet(key: string): string | null {
  const hit = illusMem.get(key);
  if (hit) return hit;
  try {
    const stored = window.localStorage.getItem(ILLUS_LS_PREFIX + key);
    if (stored) {
      illusMem.set(key, stored);
      return stored;
    }
  } catch {
    /* storage unavailable */
  }
  return null;
}

function illusCacheSet(key: string, url: string): void {
  illusMem.set(key, url);
  if (url.length > 1_200_000) return; // too big to persist; session-only
  try {
    const ls = window.localStorage;
    let index: string[] = [];
    try {
      index = JSON.parse(ls.getItem(ILLUS_LS_INDEX) ?? "[]") as string[];
    } catch {
      index = [];
    }
    index = index.filter((k) => k !== key);
    index.push(key);
    while (index.length > 5) {
      const old = index.shift();
      if (old) ls.removeItem(ILLUS_LS_PREFIX + old);
    }
    try {
      ls.setItem(ILLUS_LS_PREFIX + key, url);
    } catch {
      // Quota: drop the stored frames and retry once.
      for (const k of index) ls.removeItem(ILLUS_LS_PREFIX + k);
      index = [key];
      ls.setItem(ILLUS_LS_PREFIX + key, url);
    }
    ls.setItem(ILLUS_LS_INDEX, JSON.stringify(index));
  } catch {
    /* memory-only */
  }
}

const TAU = Math.PI * 2;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function css(c: RGB, alpha = 1): string {
  return `rgba(${Math.round(clamp(c[0], 0, 255))}, ${Math.round(clamp(c[1], 0, 255))}, ${Math.round(
    clamp(c[2], 0, 255),
  )}, ${alpha})`;
}
function shade(c: RGB, f: number): RGB {
  return [c[0] * f, c[1] * f, c[2] * f];
}
function mix(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
function lum(c: RGB): number {
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Palette {
  ground: RGB;
  deep: RGB;
  fibers: RGB[];
  light: RGB;
  collarette: RGB;
  limbal: RGB;
  ruff: RGB;
  rust: RGB;
}

const PALETTES: Record<IrisColor, Palette> = {
  brown: {
    ground: [74, 46, 28],
    deep: [46, 27, 16],
    fibers: [
      [107, 66, 38],
      [125, 78, 42],
      [138, 90, 48],
      [90, 54, 32],
      [150, 102, 58],
    ],
    light: [196, 144, 92],
    collarette: [60, 36, 21],
    limbal: [40, 23, 13],
    ruff: [30, 17, 10],
    rust: [146, 74, 30],
  },
  blue: {
    ground: [47, 74, 102],
    deep: [29, 48, 71],
    fibers: [
      [74, 111, 150],
      [93, 132, 173],
      [60, 95, 130],
      [110, 148, 188],
      [52, 84, 120],
    ],
    light: [168, 196, 224],
    collarette: [36, 64, 92],
    limbal: [27, 50, 71],
    ruff: [18, 30, 44],
    rust: [150, 96, 52],
  },
  mixed: {
    ground: [84, 67, 42],
    deep: [56, 48, 30],
    fibers: [
      [119, 104, 60],
      [134, 113, 63],
      [95, 86, 48],
      [146, 128, 78],
      [104, 96, 52],
    ],
    light: [196, 172, 110],
    collarette: [70, 54, 32],
    limbal: [52, 44, 26],
    ruff: [34, 26, 16],
    rust: [150, 84, 36],
  },
};

/** The photo crop the markers live in: iris centre ~(0.5, 0.5),
 *  iris radius ~0.36 of the frame width (stored crops run
 *  0.34–0.37; the illustration normalises by it so a sign lands
 *  at the same relative place in the drawn iris). The sampled
 *  colour grid measures the true radius from the photo itself. */
const PHOTO_IRIS_R = 0.36;

/** A colour source for the renderer: flat tones plus the exact
 *  local colour at any (angle, annulus-depth) of the iris. */
interface ColorSource {
  pal: Palette;
  /** Exact photo colour at angle `theta`, depth `u` (0 = pupil
   *  edge, 1 = rim). Null in palette-fallback mode. */
  local: ((theta: number, u: number) => RGB) | null;
  /** Average colour just outside the iris (sclera/skin), to tint
   *  the backdrop wash. Null in fallback mode. */
  surround: RGB | null;
}

/** Measure the iris in the photo and build the sampled colour
 *  source: radius found by ray-casting for the limbal edge, then
 *  a polar grid (180 × 28) of averaged photo colours, with the
 *  flat tones taken from the grid's own luminance percentiles. */
function buildSampledSource(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  pupilRatio: number,
  fallback: Palette,
): ColorSource | null {
  const px = (x: number, y: number): RGB => {
    const xi = clamp(Math.round(x), 0, w - 1);
    const yi = clamp(Math.round(y), 0, h - 1);
    const i = (yi * w + xi) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const cx = w / 2;
  const cy = h / 2;
  const half = Math.min(w, h) / 2;

  // Iris radius: along each ray, the limbal boundary is the
  // strongest colour step in the outer half. Median across rays.
  const radii: number[] = [];
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * TAU;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let bestR = -1;
    let bestScore = -1;
    for (let r = half * 0.5; r < half * 0.97; r += 1.5) {
      const c0 = px(cx + dx * (r - 3), cy + dy * (r - 3));
      const c1 = px(cx + dx * (r + 3), cy + dy * (r + 3));
      const score =
        Math.abs(c1[0] - c0[0]) + Math.abs(c1[1] - c0[1]) + Math.abs(c1[2] - c0[2]);
      if (score > bestScore) {
        bestScore = score;
        bestR = r;
      }
    }
    if (bestR > 0 && bestScore > 36) radii.push(bestR);
  }
  if (radii.length < 24) return null;
  radii.sort((a, b) => a - b);
  const R = radii[Math.floor(radii.length / 2)];
  if (R < half * 0.45 || R > half * 0.99) return null;
  const pupilR = R * pupilRatio;

  // Polar colour grid over the annulus.
  const GA = 180;
  const GR = 28;
  const grid: RGB[][] = [];
  const cells: RGB[] = [];
  for (let ai = 0; ai < GA; ai++) {
    const theta = (ai / GA) * TAU;
    const row: RGB[] = [];
    for (let ri = 0; ri < GR; ri++) {
      const u = (ri + 0.5) / GR;
      const r = pupilR + u * (R - pupilR);
      const x = cx + Math.cos(theta) * r;
      const y = cy + Math.sin(theta) * r;
      // Average a small patch for stability.
      let sr = 0,
        sg = 0,
        sb = 0,
        n = 0;
      for (const [ox, oy] of [
        [0, 0],
        [-2, 0],
        [2, 0],
        [0, -2],
        [0, 2],
      ]) {
        const c = px(x + ox, y + oy);
        sr += c[0];
        sg += c[1];
        sb += c[2];
        n++;
      }
      const col: RGB = [sr / n, sg / n, sb / n];
      row.push(col);
      cells.push(col);
    }
    grid.push(row);
  }
  const local = (theta: number, u: number): RGB => {
    let t = theta % TAU;
    if (t < 0) t += TAU;
    const fa = (t / TAU) * GA;
    const a0 = Math.floor(fa) % GA;
    const a1 = (a0 + 1) % GA;
    const at = fa - Math.floor(fa);
    const fu = clamp(u, 0, 1) * GR - 0.5;
    const r0 = clamp(Math.floor(fu), 0, GR - 1);
    const r1 = clamp(r0 + 1, 0, GR - 1);
    const rt = clamp(fu - Math.floor(fu), 0, 1);
    return mix(mix(grid[a0][r0], grid[a1][r0], at), mix(grid[a0][r1], grid[a1][r1], at), rt);
  };

  // Flat tones from the photo's own annulus percentiles.
  const byLum = [...cells].sort((a, b) => lum(a) - lum(b));
  const at = (p: number) => byLum[clamp(Math.floor(p * byLum.length), 0, byLum.length - 1)];
  // Collarette band average (u ≈ 0.3), darkened — the band reads
  // darker than the field around it in most irises.
  let cr: RGB = [0, 0, 0];
  {
    let n = 0;
    for (let ai = 0; ai < GA; ai += 3) {
      const c = local((ai / GA) * TAU, 0.3);
      cr = [cr[0] + c[0], cr[1] + c[1], cr[2] + c[2]];
      n++;
    }
    cr = shade([cr[0] / n, cr[1] / n, cr[2] / n], 0.62);
  }
  const rim = at(0.5);
  const pal: Palette = {
    ground: shade(at(0.42), 0.92),
    deep: at(0.08),
    fibers: [at(0.25), at(0.45), at(0.6), at(0.35), at(0.72)],
    light: at(0.9),
    collarette: cr,
    limbal: shade(rim, 0.5),
    ruff: shade(at(0.12), 0.55),
    rust: fallback.rust,
  };
  // Surround: average just outside the rim at a few angles.
  let surround: RGB = [0, 0, 0];
  {
    let n = 0;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * TAU;
      const c = px(cx + Math.cos(a) * R * 1.12, cy + Math.sin(a) * R * 1.12);
      surround = [surround[0] + c[0], surround[1] + c[1], surround[2] + c[2]];
      n++;
    }
    surround = [surround[0] / n, surround[1] / n, surround[2] / n];
  }
  return { pal, local, surround };
}

interface Geom {
  pal: Palette;
  cx: number;
  cy: number;
  R: number;
  pupilR: number;
  annulus: number;
  pupilRatio: number;
  /** The measured pupil shape, when it read oval: the drawn pupil
   *  becomes this ellipse (radii already carry the draw scale). */
  pupilEllipse?: { rx: number; ry: number; rot: number };
  localAt: (x: number, y: number) => RGB | null;
}

export default function IrisIllustration({
  scan,
  bare = false,
  replayNonce = 0,
  still = false,
}: {
  scan: Pick<ScanRecord, "id" | "eye" | "color" | "markers" | "profile" | "image">;
  /** Canvas only, no figure/caption — for the flip view, whose
   *  caption and replay control live outside. */
  bare?: boolean;
  /** Paint the finished drawing at once, no staged build
   *  (the post-scan reveal's hook slide — Adam, 2026-11-05). */
  still?: boolean;
  /** Bump to replay the build from outside (bare mode). */
  replayNonce?: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const key = illusKey(scan);
  const [cachedUrl, setCachedUrl] = useState<string | null>(null);

  // Once the live build settles on its final frame — and the
  // photo-sampled colours have landed, when the scan has a photo —
  // snapshot the canvas into the cache and swap this mount to the
  // stored image too.
  useEffect(() => {
    if (cachedUrl) return;
    if (!replayNonce) {
      const hit = illusCacheGet(key);
      if (hit) {
        setCachedUrl(hit);
        return;
      }
    }
    const canvas = ref.current;
    if (!canvas) return;
    let stopped = false;
    let photoSettled = !scan.image;
    if (scan.image) {
      const im = new Image();
      im.onload = () => {
        photoSettled = true;
      };
      im.onerror = () => {
        photoSettled = true;
      };
      im.src = scan.image;
    }
    let snapTimer = 0;
    const iv = window.setInterval(() => {
      if (stopped) return;
      if (canvas.dataset.stage !== "final" || !photoSettled) return;
      window.clearInterval(iv);
      snapTimer = window.setTimeout(() => {
        if (stopped) return;
        try {
          const url = canvas.toDataURL("image/webp", 0.92);
          if (!url.startsWith("data:image/")) return;
          illusCacheSet(key, url);
          setCachedUrl(url);
        } catch {
          /* canvas not exportable — keep the live drawing */
        }
      }, 250);
    }, 350);
    return () => {
      stopped = true;
      window.clearInterval(iv);
      window.clearTimeout(snapTimer);
    };
  }, [scan, key, cachedUrl]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let cancelled = false;
    const timers: number[] = [];
    let raf = 0;
    const fallbackPal = PALETTES[scan.color] ?? PALETTES.brown;
    const pupilRatio = clamp(scan.profile?.pupilRatio ?? 0.33, 0.18, 0.5);
    const srcRef: { current: ColorSource } = {
      current: { pal: fallbackPal, local: null, surround: null },
    };
    const W = canvas.width;
    const H = canvas.height;

    const geomOf = (src: ColorSource): Geom => {
      const cx = W / 2;
      const cy = H / 2;
      const R = Math.min(W, H) * 0.44;
      // The drawn pupil is scaled down from the measured ratio —
      // at full measure it reads too big on the illustration
      // (Adam, 2026-11-03). Drawing geometry only: photo sampling
      // stays fraction-based, so colours and sign positions are
      // unaffected.
      const PUPIL_DRAW_SCALE = 0.8;
      const pupilR = R * pupilRatio * PUPIL_DRAW_SCALE;
      const annulus = R - pupilR;
      const localAt = (x: number, y: number): RGB | null => {
        if (!src.local) return null;
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.hypot(dx, dy);
        return src.local(Math.atan2(dy, dx), clamp((d - pupilR) / annulus, 0, 1));
      };
      const ps = scan.profile?.pupilShape;
      const pupilEllipse =
        ps?.form === "oval" && ps.aspect
          ? (() => {
              const k = Math.sqrt(ps.aspect);
              return {
                rx: pupilR * k,
                ry: pupilR / k,
                rot: (((ps.axisDeg ?? 0) - 90) * Math.PI) / 180,
              };
            })()
          : undefined;
      return { pal: src.pal, cx, cy, R, pupilR, annulus, pupilRatio, pupilEllipse, localAt };
    };

    const paintBackdrop = (c: CanvasRenderingContext2D, src: ColorSource, g: Geom) => {
      const grad = c.createRadialGradient(g.cx, g.cy, g.R * 0.2, g.cx, g.cy, Math.max(W, H) * 0.72);
      if (src.surround) {
        const tint = mix(src.surround, [247, 241, 227], 0.55);
        const edge = mix(src.surround, [227, 213, 186], 0.5);
        grad.addColorStop(0, css(tint));
        grad.addColorStop(0.7, css(mix(tint, edge, 0.5)));
        grad.addColorStop(1, css(edge));
      } else {
        grad.addColorStop(0, "#f7f1e3");
        grad.addColorStop(0.7, "#efe6d2");
        grad.addColorStop(1, "#e3d5ba");
      }
      c.fillStyle = grad;
      c.fillRect(0, 0, W, H);
    };

    const paintPupil = (c: CanvasRenderingContext2D, g: Geom, rand: () => number) => {
      const { cx, cy, pupilR, annulus, pal } = g;
      const el = g.pupilEllipse;
      // Boundary radius in direction a — the circle, or the measured
      // oval when the pupil read oval (Adam, 2026-11-04).
      const rAt = (a: number): number => {
        if (!el) return pupilR;
        const ca = Math.cos(a - el.rot);
        const sa = Math.sin(a - el.rot);
        return (el.rx * el.ry) / Math.hypot(el.ry * ca, el.rx * sa);
      };
      const pupilPath = (scale: number) => {
        c.beginPath();
        if (el) c.ellipse(cx, cy, el.rx * scale, el.ry * scale, el.rot, 0, TAU);
        else c.arc(cx, cy, pupilR * scale, 0, TAU);
      };
      pupilPath(1);
      c.fillStyle = "#0a0705";
      c.fill();
      for (let i = 0; i < 110; i++) {
        const a = rand() * TAU;
        const r0 = rAt(a) * (0.94 + rand() * 0.05);
        const r1 = rAt(a) + annulus * (0.02 + rand() * 0.05);
        c.strokeStyle = css(rand() < 0.5 ? pal.ruff : shade(pal.ground, 0.6), 0.35 + rand() * 0.4);
        c.lineWidth = 1 + rand() * 1.8;
        c.beginPath();
        c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        c.stroke();
      }
      pupilPath(0.99);
      c.strokeStyle = "rgba(0,0,0,0.55)";
      c.lineWidth = Math.max(1.4, g.R * 0.006);
      c.stroke();
    };

    /* The full field (backdrop → pupil), rendered offscreen in
     * one pass with the main seeded random sequence — the same
     * sequence the static drawing used, so the finished frame
     * is unchanged. */
    const renderField = (src: ColorSource): HTMLCanvasElement => {
      const off = document.createElement("canvas");
      off.width = W;
      off.height = H;
      const c = off.getContext("2d")!;
      const g = geomOf(src);
      const { cx, cy, R, pupilR, annulus, pal, localAt } = g;
      const rand = mulberry32(hashStr(`illustration:${scan.id}`));

      paintBackdrop(c, src, g);

      c.save();
      c.beginPath();
      c.arc(cx, cy, R, 0, TAU);
      c.clip();
      c.fillStyle = css(pal.ground);
      c.fillRect(cx - R, cy - R, R * 2, R * 2);
      if (src.local) {
        const GA = 180;
        const GR = 28;
        for (let ai = 0; ai < GA; ai++) {
          const t0 = (ai / GA) * TAU;
          const t1 = ((ai + 1.05) / GA) * TAU;
          for (let ri = 0; ri < GR; ri++) {
            const u0 = ri / GR;
            const u1 = (ri + 1.06) / GR;
            const r0 = pupilR + u0 * annulus;
            const r1 = pupilR + u1 * annulus;
            c.beginPath();
            c.arc(cx, cy, r1, t0, t1);
            c.arc(cx, cy, r0, t1, t0, true);
            c.closePath();
            c.fillStyle = css(src.local(((ai + 0.5) / GA) * TAU, (ri + 0.5) / GR));
            c.fill();
          }
        }
      }
      {
        const wedges = 30;
        for (let i = 0; i < wedges; i++) {
          const a0 = (i / wedges) * TAU;
          const a1 = ((i + 1.6) / wedges) * TAU;
          const tone = pal.fibers[Math.floor(rand() * pal.fibers.length)];
          c.beginPath();
          c.moveTo(cx, cy);
          c.arc(cx, cy, R, a0, a1);
          c.closePath();
          c.fillStyle = css(rand() < 0.5 ? tone : pal.deep, 0.05 + rand() * 0.07);
          c.fill();
        }
        for (let i = 0; i < 130; i++) {
          const a = rand() * TAU;
          const rr = pupilR + rand() * annulus;
          const x = cx + Math.cos(a) * rr;
          const y = cy + Math.sin(a) * rr;
          const br = annulus * (0.06 + rand() * 0.16);
          const base =
            rand() < 0.45 ? pal.deep : pal.fibers[Math.floor(rand() * pal.fibers.length)];
          const tone = localAt(x, y) ?? base;
          const gr = c.createRadialGradient(x, y, 0, x, y, br);
          gr.addColorStop(0, css(tone, 0.05 + rand() * 0.08));
          gr.addColorStop(1, css(tone, 0));
          c.fillStyle = gr;
          c.fillRect(x - br, y - br, br * 2, br * 2);
        }
        const gr = c.createRadialGradient(cx, cy, pupilR * 0.6, cx, cy, R);
        gr.addColorStop(0, "rgba(255,240,210,0.07)");
        gr.addColorStop(0.55, "rgba(0,0,0,0)");
        gr.addColorStop(1, "rgba(20,10,4,0.2)");
        c.fillStyle = gr;
        c.fillRect(cx - R, cy - R, R * 2, R * 2);
      }

      const drawFiber = (
        a0: number,
        r0: number,
        len: number,
        toneAt: (x: number, y: number) => RGB,
        width: number,
        alpha: number,
        wander: number,
        emboss = false,
        waveAmp = 0,
        waveCycles = 2.2,
      ) => {
        const segs = 5 + Math.floor(rand() * 3);
        let a = a0;
        let r = r0;
        c.lineCap = "round";
        let x0 = cx + Math.cos(a) * r;
        let y0 = cy + Math.sin(a) * r;
        // Organic waviness (Adam, 2026-11-03: "the fibers are all
        // straight lines"): a smooth travelling wave along each
        // fiber, anchored at its base (zero offset at p = 0) with
        // its phase derived from the start angle — no extra
        // rand() calls, and more, shorter segments so the curve
        // reads as a curve, not a polygon.
        const wavePhase = a0 * 3;
        const waveBase = Math.sin(wavePhase);
        // First walk the fiber's path (walk + wave), collecting
        // the joint points — the drawing happens in a second pass.
        const pts: { x: number; y: number }[] = [{ x: x0, y: y0 }];
        for (let s = 0; s < segs; s++) {
          r += (len / segs) * (0.75 + rand() * 0.5);
          a += (rand() - 0.5) * wander;
          const p = Math.min(1, (r - r0) / len);
          const aDisp =
            a + (Math.sin(p * TAU * waveCycles + wavePhase) - waveBase) * waveAmp;
          pts.push({ x: cx + Math.cos(aDisp) * r, y: cy + Math.sin(aDisp) * r });
        }
        // Rounded curves (Adam, 2026-11-03: "more rounded curves,
        // it's too pointy"): stroke the path as quadratic pieces
        // through the segment midpoints, bending around each joint
        // instead of cornering on it, and taper the strand toward
        // both ends so the tips come to soft points. The walk above
        // consumes exactly the same rand() sequence as before, so
        // the seeded layout is unchanged — only the stroking is.
        const strokePiece = (
          sx0: number,
          sy0: number,
          qx: number,
          qy: number,
          ex: number,
          ey: number,
          offX: number,
          offY: number,
        ) => {
          c.beginPath();
          c.moveTo(sx0 + offX, sy0 + offY);
          c.quadraticCurveTo(qx + offX, qy + offY, ex + offX, ey + offY);
          c.stroke();
        };
        for (let j = 0; j <= segs; j++) {
          let sx0: number, sy0: number, qx: number, qy: number, ex: number, ey: number;
          if (j === 0) {
            sx0 = pts[0].x;
            sy0 = pts[0].y;
            qx = pts[0].x;
            qy = pts[0].y;
            ex = (pts[0].x + pts[1].x) / 2;
            ey = (pts[0].y + pts[1].y) / 2;
          } else if (j === segs) {
            sx0 = (pts[segs - 1].x + pts[segs].x) / 2;
            sy0 = (pts[segs - 1].y + pts[segs].y) / 2;
            qx = pts[segs].x;
            qy = pts[segs].y;
            ex = pts[segs].x;
            ey = pts[segs].y;
          } else {
            sx0 = (pts[j - 1].x + pts[j].x) / 2;
            sy0 = (pts[j - 1].y + pts[j].y) / 2;
            qx = pts[j].x;
            qy = pts[j].y;
            ex = (pts[j].x + pts[j + 1].x) / 2;
            ey = (pts[j].y + pts[j + 1].y) / 2;
          }
          const tone = toneAt(
            0.25 * sx0 + 0.5 * qx + 0.25 * ex,
            0.25 * sy0 + 0.5 * qy + 0.25 * ey,
          );
          // Taper: thinnest at both ends, full width mid-strand.
          const center = (j + 0.5) / (segs + 1);
          const w = width * (0.45 + 0.55 * Math.sin(Math.PI * center));
          if (emboss) {
            // Depth (Adam, 2026-11-03): each fiber is a raised
            // strand lit from the top-left — a soft shadow pass
            // offset down-right, then a highlight pass offset
            // toward the light.
            const sx = w * 0.32;
            const sy = w * 0.45;
            c.strokeStyle = css(shade(tone, 0.5), alpha * 0.55);
            c.lineWidth = w * 1.75;
            strokePiece(sx0, sy0, qx, qy, ex, ey, sx, sy);
            c.strokeStyle = css(tone, alpha);
            c.lineWidth = w;
            strokePiece(sx0, sy0, qx, qy, ex, ey, 0, 0);
            const hx = -w * 0.26;
            const hy = -w * 0.38;
            c.strokeStyle = css(mix(tone, [255, 255, 255], 0.55), alpha * 0.75);
            c.lineWidth = Math.max(0.5, w * 0.42);
            strokePiece(sx0, sy0, qx, qy, ex, ey, hx, hy);
          } else {
            c.strokeStyle = css(tone, alpha);
            c.lineWidth = w;
            strokePiece(sx0, sy0, qx, qy, ex, ey, 0, 0);
          }
        }
      };
      for (let i = 0; i < 1500; i++) {
        const a = rand() * TAU;
        const r0 = pupilR * (0.97 + rand() * 0.1);
        const len = annulus * (0.35 + rand() * 0.62);
        const pick = rand();
        const flatTone =
          pick < 0.12
            ? pal.light
            : pick < 0.3
              ? pal.deep
              : pal.fibers[Math.floor(rand() * pal.fibers.length)];
        const fShade = 0.78 + rand() * 0.44;
        drawFiber(
          a,
          r0,
          len,
          (x, y) => {
            const lc = localAt(x, y);
            return lc ? shade(lc, fShade) : flatTone;
          },
          0.7 + rand() * 1.5,
          0.14 + rand() * 0.3,
          0.02 + rand() * 0.04,
          true,
          0.034 * (0.7 + ((fShade - 0.78) / 0.44) * 0.6),
          2.4,
        );
      }
      for (let i = 0; i < 46; i++) {
        const ca = rand() * TAU;
        const cr = pupilR + annulus * (0.15 + rand() * 0.7);
        const n = 4 + Math.floor(rand() * 7);
        for (let j = 0; j < n; j++) {
          drawFiber(
            ca + (rand() - 0.5) * 0.05,
            cr + (rand() - 0.5) * annulus * 0.05,
            annulus * (0.05 + rand() * 0.1),
            (x, y) => {
              const lc = localAt(x, y);
              return lc ? shade(lc, 0.55) : pal.deep;
            },
            0.8 + rand() * 1.1,
            0.3 + rand() * 0.3,
            0.03,
            true,
            0.02,
            1.6,
          );
        }
      }
      for (let i = 0; i < 220; i++) {
        const a = rand() * TAU;
        const r0 = pupilR + annulus * (0.6 + rand() * 0.36);
        drawFiber(
          a,
          r0,
          annulus * (0.05 + rand() * 0.12),
          (x, y) => {
            const lc = localAt(x, y);
            return lc ? mix(lc, pal.light, 0.45) : pal.light;
          },
          0.6 + rand() * 0.7,
          0.1 + rand() * 0.18,
          0.015,
          false,
          0.015,
          1.5,
        );
      }

      {
        const baseR = pupilR + annulus * 0.3;
        const phase = rand() * TAU;
        c.beginPath();
        for (let i = 0; i <= 180; i++) {
          const a = (i / 180) * TAU;
          const rr =
            baseR +
            Math.sin(a * 7 + phase) * annulus * 0.028 +
            Math.sin(a * 13 + phase * 2) * annulus * 0.014;
          const x = cx + Math.cos(a) * rr;
          const y = cy + Math.sin(a) * rr;
          if (i === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        c.closePath();
        c.strokeStyle = css(pal.collarette, 0.5);
        c.lineWidth = annulus * 0.11;
        c.stroke();
        c.strokeStyle = css(pal.deep, 0.35);
        c.lineWidth = annulus * 0.03;
        c.stroke();
      }

      c.beginPath();
      c.arc(cx, cy, R * 0.985, 0, TAU);
      c.strokeStyle = css(pal.limbal, 0.85);
      c.lineWidth = R * 0.028;
      c.stroke();
      c.beginPath();
      c.arc(cx, cy, R * 0.955, 0, TAU);
      c.strokeStyle = css(pal.deep, 0.3);
      c.lineWidth = R * 0.05;
      c.stroke();
      c.restore();

      /* Depth (Adam, 2026-11-03): dome shading over the
         finished field, under the pupil — light from the top,
         a soft specular bloom upper-left, and the rim sinking
         into shadow, so the fiber field reads as a curved 3D
         surface. Signs are painted later, on top, unaffected. */
      {
        c.save();
        c.beginPath();
        c.arc(cx, cy, R, 0, TAU);
        c.clip();
        const lg = c.createLinearGradient(cx, cy - R, cx, cy + R * 0.55);
        lg.addColorStop(0, "rgba(255,244,214,0.13)");
        lg.addColorStop(0.5, "rgba(255,244,214,0)");
        lg.addColorStop(1, "rgba(16,8,4,0.10)");
        c.fillStyle = lg;
        c.fillRect(cx - R, cy - R, R * 2, R * 2);
        const rg = c.createRadialGradient(cx, cy - R * 0.18, R * 0.1, cx, cy, R);
        rg.addColorStop(0, "rgba(255,246,220,0.05)");
        rg.addColorStop(0.62, "rgba(0,0,0,0)");
        rg.addColorStop(0.88, "rgba(18,9,4,0.13)");
        rg.addColorStop(1, "rgba(18,9,4,0.30)");
        c.fillStyle = rg;
        c.fillRect(cx - R, cy - R, R * 2, R * 2);
        const sgx = cx - R * 0.34;
        const sgy = cy - R * 0.38;
        const sg = c.createRadialGradient(sgx, sgy, 0, sgx, sgy, R * 0.52);
        sg.addColorStop(0, "rgba(255,252,238,0.13)");
        sg.addColorStop(1, "rgba(255,252,238,0)");
        c.fillStyle = sg;
        c.fillRect(cx - R, cy - R, R * 2, R * 2);
        c.beginPath();
        c.arc(cx, cy, pupilR * 1.12, 0, TAU);
        c.strokeStyle = "rgba(10,5,2,0.35)";
        c.lineWidth = pupilR * 0.16;
        c.stroke();
        c.restore();
      }

      paintPupil(c, g, rand);
      return off;
    };

    /* Stage 1: the pupil alone on the backdrop. */
    const renderPupilStage = (src: ColorSource): HTMLCanvasElement => {
      const off = document.createElement("canvas");
      off.width = W;
      off.height = H;
      const c = off.getContext("2d")!;
      const g = geomOf(src);
      paintBackdrop(c, src, g);
      paintPupil(c, g, mulberry32(hashStr(`pupil-stage:${scan.id}`)));
      return off;
    };

    const SIGN_ORDER: Record<string, number> = {
      ring: 0,
      radial: 1,
      fiber: 2,
      lacuna: 3,
      cloudy: 4,
      pigment: 5,
    };
    const orderedMarkers = [...scan.markers].sort(
      (a, b) => (SIGN_ORDER[a.sign] ?? 9) - (SIGN_ORDER[b.sign] ?? 9),
    );

    /* Signs, clipped to the annulus; draws the first `count`. */
    const paintSigns = (c: CanvasRenderingContext2D, src: ColorSource, count: number) => {
      const g = geomOf(src);
      const { cx, cy, R, pupilR, annulus, pal, localAt } = g;
      c.save();
      c.beginPath();
      c.arc(cx, cy, R * 0.995, 0, TAU);
      c.arc(cx, cy, pupilR * 1.01, 0, TAU, true);
      c.clip("evenodd");
      for (const m of orderedMarkers.slice(0, count)) {
        const vx = (m.x - 0.5) / PHOTO_IRIS_R;
        const vy = (m.y - 0.5) / PHOTO_IRIS_R;
        const vlen = Math.hypot(vx, vy);
        const cl = vlen > 1 ? 1 / vlen : 1;
        let dx = vx * cl;
        let dy = vy * cl;
        const dd = Math.hypot(dx, dy);
        const minD = pupilRatio * 1.07;
        if (dd > 0.001 && dd < minD) {
          dx *= minD / dd;
          dy *= minD / dd;
        }
        const x = cx + dx * R * 0.97;
        const y = cy + dy * R * 0.97;
        const ang = Math.atan2(y - cy, x - cx);
        const mr = mulberry32(hashStr(`sign:${m.id}`));
        const S = annulus;
        const lc: RGB = localAt(x, y) ?? pal.fibers[1];
        c.save();
        if (m.sign === "ring") {
          const rr = Math.hypot(x - cx, y - cy);
          c.beginPath();
          c.arc(cx, cy, rr, ang - 0.32, ang + 0.32);
          c.strokeStyle = css(shade(lc, 0.45), 0.85);
          c.lineWidth = Math.max(2.2, S * 0.05);
          c.stroke();
          c.beginPath();
          c.arc(cx, cy, rr + S * 0.045, ang - 0.3, ang + 0.3);
          c.strokeStyle = css(mix(lc, [255, 255, 255], 0.35), 0.5);
          c.lineWidth = Math.max(1.2, S * 0.018);
          c.stroke();
          c.restore();
          continue;
        }
        c.translate(x, y);
        c.rotate(ang + Math.PI / 2);
        if (m.sign === "lacuna") {
          const L = S * 0.52;
          const Wd = S * 0.22;
          const leaf = (l: number, w: number) => {
            c.beginPath();
            c.moveTo(0, -l / 2);
            c.quadraticCurveTo(w / 2, 0, 0, l / 2);
            c.quadraticCurveTo(-w / 2, 0, 0, -l / 2);
            c.closePath();
          };
          leaf(L, Wd);
          c.fillStyle = css(shade(lc, 0.42), 0.92);
          c.fill();
          c.strokeStyle = css(mix(lc, [255, 255, 255], 0.3), 0.5);
          c.lineWidth = Math.max(1, S * 0.012);
          c.stroke();
          leaf(L * 0.58, Wd * 0.52);
          c.fillStyle = css(shade(lc, 0.22), 0.95);
          c.fill();
        } else if (m.sign === "cloudy") {
          const soft = mix(lc, [252, 250, 242], 0.72);
          for (let i = 0; i < 5; i++) {
            const bx = (mr() - 0.5) * S * 0.26;
            const by = (mr() - 0.5) * S * 0.44;
            const br = S * (0.07 + mr() * 0.1);
            const gr = c.createRadialGradient(bx, by, 0, bx, by, br);
            gr.addColorStop(0, css(soft, 0.42));
            gr.addColorStop(1, css(soft, 0));
            c.fillStyle = gr;
            c.fillRect(bx - br, by - br, br * 2, br * 2);
          }
        } else if (m.sign === "pigment") {
          const rusty = mix(lc, pal.rust, 0.45);
          c.fillStyle = css(rusty, 0.95);
          c.beginPath();
          c.arc(0, 0, S * 0.08, 0, TAU);
          c.fill();
          for (let i = 0; i < 7; i++) {
            const a = mr() * TAU;
            const d = S * (0.1 + mr() * 0.15);
            c.fillStyle = css(mr() < 0.5 ? shade(rusty, 0.7) : rusty, 0.88);
            c.beginPath();
            c.arc(Math.cos(a) * d, Math.sin(a) * d, S * (0.022 + mr() * 0.038), 0, TAU);
            c.fill();
          }
        } else if (m.sign === "radial") {
          const L = S * 0.62;
          c.beginPath();
          c.moveTo(-S * 0.026, -L / 2);
          c.quadraticCurveTo(-S * 0.008, 0, -S * 0.005, L / 2);
          c.lineTo(S * 0.005, L / 2);
          c.quadraticCurveTo(S * 0.008, 0, S * 0.026, -L / 2);
          c.closePath();
          c.fillStyle = css(shade(lc, 0.38), 0.9);
          c.fill();
        } else if (m.sign === "fiber") {
          const cell = S * 0.058;
          for (let row = -2; row <= 2; row++) {
            for (let col = -2; col <= 2; col++) {
              if (mr() < 0.25) continue;
              const px2 = col * cell * 1.7 + (row % 2 ? cell * 0.85 : 0);
              const py2 = row * cell * 1.5;
              if (Math.hypot(px2, py2) > S * 0.24) continue;
              c.beginPath();
              for (let k = 0; k < 6; k++) {
                const ka = (k / 6) * TAU + Math.PI / 6;
                const hx = px2 + Math.cos(ka) * cell * 0.92;
                const hy = py2 + Math.sin(ka) * cell * 0.92;
                if (k === 0) c.moveTo(hx, hy);
                else c.lineTo(hx, hy);
              }
              c.closePath();
              c.strokeStyle = css(
                mr() < 0.5 ? shade(lc, 0.6) : mix(lc, [255, 255, 255], 0.22),
                0.32 + mr() * 0.25,
              );
              c.lineWidth = Math.max(0.8, S * 0.01);
              c.stroke();
            }
          }
        }
        c.restore();
      }
      c.restore();
    };

    let fieldCache: { src: ColorSource; canvas: HTMLCanvasElement } | null = null;
    const fieldOf = (src: ColorSource) => {
      if (!fieldCache || fieldCache.src !== src) {
        fieldCache = { src, canvas: renderField(src) };
      }
      return fieldCache.canvas;
    };

    const drawFinal = () => {
      const src = srcRef.current;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(fieldOf(src), 0, 0);
      paintSigns(ctx, src, orderedMarkers.length);
      canvas.dataset.stage = "final";
    };

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let animFinished = false;
    const runAnimation = () => {
      if (cancelled) return;
      if (reduced || still) {
        drawFinal();
        animFinished = true;
        return;
      }
      const srcAtStart = srcRef.current;
      const pupilCanvas = renderPupilStage(srcAtStart);
      canvas.dataset.stage = "pupil";
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(pupilCanvas, 0, 0);
      // Crossfade into the field once it is rendered (rendered
      // with the best source available at that moment).
      const fadeStart = performance.now() + 500;
      const fadeDur = 550;
      const tick = () => {
        if (cancelled) return;
        const now = performance.now();
        if (now < fadeStart) {
          raf = requestAnimationFrame(tick);
          return;
        }
        const src = srcRef.current;
        const field = fieldOf(src);
        const t = clamp((now - fadeStart) / fadeDur, 0, 1);
        canvas.dataset.stage = "field";
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(pupilCanvas, 0, 0);
        ctx.globalAlpha = t;
        ctx.drawImage(field, 0, 0);
        ctx.globalAlpha = 1;
        if (t < 1) {
          raf = requestAnimationFrame(tick);
          return;
        }
        // Signs, one at a time.
        let k = 0;
        canvas.dataset.stage = "signs";
        const step = () => {
          if (cancelled) return;
          const s = srcRef.current;
          ctx.clearRect(0, 0, W, H);
          ctx.drawImage(fieldOf(s), 0, 0);
          paintSigns(ctx, s, k);
          if (k >= orderedMarkers.length) {
            canvas.dataset.stage = "final";
            animFinished = true;
            return;
          }
          k++;
          timers.push(window.setTimeout(step, 140));
        };
        step();
      };
      raf = requestAnimationFrame(tick);
    };

    runAnimation();

    const onBeforePrint = () => drawFinal();
    window.addEventListener("beforeprint", onBeforePrint);

    // Measure the photo; when the sampled source lands, swap it
    // in — restart the build if it is still running, settle on
    // the finished frame if it already completed.
    if (scan.image) {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        try {
          const off = document.createElement("canvas");
          const scale = Math.min(1, 720 / Math.max(img.naturalWidth, img.naturalHeight));
          off.width = Math.max(2, Math.round(img.naturalWidth * scale));
          off.height = Math.max(2, Math.round(img.naturalHeight * scale));
          const octx = off.getContext("2d", { willReadFrequently: true });
          if (!octx) return;
          octx.drawImage(img, 0, 0, off.width, off.height);
          const data = octx.getImageData(0, 0, off.width, off.height).data;
          const src = buildSampledSource(data, off.width, off.height, pupilRatio, fallbackPal);
          if (!src || cancelled) return;
          srcRef.current = src;
          if (animFinished) drawFinal();
          else {
            timers.forEach((t) => window.clearTimeout(t));
            cancelAnimationFrame(raf);
            runAnimation();
          }
        } catch {
          /* keep the palette drawing */
        }
      };
      img.src = scan.image;
    }
    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      cancelAnimationFrame(raf);
      window.removeEventListener("beforeprint", onBeforePrint);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan, replayNonce, cachedUrl]);

  const ariaLabel = `Illustration of this ${scan.eye} iris in the exact colours of the scan, drawn step by step: pupil first, then fibers and colouring, then the ${scan.markers.length} signs the reader found`;
  const canvasEl = cachedUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={cachedUrl}
      alt={ariaLabel}
      draggable={false}
      style={
        bare
          ? {
              // Mirror .rvi-illus canvas: full-bleed, rounded.
              width: "100%",
              height: "100%",
              display: "block",
              borderRadius: 18,
            }
          : {
              // Mirror .iris-illustration canvas (globals.css) —
              // the stored image must keep the rounded corners
              // and shadow the canvas had (Adam, 2026-11-06).
              width: "100%",
              maxWidth: 460,
              height: "auto",
              display: "block",
              margin: "0 auto",
              borderRadius: 18,
              boxShadow: "0 14px 34px rgba(13, 59, 55, 0.25)",
            }
      }
    />
  ) : (
    <canvas ref={ref} width={880} height={880} role="img" aria-label={ariaLabel} />
  );
  if (bare) return canvasEl;

  return <figure className="iris-illustration">{canvasEl}</figure>;
}
