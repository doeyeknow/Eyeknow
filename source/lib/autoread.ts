// Automatic iris reading — classical image processing, no ML model.
//
// Pipeline: locate pupil (darkest blob) → locate iris edge (radial
// saturation/brightness falloff per angle) → unwrap the iris annulus
// into a polar strip → run texture detectors for the six traditional
// signs → place markers on the chart via lib/chart's locate().
//
// Everything is heuristic by design: each marker carries a confidence
// ("strong" | "moderate" | "light") derived from its detection
// strength, and the result carries plain-language notes (dark iris,
// eyelid cover, photo quality) that the report shows. There is no
// labeled dataset of iridology signs to train a model on — this is
// pattern-spotting against thresholds, and the UI says so.

import {
  classifyLacunaShape,
  classifyPupilShape,
  classifyTone,
  locate,
  type IrisColor,
  type IrisProfile,
  type LacunaShape,
  type Marker,
  type PupilShape,
  type SignId,
} from "./chart";

export type Confidence = "strong" | "moderate" | "light";

/** Thrown when the iris itself can't be detected well enough to
 *  crop a decent image — the caller shows an error and asks for a
 *  retake instead of reading an estimated guess (Adam, 2026-11-06). */
export class IrisDetectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IrisDetectionError";
  }
}

export interface AutoReadResult {
  markers: Marker[];
  color: IrisColor;
  overallConfidence: "high" | "moderate" | "low";
  notes: string[];
  qualityNotes: string[];
  /** Square crop around the detected iris (data URL) — the image the
   *  report stores and displays; marker x/y are fractions of it. */
  image: string;
  /** True when contrast enhancement was applied (dark iris). */
  contrastEnhanced: boolean;
  /** Whole-iris measures (constitution grade, rim/ring/stomach/pupil). */
  profile: IrisProfile;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

function lumOf(c: RGB): number {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}
function satOf(c: RGB): number {
  const mx = Math.max(c.r, c.g, c.b);
  const mn = Math.min(c.r, c.g, c.b);
  return mx === 0 ? 0 : (mx - mn) / mx;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function sampler(data: Uint8ClampedArray, w: number, h: number) {
  return (x: number, y: number): RGB => {
    const xi = Math.max(0, Math.min(w - 1, Math.round(x)));
    const yi = Math.max(0, Math.min(h - 1, Math.round(y)));
    const i = (yi * w + xi) * 4;
    return { r: data[i], g: data[i + 1], b: data[i + 2] };
  };
}

function median(vals: number[]): number {
  if (vals.length === 0) return 0;
  const s = [...vals].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Noise reduction — the standard first step in the computer-aided
 *  iridology pipeline (median / Gaussian filtering in the survey
 *  literature): a 3×3 median kills sensor and JPEG speckle, then a
 *  light separable [1,2,1] blur settles what remains, so camera grain
 *  is not mistaken for signs. Analysis only — the photo stored in the
 *  report is the original. */
function denoise(src: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const med = new Uint8ClampedArray(src.length);
  const v = new Float32Array(9);
  const medOf9 = (): number => {
    for (let i = 0; i < 5; i++) {
      let m = i;
      for (let j = i + 1; j < 9; j++) if (v[j] < v[m]) m = j;
      if (m !== i) {
        const t = v[i];
        v[i] = v[m];
        v[m] = t;
      }
    }
    return v[4];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = Math.max(0, Math.min(h - 1, y + dy));
          for (let dx = -1; dx <= 1; dx++) {
            const xx = Math.max(0, Math.min(w - 1, x + dx));
            v[n++] = src[(yy * w + xx) * 4 + ch];
          }
        }
        med[o + ch] = medOf9();
      }
      med[o + 3] = 255;
    }
  }
  const tmp = new Float32Array(w * h * 4);
  const out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const xm = Math.max(0, x - 1);
      const xp = Math.min(w - 1, x + 1);
      const o = (y * w + x) * 4;
      for (let ch = 0; ch < 4; ch++) {
        tmp[o + ch] =
          (med[(y * w + xm) * 4 + ch] + 2 * med[o + ch] + med[(y * w + xp) * 4 + ch]) / 4;
      }
    }
  }
  for (let y = 0; y < h; y++) {
    const ym = Math.max(0, y - 1);
    const yp = Math.min(h - 1, y + 1);
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      for (let ch = 0; ch < 4; ch++) {
        out[o + ch] = Math.round(
          (tmp[(ym * w + x) * 4 + ch] + 2 * tmp[o + ch] + tmp[(yp * w + x) * 4 + ch]) / 4,
        );
      }
    }
  }
  return out;
}

/** Largest dark connected component near the middle = the pupil. */
function findPupil(
  px: (x: number, y: number) => RGB,
  w: number,
  h: number,
): { cx: number; cy: number; r: number; shape?: PupilShape } | null {
  const gw = 180;
  const gh = Math.max(60, Math.round((h / w) * gw));
  const gray = new Float32Array(gw * gh);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      gray[y * gw + x] = lumOf(px(((x + 0.5) / gw) * w, ((y + 0.5) / gh) * h));
    }
  }
  const minDimG = Math.min(gw, gh);
  const components = (mask: Uint8Array): number[][] => {
    const seen = new Uint8Array(gw * gh);
    const out: number[][] = [];
    const stack: number[] = [];
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i] || seen[i]) continue;
      const cells: number[] = [];
      stack.length = 0;
      stack.push(i);
      seen[i] = 1;
      while (stack.length) {
        const cur = stack.pop() as number;
        cells.push(cur);
        const cx = cur % gw;
        const nb = [cur - 1, cur + 1, cur - gw, cur + gw];
        for (const n of nb) {
          if (n < 0 || n >= mask.length || seen[n] || !mask[n]) continue;
          if (Math.abs((n % gw) - cx) > 1) continue;
          seen[n] = 1;
          stack.push(n);
        }
      }
      out.push(cells);
    }
    return out;
  };
  // The pupil is the darkest compact ROUND blob in the frame. Brows,
  // lashes and hair are dark too but elongated, and in a bright photo a
  // single loose threshold lets them win on size — so search from the
  // strictest threshold up, keep only round, solid blobs, then "grow"
  // the winning core at a looser threshold to size the full pupil
  // (bright reflections punch holes in it at strict thresholds).
  for (const T of [18, 26, 34, 44, 56]) {
    const mask = new Uint8Array(gw * gh);
    for (let i = 0; i < gray.length; i++) mask[i] = gray[i] < T ? 1 : 0;
    let best: { cells: number[]; score: number } | null = null;
    for (const cells of components(mask)) {
      const area = cells.length;
      const frac = area / mask.length;
      if (frac < 0.0008 || frac > 0.06) continue;
      let sx = 0;
      let sy = 0;
      let minx = gw;
      let maxx = 0;
      let miny = gh;
      let maxy = 0;
      for (const c of cells) {
        const x = c % gw;
        const y = Math.floor(c / gw);
        sx += x;
        sy += y;
        if (x < minx) minx = x;
        if (x > maxx) maxx = x;
        if (y < miny) miny = y;
        if (y > maxy) maxy = y;
      }
      const mx = sx / area / gw;
      const my = sy / area / gh;
      if (mx < 0.15 || mx > 0.85 || my < 0.15 || my > 0.85) continue;
      const bw = maxx - minx + 1;
      const bh = maxy - miny + 1;
      if (Math.max(bw, bh) / Math.min(bw, bh) > 1.7) continue;
      const fill = area / (bw * bh);
      if (fill < 0.42) continue;
      const rCells = Math.sqrt(area / Math.PI);
      if (rCells < minDimG * 0.018 || rCells > minDimG * 0.16) continue;
      const roundness = Math.min(bw, bh) / Math.max(bw, bh);
      const score = area * (0.4 + 0.6 * roundness) * fill;
      if (!best || score > best.score) best = { cells, score };
    }
    if (!best) continue;
    let cells = best.cells;
    let coreSum = 0;
    for (const c of cells) coreSum += gray[c];
    const coreMean = coreSum / cells.length;
    const tGrow = Math.min(88, coreMean + 34);
    const gmask = new Uint8Array(gw * gh);
    for (let i = 0; i < gray.length; i++) gmask[i] = gray[i] < tGrow ? 1 : 0;
    const grownComponents = components(gmask);
    for (const g of grownComponents) {
      if (g.length > cells.length && g.includes(cells[0])) {
        // Growing only fills reflection holes in the pupil — a modest
        // expansion. On a dark-brown eye the looser threshold can
        // swallow the whole iris (nearly as dark as the pupil), and
        // the "pupil" comes back the size of the iris, which then
        // poisons the edge trace and the crop. If the grown blob's
        // radius is more than ~2x the core's, keep the core.
        if (Math.sqrt(g.length / Math.PI) <= Math.sqrt(cells.length / Math.PI) * 2) {
          cells = g;
        }
        break;
      }
    }
    const area = cells.length;
    let sx = 0;
    let sy = 0;
    for (const c of cells) {
      sx += c % gw;
      sy += Math.floor(c / gw);
    }
    const gx = sx / area;
    const gy = sy / area;
    let maxExt = 0;
    for (const c of cells) {
      const d = Math.hypot((c % gw) - gx, Math.floor(c / gw) - gy);
      if (d > maxExt) maxExt = d;
    }
    const cx = (gx / gw) * w;
    const cy = (gy / gh) * h;
    const rArea = Math.sqrt(area / Math.PI) * (w / gw);
    // Sanity cap: the core search never accepts a pupil wider than
    // 0.16 of the grid's short side; hold the final radius to the
    // same bound (a real pupil in a close-up is well under it).
    const rCap = minDimG * 0.17 * (w / gw);
    const r = Math.min(Math.max(rArea, 0.9 * maxExt * (w / gw)), rCap);
    // Pupil shape from the same blob: boundary radius in 24 clock
    // bins (bin 0 = 12 o'clock, clockwise), gaps interpolated.
    const NB = 24;
    const radii = new Array<number>(NB).fill(0);
    for (const c of cells) {
      const dx = (c % gw) - gx;
      const dy = Math.floor(c / gw) - gy;
      const d = Math.hypot(dx, dy);
      let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
      if (deg < 0) deg += 360;
      const bin = Math.min(NB - 1, Math.floor((deg / 360) * NB));
      if (d > radii[bin]) radii[bin] = d;
    }
    for (let i = 0; i < NB; i++) {
      if (radii[i] === 0) radii[i] = radii[(i - 1 + NB) % NB] || radii[(i + 1) % NB] || rArea;
    }
    const shape = classifyPupilShape(radii);
    return { cx, cy, r, shape };
  }
  return null;
}

interface Candidate {
  sign: SignId;
  thetaDeg: number; // clock convention: 0 = 12 o'clock, clockwise
  t: number; // 0 at pupil edge of the annulus, 1 at iris edge
  strength: number; // 0..1
  shape?: LacunaShape; // lacuna silhouette, when classified
}

export async function autoRead(
  imageSrc: string,
  opts?: { analysisSrc?: string; stackedFrames?: number },
): Promise<AutoReadResult> {
  const notes: string[] = [];
  const qualityNotes: string[] = [];
  const img = await loadImage(imageSrc);
  // The reader analyses `imgA` when a separate analysis image is
  // supplied (the aligned multi-frame average from lib/capture); the
  // stored photo still comes from `img`, the sharpest single frame.
  // Both come from the same capture, so geometry transfers by scale.
  const imgA = opts?.analysisSrc ? await loadImage(opts.analysisSrc) : img;
  if (opts?.stackedFrames && opts.stackedFrames > 1) {
    notes.push(
      `The camera captured several frames of your eye and combined the ${opts.stackedFrames} sharpest — aligned on the pupil and averaged — so sensor noise cancels out and the fibers read more clearly. Nothing is added that the camera didn't record.`,
    );
  }

  // Analysis canvas: photo capped at 2000px on the long side.
  const cap = 2000;
  const aScale = Math.min(1, cap / Math.max(imgA.naturalWidth, imgA.naturalHeight));
  const W = Math.round(imgA.naturalWidth * aScale);
  const H = Math.round(imgA.naturalHeight * aScale);
  const aCanvas = document.createElement("canvas");
  aCanvas.width = W;
  aCanvas.height = H;
  const aCtx = aCanvas.getContext("2d", { willReadFrequently: true });
  if (!aCtx) throw new Error("no 2d context");
  aCtx.drawImage(imgA, 0, 0, W, H);
  const aData = denoise(aCtx.getImageData(0, 0, W, H).data, W, H);
  notes.push(
    "The photo was noise-filtered before reading (a median + softening pass — the standard first step in computer-aided iridology), so camera grain and compression speckle aren't mistaken for signs.",
  );
  const px = sampler(aData, W, H);
  const minDim = Math.min(W, H);

  // ── 1. Pupil ──────────────────────────────────────────────────────
  let pupil = findPupil(px, W, H);
  let pupilFound = true;
  if (!pupil) {
    pupilFound = false;
    pupil = { cx: W / 2, cy: H / 2, r: minDim * 0.085 };
    notes.push(
      "The pupil couldn't be located precisely in this photo, so the reading was centered by estimate — signs may sit slightly off their true positions.",
    );
  }
  const { cx, cy } = pupil;
  const rp = Math.max(8, pupil.r);

  // ── 2. Iris edge per angle (72 rays) ─────────────────────────────
  const RAYS = 72;
  const maxR = minDim * 0.52;
  // One trace pass at a given below-baseline ratio. The strict pass
  // (0.45) suits bright photos with white sclera; on warm or shadowed
  // photos the sclera scores too high for 0.45 and the trace starves
  // even though the edge is plainly there (Adam's brown eye, 2026-11-07:
  // validFrac 0.15 at 0.45, 0.64 at 0.62, median R steady ~200-211
  // across 0.55-0.70). So a struggling strict pass is retried at 0.62
  // and the better trace wins; the hard gate below still applies.
  const traceEdges = (ratio: number) => {
    const eR: number[] = new Array(RAYS).fill(0);
    const v: boolean[] = new Array(RAYS).fill(false);
    for (let k = 0; k < RAYS; k++) {
      const th = (k / RAYS) * Math.PI * 2;
      const dx = Math.sin(th);
      const dy = -Math.cos(th);
      const score = (r: number) => {
        const c = px(cx + dx * r, cy + dy * r);
        return satOf(c) * 150 + (255 - lumOf(c)) * 0.45;
      };
      let base = 0;
      let bn = 0;
      for (let r = rp * 1.15; r < rp * 1.65 && r < maxR; r += 3) {
        base += score(r);
        bn += 1;
      }
      base = bn ? base / bn : 0;
      let below = 0;
      for (let r = rp * 1.4; r < maxR; r += 3) {
        if (score(r) < base * ratio) {
          below += 1;
          if (below >= 3) {
            eR[k] = r - 6;
            v[k] = true;
            break;
          }
        } else below = 0;
      }
    }
    const validRadii = eR.filter((_, k) => v[k]);
    const vf = validRadii.length / RAYS;
    let RR = validRadii.length >= 12 ? median(validRadii) : minDim * 0.3;
    // The rp floor assumes a true pupil; cap R at the trace's own
    // search bound so a bad radius can never manufacture a giant iris.
    RR = Math.min(Math.max(RR, rp * 1.9), maxR);
    return { edgeR: eR, valid: v, validFrac: vf, R: RR };
  };
  let traced = traceEdges(0.45);
  if (traced.validFrac < 0.45) {
    const lenient = traceEdges(0.62);
    if (lenient.validFrac > traced.validFrac) traced = lenient;
  }
  const edgeR = traced.edgeR;
  const valid = traced.valid;
  const validFrac = traced.validFrac;
  const R = traced.R;
  if (validFrac < 0.55) {
    notes.push(
      "The outer edge of the iris was hard to trace in this photo (lighting or eyelid cover), so the chart was fitted by estimate.",
    );
  }
  // Hard stop: no pupil, a barely-traced edge, or an iris too small
  // in the frame means there is nothing decent to crop — the scan
  // flow turns this into an error + retake prompt rather than a
  // reading built on estimates. The edge floor was raised from
  // 0.18 to 0.30 at Adam's word (2026-11-08, "reduce the error
  // tolerance"): a reading now needs at least ~30% of the traced
  // rays to have truly found the iris edge, not ~18%.
  if (!pupilFound || validFrac < 0.3 || R < minDim * 0.07) {
    throw new IrisDetectionError(
      !pupilFound
        ? "pupil not detected"
        : validFrac < 0.3
          ? "iris edge not detected"
          : "iris too small in frame",
    );
  }
  // Per-ray visibility limit: occluded where the traced edge hugs the pupil.
  const rayLimit = (k: number) => (valid[k] ? edgeR[k] : R);

  // ── 3. Polar unwrap ──────────────────────────────────────────────
  const SW = 1080; // ⅓° per column
  const SH = 144; // radial steps across the annulus
  const rIn = rp * 0.92;
  const rOut = R;
  const lum = new Float32Array(SW * SH);
  const sat = new Float32Array(SW * SH);
  const red = new Float32Array(SW * SH);
  // Raw colour strip (before any enhancement) — tone sampling for the
  // traditional colour-stage reading reads the iris's actual colour.
  const cr = new Float32Array(SW * SH);
  const cg = new Float32Array(SW * SH);
  const cb = new Float32Array(SW * SH);
  const lumRaw = new Float32Array(SW * SH);
  const vis = new Uint8Array(SW * SH);
  let annulusLumSum = 0;
  let annulusN = 0;
  let redSum = 0;
  const satSamples: number[] = [];
  const rgbSum = { r: 0, g: 0, b: 0 };
  for (let a = 0; a < SW; a++) {
    const th = (a / SW) * Math.PI * 2;
    const dx = Math.sin(th);
    const dy = -Math.cos(th);
    const ray = Math.floor((a / SW) * RAYS) % RAYS;
    const lim = rayLimit(ray);
    for (let t = 0; t < SH; t++) {
      const r = rIn + (t / (SH - 1)) * (rOut - rIn);
      const c = px(cx + dx * r, cy + dy * r);
      const i = t * SW + a;
      lum[i] = lumOf(c);
      sat[i] = satOf(c);
      red[i] = c.r - c.b;
      cr[i] = c.r;
      cg[i] = c.g;
      cb[i] = c.b;
      lumRaw[i] = lum[i];
      vis[i] = r < lim - 2 ? 1 : 0;
      if (vis[i]) {
        annulusLumSum += lum[i];
        annulusN += 1;
        rgbSum.r += c.r;
        rgbSum.g += c.g;
        rgbSum.b += c.b;
        redSum += red[i];
        if ((i & 7) === 0) satSamples.push(sat[i]);
      }
    }
  }
  const annulusLum = annulusN ? annulusLumSum / annulusN : 128;
  const redMean = annulusN ? redSum / annulusN : 40;
  const satMedian = satSamples.length ? median(satSamples) : 0.3;
  const darkIris = annulusLum < 62;
  if (darkIris) {
    notes.push(
      "This is a dark iris — its fibers naturally show less contrast in a photo, so contrast was automatically enhanced before reading (and on the photo in this report) to bring them out. That helps a lot, but a dark iris still reads less certainly than a light one and fainter signs may be missed.",
    );
  }

  // ── Contrast enhancement for detection ──────────────────────────
  // Gamma lift first (stronger on dark irises) so shadow detail
  // opens up; the blur below then runs on the lifted strip, and a
  // local contrast stretch around that background (CLAHE-style)
  // produces the detection strip the sign detectors actually read.
  const gamma = darkIris ? 0.58 : 0.8;
  for (let i = 0; i < lum.length; i++) {
    lum[i] = 255 * Math.pow(Math.max(0, lum[i]) / 255, gamma);
  }

  // Local background via separable box blur on the luminance strip.
  const bg = new Float32Array(lum);
  {
    const tmp = new Float32Array(SW * SH);
    const rad = 33;
    for (let t = 0; t < SH; t++) {
      let acc = 0;
      for (let a = -rad; a <= rad; a++) acc += bg[t * SW + ((a + SW) % SW)];
      for (let a = 0; a < SW; a++) {
        tmp[t * SW + a] = acc / (2 * rad + 1);
        acc += bg[t * SW + ((a + rad + 1) % SW)] - bg[t * SW + ((a - rad + SW) % SW)];
      }
    }
    const rad2 = 15;
    for (let a = 0; a < SW; a++) {
      for (let t = 0; t < SH; t++) {
        let acc = 0;
        let cnt = 0;
        for (let k = -rad2; k <= rad2; k++) {
          const tt = t + k;
          if (tt < 0 || tt >= SH) continue;
          acc += tmp[tt * SW + a];
          cnt += 1;
        }
        bg[t * SW + a] = acc / cnt;
      }
    }
  }
  const dark = new Float32Array(SW * SH);
  for (let i = 0; i < lum.length; i++) dark[i] = bg[i] - lum[i];

  // Local contrast stretch around the background: detection darkness
  // scales by the same factor, and lumD is the strip the detectors
  // read for brightness/texture.
  const stretch = darkIris ? 2.0 : 1.55;
  const lumD = new Float32Array(SW * SH);
  let detSum = 0;
  let detN = 0;
  for (let i = 0; i < lum.length; i++) {
    const v = bg[i] + (lum[i] - bg[i]) * stretch;
    lumD[i] = v < 0 ? 0 : v > 255 ? 255 : v;
    dark[i] *= stretch;
    if (vis[i]) {
      detSum += lumD[i];
      detN += 1;
    }
  }
  const annulusLumD = detN ? detSum / detN : annulusLum;

  // ── Whole-iris profile + tone sampling ─────────────────────────
  // The traditional colour-stage reading (Williams / Jensen /
  // Liljequist): every sign's stage is the COLOUR sampled where it
  // sits, classified relative to this iris's own base colour.
  const baseRGB = annulusN
    ? { r: rgbSum.r / annulusN, g: rgbSum.g / annulusN, b: rgbSum.b / annulusN }
    : { r: 110, g: 85, b: 60 };
  const tOf = (rNorm: number) =>
    Math.max(0, Math.min(SH - 1, ((rNorm * R - rIn) / (rOut - rIn)) * (SH - 1)));
  const bandStats = (t0: number, t1: number, centerDeg: number | null) => {
    let sl = 0;
    let ss = 0;
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let n = 0;
    const cols: number[] = [];
    if (centerDeg == null) {
      for (let a = 0; a < SW; a += 3) cols.push(a);
    } else {
      const c0 = Math.round((centerDeg / 360) * SW);
      for (let da = -SW / 24; da < SW / 24; da += 2) cols.push(((c0 + da) % SW + SW) % SW);
    }
    for (let t = Math.round(t0); t <= Math.round(t1); t++) {
      for (const a of cols) {
        const i = t * SW + a;
        if (!vis[i]) continue;
        sl += lumRaw[i];
        ss += sat[i];
        sr += cr[i];
        sg += cg[i];
        sb += cb[i];
        n += 1;
      }
    }
    return n
      ? { lum: sl / n, sat: ss / n, r: sr / n, g: sg / n, b: sb / n, n }
      : { lum: 0, sat: 0, r: 0, g: 0, b: 0, n: 0 };
  };

  // Scurf rim: how many of the 12 sectors run dark at the outer edge.
  let scurf: IrisProfile["scurf"] = "none";
  {
    let darkSectors = 0;
    let seenSectors = 0;
    for (let k = 0; k < 12; k++) {
      const st = bandStats(tOf(0.9), SH - 1, k * 30);
      if (st.n < 8) continue;
      seenSectors += 1;
      if (st.lum < annulusLum - 16) darkSectors += 1;
    }
    const frac = seenSectors >= 6 ? darkSectors / seenSectors : 0;
    scurf = frac >= 0.7 ? "broad" : frac >= 0.38 ? "medium" : frac >= 0.15 ? "faint" : "none";
  }

  // Outer border: full opaque white ring vs a grey arc across the top.
  let outerRing: IrisProfile["outerRing"] = "none";
  let ringHeadNote = false;
  {
    const st = bandStats(tOf(0.93), SH - 1, null);
    let brightSectors = 0;
    for (let k = 0; k < 12; k++) {
      const s = bandStats(tOf(0.93), SH - 1, k * 30);
      if (s.n >= 8 && s.lum > annulusLum + 14) brightSectors += 1;
    }
    if (st.n > 0 && st.lum > annulusLum + 22 && st.sat < 0.3 && brightSectors >= 8) {
      outerRing = "white";
      // The chart's sodium-ring entry adds a head-area reading when
      // the ring runs thickest across the top of the iris.
      const top = [330, 0, 30].map((d) => bandStats(tOf(0.93), SH - 1, d));
      const topN = top.reduce((s, x) => s + x.n, 0);
      const topLum = topN ? top.reduce((s, x) => s + x.lum * x.n, 0) / topN : 0;
      ringHeadNote = topN > 0 && topLum > st.lum + 8;
    } else {
      const top = [330, 0, 30].map((d) => bandStats(tOf(0.93), SH - 1, d));
      const topN = top.reduce((s, x) => s + x.n, 0);
      const topLum = topN ? top.reduce((s, x) => s + x.lum * x.n, 0) / topN : 0;
      const topSat = topN ? top.reduce((s, x) => s + x.sat * x.n, 0) / topN : 1;
      if (topN > 0 && topLum > annulusLum + 13 && topSat < satMedian + 0.06) {
        outerRing = "grey-arc";
      }
    }
  }

  // Stomach ring tone just outside the pupil.
  let stomachTone: IrisProfile["stomachTone"] = null;
  {
    const st = bandStats(tOf(0.3), tOf(0.44), null);
    if (st.n > 0) {
      const tone = classifyTone(st.r, st.g, st.b, baseRGB);
      stomachTone =
        tone === "white" ? "bright" : tone === "yellow" ? "halo" : tone === "orange" ? null : "brown";
    }
  }

  // Constitution: fibre openness = deep-gap fraction + (inverse) fine
  // angular texture, mapped onto Jensen's 1..10 density grade.
  let constitutionGrade = 5;
  {
    let gaps = 0;
    let tot = 0;
    let gradSum = 0;
    let gradN = 0;
    for (let t = 0; t < SH; t++) {
      for (let a = 0; a < SW; a++) {
        const i = t * SW + a;
        if (!vis[i]) continue;
        tot += 1;
        if (dark[i] > 55) gaps += 1;
        if (t % 4 === 0 && a % 2 === 0 && vis[t * SW + ((a + 3) % SW)]) {
          gradSum += Math.abs(lumD[t * SW + ((a + 3) % SW)] - lumD[i]);
          gradN += 1;
        }
      }
    }
    const gapFrac = tot ? gaps / tot : 0;
    const gradMean = gradN ? gradSum / gradN : 12;
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    // Gradient range widened 16 → 20 when the strip went to 1080
    // columns (2026-10-19 capture upgrade): finer sampling measures
    // higher per-step gradients on the same iris, and the wider range
    // re-centres the grade on the pre-upgrade readings.
    const openness = 0.55 * clamp01(gapFrac / 0.3) + 0.45 * (1 - clamp01((gradMean - 6) / 20));
    constitutionGrade = Math.max(1, Math.min(10, Math.round(1 + 9 * openness)));
  }

  // Fibre texture (GLCM-lite): co-occurrence statistics of
  // neighbouring luminance levels along the fibres of the detection
  // strip — the measured texture behind the constitution grade.
  let texture: IrisProfile["texture"];
  {
    const LEVELS = 16;
    const glcm = new Float64Array(LEVELS * LEVELS);
    let pairs = 0;
    for (let t = 0; t < SH; t++) {
      for (let a = 0; a < SW; a++) {
        const i = t * SW + a;
        const j = t * SW + ((a + 2) % SW);
        if (!vis[i] || !vis[j]) continue;
        const qi = Math.max(0, Math.min(LEVELS - 1, Math.floor(lumD[i] / (256 / LEVELS))));
        const qj = Math.max(0, Math.min(LEVELS - 1, Math.floor(lumD[j] / (256 / LEVELS))));
        glcm[qi * LEVELS + qj] += 1;
        glcm[qj * LEVELS + qi] += 1;
        pairs += 2;
      }
    }
    if (pairs > 0) {
      let contrast = 0;
      let energy = 0;
      let homogeneity = 0;
      for (let i2 = 0; i2 < LEVELS; i2++) {
        for (let j2 = 0; j2 < LEVELS; j2++) {
          const p = glcm[i2 * LEVELS + j2] / pairs;
          if (!p) continue;
          const d = i2 - j2;
          contrast += d * d * p;
          energy += p * p;
          homogeneity += p / (1 + Math.abs(d));
        }
      }
      texture = {
        contrast: Math.round(contrast * 10) / 10,
        energy: Math.round(energy * 1000) / 1000,
        homogeneity: Math.round(homogeneity * 100) / 100,
        label: homogeneity >= 0.55 ? "fine" : homogeneity >= 0.38 ? "mixed" : "coarse",
      };
    }
  }

  const profile: IrisProfile = {
    constitutionGrade,
    pupilRatio: R > 0 ? rp / R : 0,
    meanLum: annulusLum,
    scurf,
    outerRing,
    stomachTone,
    ...(ringHeadNote ? { ringHeadNote: true } : {}),
    ...(texture ? { texture } : {}),
    ...(pupilFound && pupil.shape ? { pupilShape: pupil.shape } : {}),
  };

  /** Sample the traditional tone at a candidate's position. */
  const sampleTone = (thetaDeg: number, t: number) => {
    const a0 = Math.round((thetaDeg / 360) * SW);
    const t0 = Math.round(t * (SH - 1));
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let n = 0;
    for (let dt = -3; dt <= 3; dt++) {
      const tt = t0 + dt;
      if (tt < 0 || tt >= SH) continue;
      for (let da = -10; da <= 10; da++) {
        const i = tt * SW + (((a0 + da) % SW) + SW) % SW;
        if (!vis[i]) continue;
        sr += cr[i];
        sg += cg[i];
        sb += cb[i];
        n += 1;
      }
    }
    if (n < 6) return undefined;
    return classifyTone(sr / n, sg / n, sb / n, baseRGB);
  };

  const candidates: Candidate[] = [];

  // ── 4a. Dark-blob components → lacuna / pigment / radial furrow ──
  {
    const mask = new Uint8Array(SW * SH);
    for (let i = 0; i < mask.length; i++) {
      mask[i] = vis[i] && dark[i] > 31 && lumD[i] < annulusLumD + 6 ? 1 : 0;
    }
    const seen = new Uint8Array(SW * SH);
    const stack: number[] = [];
    for (let s = 0; s < mask.length; s++) {
      if (!mask[s] || seen[s]) continue;
      const cells: number[] = [];
      stack.length = 0;
      stack.push(s);
      seen[s] = 1;
      while (stack.length) {
        const cur = stack.pop() as number;
        cells.push(cur);
        const ca = cur % SW;
        const ct = Math.floor(cur / SW);
        const nbs = [
          ((ca + 1) % SW) + ct * SW,
          ((ca - 1 + SW) % SW) + ct * SW,
          ca + (ct - 1) * SW,
          ca + (ct + 1) * SW,
        ];
        for (const n of nbs) {
          if (n < 0 || n >= mask.length || seen[n] || !mask[n]) continue;
          seen[n] = 1;
          stack.push(n);
        }
      }
      if (cells.length < 22 || cells.length > 3375) continue;
      // Unwrap angles relative to the seed for span/centroid math.
      const seedA = cells[0] % SW;
      let sumA = 0;
      let sumT = 0;
      let sumDark = 0;
      let sumRed = 0;
      let sumSat = 0;
      let sumLum = 0;
      let minA = Infinity;
      let maxA = -Infinity;
      let minT = Infinity;
      let maxT = -Infinity;
      for (const i of cells) {
        let a = i % SW;
        if (a - seedA > SW / 2) a -= SW;
        if (a - seedA < -SW / 2) a += SW;
        const t = Math.floor(i / SW);
        sumA += a;
        sumT += t;
        sumDark += dark[i];
        sumRed += red[i];
        sumSat += sat[i];
        sumLum += lumD[i];
        if (a < minA) minA = a;
        if (a > maxA) maxA = a;
        if (t < minT) minT = t;
        if (t > maxT) maxT = t;
      }
      const n = cells.length;
      const meanDark = sumDark / n;
      const meanRed = sumRed / n;
      const meanSat = sumSat / n;
      const meanLum = sumLum / n;
      const angleSpanDeg = ((maxA - minA) / SW) * 360;
      if (angleSpanDeg > 130) continue;
      const radialSpanPx = ((maxT - minT) / SH) * (rOut - rIn);
      const midR = rIn + (sumT / n / SH) * (rOut - rIn);
      const angleSpanPx = (angleSpanDeg / 360) * 2 * Math.PI * Math.max(midR, 1);
      const elong = radialSpanPx / Math.max(angleSpanPx, 1);
      const thetaDeg = ((sumA / n / SW) * 360 + 360) % 360;
      const tC = sumT / n / SH;
      if (tC < 0.02 || tC > 0.98) continue;
      const redExcess = meanRed - redMean;
      const satExcess = meanSat - satMedian;
      const longRadial = radialSpanPx > (rOut - rIn) * 0.3;
      if (elong > 3.1 && longRadial && meanDark >= 30) {
        candidates.push({ sign: "radial", thetaDeg, t: tC, strength: Math.min(1, meanDark / 85) });
      } else if (redExcess > 16 && satExcess > 0.06 && meanLum > 50 && (meanDark >= 26 || redExcess > 26)) {
        candidates.push({
          sign: "pigment",
          thetaDeg,
          t: tC,
          strength: Math.min(1, (redExcess / 55) * 0.7 + meanDark / 140),
        });
      } else if (elong > 2.3 && longRadial && meanDark >= 32) {
        candidates.push({ sign: "radial", thetaDeg, t: tC, strength: Math.min(1, meanDark / 85) });
      } else if (meanDark >= 34) {
        // Lacuna silhouette: the angular width profile across the
        // blob's radial rows, classified into the dictionaries'
        // shape vocabulary (abstains when the shape is unclear).
        const rowWidths: number[] = [];
        for (let t = minT; t <= maxT; t++) rowWidths.push(0);
        for (const i of cells) rowWidths[Math.floor(i / SW) - minT]++;
        const shape = classifyLacunaShape({ elong, rowWidths, innerFrac: minT / SH });
        candidates.push({
          sign: "lacuna",
          thetaDeg,
          t: tC,
          strength: Math.min(1, meanDark / 88),
          ...(shape ? { shape } : {}),
        });
      }
    }
  }

  // ── 4b. Contraction rings: dips in the radial luminance profile ──
  {
    const profile = new Float32Array(SH);
    for (let t = 0; t < SH; t++) {
      let s = 0;
      let n = 0;
      for (let a = 0; a < SW; a += 2) {
        if (vis[t * SW + a]) {
          s += lumD[t * SW + a];
          n += 1;
        }
      }
      profile[t] = n ? s / n : annulusLumD;
    }
    const smooth = new Float32Array(SH);
    for (let t = 0; t < SH; t++) {
      let s = 0;
      let n = 0;
      for (let k = -3; k <= 3; k++) {
        const tt = t + k;
        if (tt >= 0 && tt < SH) {
          s += profile[tt];
          n += 1;
        }
      }
      smooth[t] = s / n;
    }
    interface Dip {
      t: number;
      depth: number;
    }
    const dips: Dip[] = [];
    for (let t = 8; t < SH - 8; t++) {
      const before = (smooth[t - 6] + smooth[t - 4] + smooth[t - 3]) / 3;
      const after = (smooth[t + 3] + smooth[t + 4] + smooth[t + 6]) / 3;
      const depth = Math.min(before, after) - smooth[t];
      if (depth > 5.5 && smooth[t] <= smooth[t - 1] && smooth[t] <= smooth[t + 1]) {
        if (!dips.some((d) => Math.abs(d.t - t) < 8)) dips.push({ t, depth });
      }
    }
    dips.sort((a, b) => b.depth - a.depth);
    for (const dip of dips.slice(0, 3)) {
      const tIdx = dip.t;
      for (let sIdx = 0; sIdx < 12; sIdx++) {
        // Mean darkness in this sector's columns around the dip row.
        let s = 0;
        let n = 0;
        const a0 = Math.floor(((sIdx * 30 - 12) / 360) * SW);
        const a1 = Math.floor(((sIdx * 30 + 12) / 360) * SW);
        for (let a = a0; a <= a1; a++) {
          const aa = ((a % SW) + SW) % SW;
          for (let dt = -2; dt <= 2; dt++) {
            const i = (tIdx + dt) * SW + aa;
            if (i >= 0 && i < dark.length && vis[i]) {
              s += dark[i];
              n += 1;
            }
          }
        }
        const mean = n ? s / n : 0;
        if (mean > 6.5) {
          candidates.push({
            sign: "ring",
            thetaDeg: (sIdx * 30 + 360) % 360,
            t: tIdx / SH,
            strength: Math.min(1, dip.depth / 17 + mean / 30),
          });
        }
      }
    }
  }

  // ── 4c/4d. Cell-grid detectors: cloudiness + fiber breakup ───────
  {
    const CA = 72; // 5° per cell
    const CT = 12;
    const cellLum = new Float32Array(CA * CT);
    const cellGrad = new Float32Array(CA * CT);
    const cellVis = new Float32Array(CA * CT);
    for (let ct = 0; ct < CT; ct++) {
      for (let ca = 0; ca < CA; ca++) {
        let sl = 0;
        let sg = 0;
        let sv = 0;
        let nn = 0;
        for (let t = ct * (SH / CT); t < (ct + 1) * (SH / CT); t++) {
          for (let a = ca * (SW / CA); a < (ca + 1) * (SW / CA); a++) {
            const i = Math.floor(t) * SW + Math.floor(a);
            if (!vis[i]) continue;
            sl += lumD[i];
            sv += 1;
            nn += 1;
            const iR = Math.floor(t) * SW + Math.min(SW - 1, Math.floor(a) + 3);
            sg += Math.abs(lumD[iR] - lumD[i]);
          }
        }
        const ci = ct * CA + ca;
        cellVis[ci] = nn ? sv / ((SH / CT) * (SW / CA)) : 0;
        cellLum[ci] = nn ? sl / nn : annulusLumD;
        cellGrad[ci] = nn ? sg / nn : 0;
      }
    }
    const grads = Array.from(cellGrad).filter((_, i) => cellVis[i] > 0.6).sort((a, b) => a - b);
    const medGrad = grads.length ? grads[Math.floor(grads.length / 2)] : 10;

    const compFrom = (qualifies: (ci: number) => boolean, sign: SignId, strengthOf: (cells: number[]) => number) => {
      const seenC = new Uint8Array(CA * CT);
      for (let s = 0; s < CA * CT; s++) {
        if (seenC[s] || !qualifies(s)) continue;
        const cells: number[] = [];
        const stack = [s];
        seenC[s] = 1;
        while (stack.length) {
          const cur = stack.pop() as number;
          cells.push(cur);
          const ca = cur % CA;
          const ct = Math.floor(cur / CA);
          const nbs = [((ca + 1) % CA) + ct * CA, ((ca - 1 + CA) % CA) + ct * CA, ca + (ct - 1) * CA, ca + (ct + 1) * CA];
          for (const nb of nbs) {
            if (nb < 0 || nb >= CA * CT || seenC[nb] || !qualifies(nb)) continue;
            seenC[nb] = 1;
            stack.push(nb);
          }
        }
        if (cells.length < 2 || cells.length > 40) continue;
        let sa = 0;
        let st = 0;
        const seedA = cells[0] % CA;
        for (const ci of cells) {
          let a = ci % CA;
          if (a - seedA > CA / 2) a -= CA;
          if (a - seedA < -CA / 2) a += CA;
          sa += a;
          st += Math.floor(ci / CA);
        }
        candidates.push({
          sign,
          thetaDeg: ((sa / cells.length / CA) * 360 + 360) % 360,
          t: st / cells.length / CT + 0.5 / CT,
          strength: strengthOf(cells),
        });
      }
    };

    compFrom(
      (ci) => cellVis[ci] > 0.6 && cellLum[ci] > annulusLumD + 15 && cellGrad[ci] < medGrad * 0.55,
      "cloudy",
      (cells) => Math.min(1, 0.35 + cells.length / 14),
    );
    compFrom(
      (ci) =>
        cellVis[ci] > 0.6 &&
        cellGrad[ci] < medGrad * 0.48 &&
        cellLum[ci] > annulusLumD - 8 &&
        !candidates.some((c) => {
          const ca = Math.floor((c.thetaDeg / 360) * CA);
          const ct = Math.floor(c.t * CT);
          return Math.abs(ca - (ci % CA)) <= 1 && Math.abs(ct - Math.floor(ci / CA)) <= 1;
        }),
      "fiber",
      (cells) => Math.min(1, 0.3 + cells.length / 16),
    );
  }

  // ── 5. Dedupe, cap, convert to chart markers ─────────────────────
  candidates.sort((a, b) => b.strength - a.strength);
  const SIGN_CAPS: Record<SignId, number> = { lacuna: 10, pigment: 10, radial: 10, ring: 10, cloudy: 10, fiber: 10 };
  const signCounts: Record<string, number> = {};
  const kept: Candidate[] = [];
  for (const c of candidates) {
    if (c.strength < 0.22) continue;
    if ((signCounts[c.sign] ?? 0) >= SIGN_CAPS[c.sign]) continue;
    const clash = kept.some((k) => {
      if (k.sign !== c.sign) return false;
      let da = Math.abs(k.thetaDeg - c.thetaDeg);
      if (da > 180) da = 360 - da;
      return da < 9 && Math.abs(k.t - c.t) < 0.13;
    });
    if (!clash) {
      kept.push(c);
      signCounts[c.sign] = (signCounts[c.sign] ?? 0) + 1;
    }
    // No total cap (Adam's call, 2026-10-17): the per-sign caps, the
    // strength floor, and dedupe are the guardrails.
  }

  // Square crop around the iris for the stored/displayed image.
  let side = Math.min(minDim, R * 2.7);
  side = Math.max(side, R * 2.15);
  // Never larger than the photo itself: a side beyond the frame
  // makes the output draw run past the photo's edge, leaving the
  // crop shrunk in a corner on black.
  side = Math.min(side, minDim);
  const cropX = Math.max(0, Math.min(W - side, cx - side / 2));
  const cropY = Math.max(0, Math.min(H - side, cy - side / 2));
  const irisRadiusFrac = R / (side / 2);

  let uidN = 0;
  const markers: Marker[] = [];
  for (const c of kept) {
    const th = (c.thetaDeg * Math.PI) / 180;
    const rAbs = rIn + c.t * (rOut - rIn);
    const pxX = cx + Math.sin(th) * rAbs;
    const pxY = cy - Math.cos(th) * rAbs;
    const x = (pxX - cropX) / side;
    const y = (pxY - cropY) / side;
    if (x < 0 || x > 1 || y < 0 || y > 1) continue;
    const loc = locate(x, y, irisRadiusFrac);
    if (!loc) continue;
    const tone = sampleTone(c.thetaDeg, c.t);
    markers.push({
      id: `auto-${Date.now()}-${uidN++}`,
      sign: c.sign,
      sector: loc.sector,
      zone: loc.zone,
      x,
      y,
      auto: true,
      confidence: c.strength >= 0.72 ? "strong" : c.strength >= 0.45 ? "moderate" : "light",
      ...(tone ? { tone } : {}),
      ...(c.shape ? { shape: c.shape } : {}),
    });
  }

  // ── 6. Constitution color estimate ───────────────────────────────
  let color: IrisColor = "brown";
  if (annulusN > 0) {
    const mr = rgbSum.r / annulusN;
    const mg = rgbSum.g / annulusN;
    const mb = rgbSum.b / annulusN;
    if (mb >= mr && mb >= mg - 4) color = "blue";
    else if (mg > mr * 0.92 && mb < mr * 0.8) color = "mixed";
    else color = "brown";
  }

  // ── 7. Photo quality on the crop ─────────────────────────────────
  const OUT = 1024;
  const out = document.createElement("canvas");
  out.width = OUT;
  out.height = OUT;
  const oCtx = out.getContext("2d", { willReadFrequently: true });
  let image = "";
  if (oCtx) {
    // The crop geometry was measured on the analysis image; map it
    // onto the display photo (same capture, possibly more pixels).
    const mx = img.naturalWidth / imgA.naturalWidth;
    const my = img.naturalHeight / imgA.naturalHeight;
    oCtx.drawImage(
      img,
      (cropX / aScale) * mx,
      (cropY / aScale) * my,
      (side / aScale) * mx,
      (side / aScale) * my,
      0,
      0,
      OUT,
      OUT,
    );
    if (darkIris) {
      // Display enhancement for dark irises: gentle gamma lift plus a
      // saturation boost, so the fibers are visible in the report
      // photo too — the note in the report says the photo is enhanced.
      const idata = oCtx.getImageData(0, 0, OUT, OUT);
      const dd = idata.data;
      for (let i = 0; i < dd.length; i += 4) {
        let r = 255 * Math.pow(dd[i] / 255, 0.78);
        let g = 255 * Math.pow(dd[i + 1] / 255, 0.78);
        let b = 255 * Math.pow(dd[i + 2] / 255, 0.78);
        const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        r = Math.max(0, Math.min(255, gray + (r - gray) * 1.3));
        g = Math.max(0, Math.min(255, gray + (g - gray) * 1.3));
        b = Math.max(0, Math.min(255, gray + (b - gray) * 1.3));
        dd[i] = r;
        dd[i + 1] = g;
        dd[i + 2] = b;
      }
      oCtx.putImageData(idata, 0, 0);
    }
    image = out.toDataURL("image/jpeg", 0.85);
    const d = oCtx.getImageData(0, 0, OUT, OUT).data;
    const spx = sampler(d, OUT, OUT);
    let sum = 0;
    let n = 0;
    let glare = 0;
    let grad = 0;
    let gn = 0;
    const qm = Math.round(OUT * 0.02);
    const qs = Math.round(OUT * 0.0117);
    for (let y = qm; y < OUT - qm; y += qs) {
      for (let x = qm; x < OUT - qm; x += qs) {
        const ddx = (x - OUT / 2) / (OUT / 2);
        const ddy = (y - OUT / 2) / (OUT / 2);
        const rr = Math.sqrt(ddx * ddx + ddy * ddy) / irisRadiusFrac;
        if (rr > 1 || rr < 0.3) continue;
        const c = spx(x, y);
        const g = lumOf(c);
        sum += g;
        n += 1;
        if (c.r > 238 && c.g > 238 && c.b > 238) glare += 1;
        const c2 = spx(x + qs, y);
        grad += Math.abs(lumOf(c2) - g);
        gn += 1;
      }
    }
    if (n > 0) {
      const bright = sum / n;
      const sharp = gn ? grad / gn : 0;
      if (bright < 45) qualityNotes.push("The photo was on the dark side, which can hide fainter signs.");
      if (bright > 225) qualityNotes.push("The photo was very bright or washed out, which can create false pale areas.");
      if (sharp < 6) qualityNotes.push("The photo was a little soft or blurry, so fine fiber detail may have been missed.");
      if (glare / n > 0.03) qualityNotes.push("There was glare on the iris, which can hide signs underneath it.");
    }
  }

  // ── 8. Overall confidence + occlusion note ───────────────────────
  let score = 1;
  if (!pupilFound) score -= 0.4;
  if (validFrac < 0.55) score -= 0.25;
  if (darkIris) score -= 0.22;
  score -= Math.min(0.2, qualityNotes.length * 0.07);
  const occludedSectors = new Set<number>();
  for (let k = 0; k < RAYS; k++) {
    if (!valid[k] || edgeR[k] < rp * 1.7) {
      const thDeg = (k / RAYS) * 360;
      const sector = Math.floor(((thDeg + 15) % 360) / 30);
      occludedSectors.add(sector === 0 ? 12 : sector);
    }
  }
  if (occludedSectors.size >= 3) {
    score -= 0.12;
    notes.push(
      `Part of the iris is covered (most often the top, by the eyelid) around the ${[...occludedSectors].sort((a, b) => a - b).join(", ")} o'clock positions — signs there may have been missed.`,
    );
  }
  if (markers.length === 0) {
    notes.push(
      "No strong signs stood out to the automatic reader in this photo. That can mean a clean, even iris — or a photo where the signs were too faint to measure. A sharper, brighter photo gives the reader more to work with.",
    );
  }
  const overallConfidence: AutoReadResult["overallConfidence"] =
    score >= 0.74 ? "high" : score >= 0.45 ? "moderate" : "low";

  return { markers, color, overallConfidence, notes, qualityNotes, image, contrastEnhanced: darkIris, profile };
}
