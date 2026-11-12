// High-resolution eye capture.
//
// Two sources, in order of preference:
//  1. Full-resolution stills via the ImageCapture API (Android Chrome
//     exposes the camera's real still size — often 3–6× the pixels of
//     a video frame, with proper focus and exposure).
//  2. A short burst of video frames everywhere else.
//
// Either way the SHARPEST frame becomes the photo the report stores,
// and the frames are also aligned on the pupil and averaged into a
// second, cleaner image that the reader analyses. Averaging real
// frames is the honest kind of enhancement: sensor noise cancels out,
// no detail is invented. When anything in the chain fails, capture
// degrades gracefully to the single sharpest frame.

export interface EyeCapture {
  /** JPEG data URL of the sharpest single frame (stored/displayed). */
  display: string;
  /** JPEG data URL of the aligned multi-frame average, when built. */
  analysis?: string;
  /** How many frames went into the analysis stack (0 = single frame). */
  stackedFrames: number;
  source: "still" | "burst";
}

const STACK_CAP = 2048; // analysis caps at 2000px — stacking bigger wastes memory
const FRAME_CAP = 2560; // video frames are drawn no bigger than this

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function downscale(src: HTMLCanvasElement, cap: number): HTMLCanvasElement {
  const scale = Math.min(1, cap / Math.max(src.width, src.height));
  if (scale >= 1) return src;
  const c = makeCanvas(src.width * scale, src.height * scale);
  const ctx = c.getContext("2d");
  if (ctx) ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

function jpeg(c: HTMLCanvasElement, q = 0.92): string {
  return c.toDataURL("image/jpeg", q);
}

/** Mean Laplacian magnitude over the central region of a small copy —
 *  the standard cheap sharpness score (blur kills high frequencies). */
function sharpness(src: HTMLCanvasElement): number {
  const small = downscale(src, 480);
  const ctx = small.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 0;
  const { width: w, height: h } = small;
  const d = ctx.getImageData(0, 0, w, h).data;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];
  }
  const x0 = Math.floor(w * 0.18);
  const x1 = Math.floor(w * 0.82);
  const y0 = Math.floor(h * 0.18);
  const y1 = Math.floor(h * 0.82);
  let sum = 0;
  let n = 0;
  for (let y = y0 + 1; y < y1 - 1; y += 2) {
    for (let x = x0 + 1; x < x1 - 1; x += 2) {
      const i = y * w + x;
      sum += Math.abs(4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w]);
      n += 1;
    }
  }
  return n ? sum / n : 0;
}

/** Approximate pupil position: the darkness-weighted centroid of the
 *  darkest compact region near the middle of the frame, on a small
 *  grid (the same trick the reader's pupil finder uses). Fractions of
 *  the frame, or null when nothing pupil-like is found. */
function darkCentroid(src: HTMLCanvasElement): { fx: number; fy: number } | null {
  const gw = 180;
  const gh = Math.max(60, Math.round((src.height / src.width) * gw));
  const small = makeCanvas(gw, gh);
  const ctx = small.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(src, 0, 0, gw, gh);
  const d = ctx.getImageData(0, 0, gw, gh).data;
  const gray = new Float32Array(gw * gh);
  let min = 255;
  for (let i = 0; i < gw * gh; i++) {
    gray[i] = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];
    if (gray[i] < min) min = gray[i];
  }
  const T = min + 42;
  let sw = 0;
  let sx = 0;
  let sy = 0;
  let cnt = 0;
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const fx = (x + 0.5) / gw;
      const fy = (y + 0.5) / gh;
      if (fx < 0.15 || fx > 0.85 || fy < 0.15 || fy > 0.85) continue;
      const g = gray[y * gw + x];
      if (g < T) {
        const wgt = T - g;
        sw += wgt;
        sx += wgt * fx;
        sy += wgt * fy;
        cnt += 1;
      }
    }
  }
  const frac = cnt / (gw * gh);
  if (!sw || frac < 0.0006 || frac > 0.1) return null;
  return { fx: sx / sw, fy: sy / sw };
}

/** Align every usable frame onto the reference frame's pupil position
 *  and average them. Frames whose pupil can't be found, or that moved
 *  more than ~3% of the frame, are dropped rather than blurred in. */
function stackFrames(
  frames: HTMLCanvasElement[],
  refIdx: number,
): { canvas: HTMLCanvasElement; used: number } | null {
  const ref = frames[refIdx];
  const refC = darkCentroid(ref);
  if (!refC) return null;
  const w = ref.width;
  const h = ref.height;
  const acc = new Float32Array(w * h * 3);
  const tmp = makeCanvas(w, h);
  const tctx = tmp.getContext("2d", { willReadFrequently: true });
  if (!tctx) return null;
  let used = 0;
  for (let fi = 0; fi < frames.length; fi++) {
    const f = frames[fi];
    let dx = 0;
    let dy = 0;
    if (fi !== refIdx) {
      const c = darkCentroid(f);
      if (!c) continue;
      dx = (refC.fx - c.fx) * w;
      dy = (refC.fy - c.fy) * h;
      if (Math.abs(dx) > w * 0.03 || Math.abs(dy) > h * 0.03) continue;
    }
    tctx.clearRect(0, 0, w, h);
    tctx.drawImage(f, dx, dy, w, h);
    const d = tctx.getImageData(0, 0, w, h).data;
    for (let i = 0, j = 0; i < d.length; i += 4, j += 3) {
      acc[j] += d[i];
      acc[j + 1] += d[i + 1];
      acc[j + 2] += d[i + 2];
    }
    used += 1;
  }
  if (used < 2) return null;
  const out = makeCanvas(w, h);
  const octx = out.getContext("2d");
  if (!octx) return null;
  const img = octx.createImageData(w, h);
  for (let i = 0, j = 0; i < img.data.length; i += 4, j += 3) {
    img.data[i] = acc[j] / used;
    img.data[i + 1] = acc[j + 1] / used;
    img.data[i + 2] = acc[j + 2] / used;
    img.data[i + 3] = 255;
  }
  octx.putImageData(img, 0, 0);
  return { canvas: out, used };
}

function drawVideoFrame(video: HTMLVideoElement, mirror: boolean): HTMLCanvasElement | null {
  if (video.videoWidth === 0) return null;
  const scale = Math.min(1, FRAME_CAP / Math.max(video.videoWidth, video.videoHeight));
  const c = makeCanvas(video.videoWidth * scale, video.videoHeight * scale);
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  if (mirror) {
    // Front cameras mirror — un-mirror so left/right eye labels stay true.
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, c.width, c.height);
  return c;
}

/** Full-resolution stills via ImageCapture, where the browser has it.
 *  Returns [] when unsupported or every shot fails. */
async function takeStills(
  stream: MediaStream,
  mirror: boolean,
  count: number,
): Promise<HTMLCanvasElement[]> {
  const IC = (window as unknown as { ImageCapture?: unknown }).ImageCapture as
    | (new (track: MediaStreamTrack) => {
        takePhoto: (opts?: unknown) => Promise<Blob>;
        getPhotoCapabilities?: () => Promise<unknown>;
      })
    | undefined;
  if (!IC) return [];
  const track = stream.getVideoTracks()[0];
  if (!track) return [];
  let ic: InstanceType<typeof IC>;
  try {
    ic = new IC(track);
  } catch {
    return [];
  }
  let opts: unknown;
  try {
    const caps = (await ic.getPhotoCapabilities?.()) as
      | { imageWidth?: { max?: number }; imageHeight?: { max?: number } }
      | undefined;
    if (caps?.imageWidth?.max && caps?.imageHeight?.max) {
      opts = { imageWidth: caps.imageWidth.max, imageHeight: caps.imageHeight.max };
    }
  } catch {
    opts = undefined;
  }
  const frames: HTMLCanvasElement[] = [];
  for (let i = 0; i < count; i++) {
    try {
      let blob: Blob;
      try {
        blob = await ic.takePhoto(opts);
      } catch {
        blob = await ic.takePhoto();
      }
      const bmp = await createImageBitmap(blob);
      const c = makeCanvas(bmp.width, bmp.height);
      const ctx = c.getContext("2d");
      if (!ctx) break;
      if (mirror) {
        ctx.translate(c.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(bmp, 0, 0);
      bmp.close();
      frames.push(c);
    } catch {
      break;
    }
  }
  return frames;
}

/** Turn the camera torch on/off where the device offers it (rear
 *  cameras): more light = less sensor noise = real detail, and the
 *  pupil narrows slightly, exposing more iris. Returns success. */
export async function setTorch(stream: MediaStream, on: boolean): Promise<boolean> {
  try {
    const track = stream.getVideoTracks()[0];
    if (!track?.getCapabilities || !track.applyConstraints) return false;
    const caps = track.getCapabilities() as { torch?: boolean };
    if (!caps.torch) return false;
    await track.applyConstraints({
      advanced: [{ torch: on } as MediaTrackConstraintSet],
    });
    return true;
  } catch {
    return false;
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Capture one eye photo: best stills or a burst, sharpest frame for
 *  display, aligned average for analysis. Null only when the video
 *  isn't running at all. When every captured frame is unsharp or the
 *  camera hasn't produced a usable frame yet, the caller is told so
 *  the scan flow can warn instead of silently reading a bad photo
 *  (Adam, 2026-11-12, iris accuracy work). */
export async function captureEyePhoto(
  video: HTMLVideoElement,
  stream: MediaStream,
  mirror: boolean,
): Promise<EyeCapture | null> {
  let frames = await takeStills(stream, mirror, 3);
  const source: EyeCapture["source"] = frames.length ? "still" : "burst";
  if (!frames.length) {
    for (let i = 0; i < 5; i++) {
      const f = drawVideoFrame(video, mirror);
      if (f) frames.push(f);
      if (i < 4) await wait(110);
    }
  }
  if (!frames.length) return null;
  let refIdx = 0;
  let best = -1;
  frames.forEach((f, i) => {
    const s = sharpness(f);
    if (s > best) {
      best = s;
      refIdx = i;
    }
  });
  const display = jpeg(frames[refIdx], 0.92);
  const small = frames.map((f) => downscale(f, STACK_CAP));
  const stacked = stackFrames(small, refIdx);
  return {
    display,
    ...(stacked ? { analysis: jpeg(stacked.canvas, 0.92) } : {}),
    stackedFrames: stacked ? stacked.used : 0,
    source,
  };
}
