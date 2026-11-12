"use client";

import { useEffect, useRef, useState } from "react";
import FlierAutoPrint from "@/components/FlierAutoPrint";
import QRCode from "qrcode";
import { buildPostArt, type PostArtId } from "./postArt";

/** Printable advertisement fliers for one affiliate — a studio
 *  with thirty designs in three sizes, picked from one dropdown:
 *
 *    - full-page designs   (one flier per US Letter sheet)
 *    - quarter-page designs (4 fliers per sheet, cut guides drawn)
 *    - card-size designs    (3.5×2in cards, 10 per sheet)
 *
 *  Alongside the general designs, each of the ten share posts has
 *  a matching flier (full page and quarter page): the post's own
 *  artwork (drawn bare — no printed link on the art itself) over
 *  a band carrying the QR code, the printed link, and the
 *  disclaimer. Every design carries the affiliate's own referral
 *  link as a QR code plus the printed link. NO design shows a
 *  price (Adam's rule, 2026-11-01) — the price lives on the
 *  landing page, where it can change without reprinting. Each
 *  single flier is drawn once on its own canvas; the sheet (what
 *  preview shows, what downloads, what prints) is composed from
 *  that canvas, so the preview is exactly what comes off the
 *  printer. */

const TEAL_DARK = "#0d3b37";
const TEAL = "#0d5c55";
const TEAL_DEEP = "#082a27";
const GOLD = "#c9a227";
const GOLD_DEEP = "#9a7b1c";
const CREAM = "#f3ead8";
const CREAM_BG = "#f7f1e1";
const INK = "#17251f";
const DARK_BG = "#071a18";
const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const HEADLINE = "Reveal secrets to health through your eyes.";
const SUB =
  "Snap a photo of your eye and get a traditional iris reading in minutes — your signs, a body map, and a traditional diet focus, right on your phone.";
const SUB_SHORT = "A traditional iris reading from one photo of your eye — ready in minutes.";
const DISCLAIMER =
  "eyeKnow offers traditional iridology readings for interest and self-reflection. Not medical advice and not a diagnosis.";
const DISCLAIMER_SHORT = "Traditional iris reading — not medical advice.";

const SHEET_W = 1275;
const SHEET_H = 1650;

type Assets = {
  qr: HTMLImageElement | null;
  iris: HTMLImageElement | null;
  linkText: string;
  postArt: Partial<Record<PostArtId, HTMLCanvasElement>>;
};

type FlierDef = {
  id: string;
  name: string;
  size: "full" | "quarter" | "card";
  perPage: number;
  w: number;
  h: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, a: Assets) => void;
};

/* ---------- shared canvas helpers ---------- */

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Draw centered, wrapped text with its first baseline at y;
 *  returns the y just past the last line. */
function drawCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const lines = wrapLines(ctx, text, maxWidth);
  lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

/** Shrink the font (from startPx down) until text fits maxWidth.
 *  Sets ctx.font and returns the size used. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startPx: number,
  weight: string,
  family: string,
  floorPx = 11,
): number {
  let px = startPx;
  ctx.font = `${weight} ${px}px ${family}`;
  while (px > floorPx && ctx.measureText(text).width > maxWidth) {
    px -= 1;
    ctx.font = `${weight} ${px}px ${family}`;
  }
  return px;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function setTracking(ctx: CanvasRenderingContext2D, px: string) {
  try {
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = px;
  } catch {
    /* letterSpacing is a progressive enhancement only */
  }
}

function wordmark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  px: number,
  eyeColor: string,
  knowColor: string,
) {
  ctx.font = `700 ${px}px ${SERIF}`;
  const eyeW = ctx.measureText("eye").width;
  const knowW = ctx.measureText("Know").width;
  const startX = cx - (eyeW + knowW) / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  ctx.fillStyle = eyeColor;
  ctx.fillText("eye", startX, y);
  ctx.fillStyle = knowColor;
  ctx.fillText("Know", startX + eyeW, y);
  ctx.textAlign = prevAlign;
}

function irisCircle(
  ctx: CanvasRenderingContext2D,
  iris: HTMLImageElement | null,
  cx: number,
  cy: number,
  r: number,
  ring: string,
) {
  if (!iris) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const side = Math.min(iris.naturalWidth, iris.naturalHeight);
  const sx = (iris.naturalWidth - side) / 2;
  const sy = (iris.naturalHeight - side) / 2;
  ctx.drawImage(iris, sx, sy, side, side, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = ring;
  ctx.lineWidth = Math.max(3, r / 16);
  ctx.stroke();
}

function qrCard(
  ctx: CanvasRenderingContext2D,
  qr: HTMLImageElement | null,
  cx: number,
  y: number,
  size: number,
  border: string | null,
) {
  const x = cx - size / 2;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x, y, size, size, Math.round(size / 17));
  ctx.fill();
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, size, size, Math.round(size / 17));
    ctx.stroke();
  }
  if (qr) {
    const pad = Math.round(size * 0.068);
    ctx.drawImage(qr, x + pad, y + pad, size - pad * 2, size - pad * 2);
  }
}

function tealBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const grad = ctx.createLinearGradient(0, 0, w * 0.3, h);
  grad.addColorStop(0, TEAL);
  grad.addColorStop(0.55, TEAL_DARK);
  grad.addColorStop(1, TEAL_DEEP);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function doubleFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  outer: number,
  inner: number,
  color: string,
  outerLw: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = outerLw;
  ctx.strokeRect(outer, outer, w - outer * 2, h - outer * 2);
  ctx.lineWidth = Math.max(1, outerLw / 3);
  ctx.strokeRect(inner, inner, w - inner * 2, h - inner * 2);
}

/* ---------- full-page designs (1275×1650) ---------- */

function drawFullClassic(ctx: CanvasRenderingContext2D, w: number, h: number, a: Assets) {
  const cx = w / 2;
  tealBackground(ctx, w, h);
  doubleFrame(ctx, w, h, 46, 66, GOLD, 6);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  wordmark(ctx, cx, 168, 78, CREAM, GOLD);
  ctx.fillStyle = GOLD;
  ctx.fillRect(cx - 100, 196, 200, 4);
  irisCircle(ctx, a.iris, cx, 322, 108, GOLD);
  ctx.fillStyle = CREAM;
  ctx.font = `700 61px ${SERIF}`;
  const afterHeadline = drawCentered(ctx, HEADLINE, cx, 530, 980, 70);
  ctx.fillStyle = "rgba(243, 234, 216, 0.92)";
  ctx.font = `32px ${SANS}`;
  drawCentered(ctx, SUB, cx, afterHeadline + 58, 920, 44);
  qrCard(ctx, a.qr, cx, 856, 470, null);
  ctx.fillStyle = GOLD;
  ctx.font = `700 35px ${SANS}`;
  setTracking(ctx, "5px");
  ctx.fillText("SCAN TO START YOUR READING", cx, 1400);
  setTracking(ctx, "0px");
  ctx.fillStyle = CREAM;
  fitFont(ctx, a.linkText, 1000, 41, "700", SANS);
  ctx.fillText(a.linkText, cx, 1464);
  ctx.fillStyle = "rgba(243, 234, 216, 0.62)";
  ctx.font = `23px ${SANS}`;
  drawCentered(ctx, DISCLAIMER, cx, 1536, 980, 29);
}

function drawFullCream(ctx: CanvasRenderingContext2D, w: number, h: number, a: Assets) {
  const cx = w / 2;
  ctx.fillStyle = CREAM_BG;
  ctx.fillRect(0, 0, w, h);
  doubleFrame(ctx, w, h, 46, 66, TEAL, 6);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  wordmark(ctx, cx, 168, 78, TEAL_DARK, GOLD_DEEP);
  ctx.fillStyle = GOLD;
  ctx.fillRect(cx - 100, 196, 200, 4);
  irisCircle(ctx, a.iris, cx, 322, 108, TEAL);
  ctx.fillStyle = TEAL_DARK;
  ctx.font = `700 61px ${SERIF}`;
  const afterHeadline = drawCentered(ctx, HEADLINE, cx, 530, 980, 70);
  ctx.fillStyle = "rgba(23, 37, 31, 0.85)";
  ctx.font = `32px ${SANS}`;
  drawCentered(ctx, SUB, cx, afterHeadline + 58, 920, 44);
  qrCard(ctx, a.qr, cx, 856, 470, "rgba(13, 92, 85, 0.4)");
  ctx.fillStyle = TEAL_DARK;
  ctx.font = `700 35px ${SANS}`;
  setTracking(ctx, "5px");
  ctx.fillText("SCAN TO START YOUR READING", cx, 1400);
  setTracking(ctx, "0px");
  ctx.fillStyle = INK;
  fitFont(ctx, a.linkText, 1000, 41, "700", SANS);
  ctx.fillText(a.linkText, cx, 1464);
  ctx.fillStyle = "rgba(23, 37, 31, 0.6)";
  ctx.font = `23px ${SANS}`;
  drawCentered(ctx, DISCLAIMER, cx, 1536, 980, 29);
}

/* ---------- quarter-page designs (637×825, 4 per sheet) ---------- */

function quarterShell(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dark: boolean,
): { cx: number; head: string; body: string; dim: string; faint: string } {
  if (dark) {
    tealBackground(ctx, w, h);
    doubleFrame(ctx, w, h, 22, 32, GOLD, 3);
    return {
      cx: w / 2,
      head: CREAM,
      body: "rgba(243, 234, 216, 0.92)",
      dim: GOLD,
      faint: "rgba(243, 234, 216, 0.6)",
    };
  }
  ctx.fillStyle = CREAM_BG;
  ctx.fillRect(0, 0, w, h);
  doubleFrame(ctx, w, h, 22, 32, TEAL, 3);
  return {
    cx: w / 2,
    head: TEAL_DARK,
    body: "rgba(23, 37, 31, 0.85)",
    dim: TEAL_DARK,
    faint: "rgba(23, 37, 31, 0.58)",
  };
}

function quarterTail(
  ctx: CanvasRenderingContext2D,
  cx: number,
  a: Assets,
  colors: { dim: string; head: string; faint: string },
  qrY: number,
  qrSize: number,
  border: string | null,
) {
  qrCard(ctx, a.qr, cx, qrY, qrSize, border);
  ctx.fillStyle = colors.dim;
  ctx.font = `700 18px ${SANS}`;
  setTracking(ctx, "3px");
  ctx.fillText("SCAN TO START YOUR READING", cx, qrY + qrSize + 40);
  setTracking(ctx, "0px");
  ctx.fillStyle = colors.head;
  fitFont(ctx, a.linkText, 560, 21, "700", SANS);
  ctx.fillText(a.linkText, cx, qrY + qrSize + 76);
  ctx.fillStyle = colors.faint;
  ctx.font = `12px ${SANS}`;
  drawCentered(ctx, DISCLAIMER, cx, qrY + qrSize + 104, 520, 16);
}

function drawQuarterTeal(ctx: CanvasRenderingContext2D, w: number, h: number, a: Assets) {
  const c = quarterShell(ctx, w, h, true);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  wordmark(ctx, c.cx, 88, 42, CREAM, GOLD);
  irisCircle(ctx, a.iris, c.cx, 168, 50, GOLD);
  ctx.fillStyle = c.head;
  ctx.font = `700 33px ${SERIF}`;
  const after = drawCentered(ctx, HEADLINE, c.cx, 262, 520, 38);
  ctx.fillStyle = c.body;
  ctx.font = `17px ${SANS}`;
  drawCentered(ctx, SUB_SHORT, c.cx, after + 16, 500, 23);
  quarterTail(ctx, c.cx, a, c, 428, 236, null);
}

function drawQuarterCream(ctx: CanvasRenderingContext2D, w: number, h: number, a: Assets) {
  const c = quarterShell(ctx, w, h, false);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  wordmark(ctx, c.cx, 88, 42, TEAL_DARK, GOLD_DEEP);
  irisCircle(ctx, a.iris, c.cx, 168, 50, TEAL);
  ctx.fillStyle = c.head;
  ctx.font = `700 33px ${SERIF}`;
  const after = drawCentered(ctx, HEADLINE, c.cx, 262, 520, 38);
  ctx.fillStyle = c.body;
  ctx.font = `17px ${SANS}`;
  drawCentered(ctx, SUB_SHORT, c.cx, after + 16, 500, 23);
  quarterTail(ctx, c.cx, a, c, 428, 236, "rgba(13, 92, 85, 0.4)");
}

function drawQuarterGoldBand(ctx: CanvasRenderingContext2D, w: number, h: number, a: Assets) {
  const cx = w / 2;
  ctx.fillStyle = CREAM_BG;
  ctx.fillRect(0, 0, w, h);
  const band = ctx.createLinearGradient(0, 0, w, 118);
  band.addColorStop(0, "#dcbc4a");
  band.addColorStop(1, GOLD);
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, w, 118);
  ctx.fillStyle = TEAL_DARK;
  ctx.fillRect(0, 118, w, 4);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  wordmark(ctx, cx, 78, 44, TEAL_DARK, "#6d5600");
  ctx.fillStyle = TEAL_DARK;
  ctx.font = `700 33px ${SERIF}`;
  const after = drawCentered(ctx, HEADLINE, cx, 196, 520, 38);
  ctx.fillStyle = "rgba(23, 37, 31, 0.85)";
  ctx.font = `17px ${SANS}`;
  drawCentered(ctx, SUB_SHORT, cx, after + 16, 500, 23);
  quarterTail(
    ctx,
    cx,
    a,
    { dim: TEAL_DARK, head: INK, faint: "rgba(23, 37, 31, 0.58)" },
    428,
    236,
    "rgba(13, 92, 85, 0.4)",
  );
}

function drawQuarterIris(ctx: CanvasRenderingContext2D, w: number, h: number, a: Assets) {
  const cx = w / 2;
  tealBackground(ctx, w, h);
  if (a.iris) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, 292);
    ctx.clip();
    const scale = Math.max(w / a.iris.naturalWidth, 292 / a.iris.naturalHeight);
    const dw = a.iris.naturalWidth * scale;
    const dh = a.iris.naturalHeight * scale;
    ctx.drawImage(a.iris, (w - dw) / 2, (292 - dh) / 2, dw, dh);
    ctx.restore();
  }
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, 292, w, 5);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  wordmark(ctx, cx, 356, 40, CREAM, GOLD);
  ctx.fillStyle = CREAM;
  ctx.font = `700 33px ${SERIF}`;
  drawCentered(ctx, HEADLINE, cx, 412, 520, 38);
  qrCard(ctx, a.qr, cx, 500, 224, null);
  ctx.fillStyle = CREAM;
  fitFont(ctx, a.linkText, 560, 21, "700", SANS);
  ctx.fillText(a.linkText, cx, 764);
  ctx.fillStyle = "rgba(243, 234, 216, 0.6)";
  ctx.font = `11px ${SANS}`;
  drawCentered(ctx, DISCLAIMER_SHORT, cx, 792, 520, 14);
}

function drawQuarterBold(ctx: CanvasRenderingContext2D, w: number, h: number, a: Assets) {
  const cx = w / 2;
  ctx.fillStyle = "#0a2e2b";
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = GOLD;
  ctx.font = `700 21px ${SANS}`;
  setTracking(ctx, "4px");
  ctx.fillText("EYEKNOW", cx, 66);
  setTracking(ctx, "0px");
  ctx.fillStyle = CREAM;
  ctx.font = `700 46px ${SERIF}`;
  const after = drawCentered(ctx, HEADLINE, cx, 138, 545, 52);
  ctx.fillStyle = "rgba(243, 234, 216, 0.9)";
  ctx.font = `17px ${SANS}`;
  drawCentered(ctx, SUB_SHORT, cx, after + 22, 500, 23);
  qrCard(ctx, a.qr, cx, 428, 248, null);
  ctx.fillStyle = GOLD;
  ctx.font = `700 18px ${SANS}`;
  setTracking(ctx, "3px");
  ctx.fillText("SCAN TO START YOUR READING", cx, 716);
  setTracking(ctx, "0px");
  ctx.fillStyle = CREAM;
  fitFont(ctx, a.linkText, 560, 21, "700", SANS);
  ctx.fillText(a.linkText, cx, 752);
  ctx.fillStyle = "rgba(243, 234, 216, 0.55)";
  ctx.font = `11px ${SANS}`;
  drawCentered(ctx, DISCLAIMER_SHORT, cx, 786, 520, 14);
}

function drawQuarterDark(ctx: CanvasRenderingContext2D, w: number, h: number, a: Assets) {
  const cx = w / 2;
  ctx.fillStyle = DARK_BG;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, w - 44, h - 44);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  wordmark(ctx, cx, 88, 42, CREAM, GOLD);
  ctx.fillStyle = GOLD;
  ctx.font = `700 33px ${SERIF}`;
  const after = drawCentered(ctx, HEADLINE, cx, 168, 520, 38);
  ctx.fillStyle = "rgba(243, 234, 216, 0.88)";
  ctx.font = `17px ${SANS}`;
  drawCentered(ctx, SUB_SHORT, cx, after + 16, 500, 23);
  quarterTail(
    ctx,
    cx,
    a,
    { dim: GOLD, head: CREAM, faint: "rgba(243, 234, 216, 0.55)" },
    428,
    236,
    null,
  );
}

/* ---------- card designs (525×300, 10 per sheet) ---------- */

function drawCardBase(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  a: Assets,
  dark: boolean,
) {
  if (dark) {
    tealBackground(ctx, w, h);
  } else {
    ctx.fillStyle = CREAM_BG;
    ctx.fillRect(0, 0, w, h);
  }
  const head = dark ? CREAM : TEAL_DARK;
  const body = dark ? "rgba(243, 234, 216, 0.9)" : "rgba(23, 37, 31, 0.85)";
  const faint = dark ? "rgba(243, 234, 216, 0.6)" : "rgba(23, 37, 31, 0.58)";
  ctx.textBaseline = "alphabetic";
  // Left text zone (x 24..336), QR card on the right.
  ctx.textAlign = "left";
  wordmarkLeft(ctx, 24, 56, 30, dark ? CREAM : TEAL_DARK, dark ? GOLD : GOLD_DEEP);
  ctx.fillStyle = head;
  ctx.font = `700 24px ${SERIF}`;
  const lines = wrapLines(ctx, HEADLINE, 308);
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, 24, 102 + i * 28));
  ctx.fillStyle = body;
  ctx.font = `14px ${SANS}`;
  ctx.fillText("Traditional iris reading in minutes.", 24, 196);
  ctx.fillStyle = head;
  fitFont(ctx, a.linkText, 308, 16, "700", SANS, 10);
  ctx.fillText(a.linkText, 24, 234);
  ctx.fillStyle = faint;
  ctx.font = `10.5px ${SANS}`;
  ctx.fillText(DISCLAIMER_SHORT, 24, 264);
  // QR on the right.
  ctx.textAlign = "center";
  ctx.fillStyle = dark ? GOLD : TEAL_DARK;
  ctx.font = `700 12px ${SANS}`;
  setTracking(ctx, "2px");
  ctx.fillText("SCAN TO START", 428, 66);
  setTracking(ctx, "0px");
  qrCard(ctx, a.qr, 428, 80, 150, dark ? null : "rgba(13, 92, 85, 0.4)");
}

function wordmarkLeft(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  px: number,
  eyeColor: string,
  knowColor: string,
) {
  ctx.font = `700 ${px}px ${SERIF}`;
  const eyeW = ctx.measureText("eye").width;
  ctx.fillStyle = eyeColor;
  ctx.fillText("eye", x, y);
  ctx.fillStyle = knowColor;
  ctx.fillText("Know", x + eyeW, y);
}

/** Draw left-aligned, wrapped text with its first baseline at y;
 *  returns the y just past the last line. Caller sets textAlign. */
function drawLeftWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const lines = wrapLines(ctx, text, maxWidth);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

/* ---------- post-matching fliers ---------- */

/** The ten share posts, by their postArt id — each gets a matching
 *  flier in full page and quarter page. */
const POST_FLIERS: Array<{ post: PostArtId; name: string }> = [
  { post: "reading", name: "Your reading" },
  { post: "preview", name: "Free preview" },
  { post: "freescans", name: "10 free readings" },
  { post: "gift", name: "Gift a reading" },
  { post: "timeline", name: "Timeline" },
  { post: "subscription", name: "Subscription" },
  { post: "bodymap", name: "Body map" },
  { post: "diet", name: "Diet focus" },
  { post: "constitution", name: "Constitution" },
  { post: "books", name: "The books" },
];

/** A flier built from a share post's artwork: the post's square
 *  art (drawn bare, without its printed-link footer) on the brand
 *  background, over a band carrying the QR code, the printed
 *  link, and the disclaimer. */
function drawPostFlier(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  a: Assets,
  post: PostArtId,
  full: boolean,
) {
  tealBackground(ctx, w, h);
  const art = a.postArt[post];
  ctx.textAlign = "center";
  if (full) {
    const side = 1090;
    const ax = (w - side) / 2;
    const ay = 46;
    if (art) ctx.drawImage(art, ax, ay, side, side);
    const bandY = ay + side + 64;
    qrCard(ctx, a.qr, 330, bandY, 300, null);
    ctx.textAlign = "left";
    ctx.fillStyle = CREAM;
    ctx.font = `700 31px ${SANS}`;
    ctx.fillText("Scan to visit", 566, bandY + 52);
    ctx.fillStyle = GOLD;
    fitFont(ctx, a.linkText, 640, 36, "700", SANS);
    ctx.fillText(a.linkText, 566, bandY + 108);
    ctx.fillStyle = "rgba(243, 234, 216, 0.85)";
    ctx.font = `22px ${SANS}`;
    drawLeftWrapped(ctx, DISCLAIMER, 566, bandY + 158, 640, 30);
    ctx.textAlign = "center";
  } else {
    const side = 545;
    const ax = (w - side) / 2;
    const ay = 24;
    if (art) ctx.drawImage(art, ax, ay, side, side);
    const bandY = ay + side + 26;
    qrCard(ctx, a.qr, 128, bandY, 148, null);
    ctx.textAlign = "left";
    ctx.fillStyle = CREAM;
    ctx.font = `700 21px ${SANS}`;
    ctx.fillText("Scan to visit", 230, bandY + 34);
    ctx.fillStyle = GOLD;
    fitFont(ctx, a.linkText, 372, 23, "700", SANS);
    ctx.fillText(a.linkText, 230, bandY + 70);
    ctx.fillStyle = "rgba(243, 234, 216, 0.85)";
    ctx.font = `15px ${SANS}`;
    drawLeftWrapped(ctx, DISCLAIMER_SHORT, 230, bandY + 100, 372, 20);
    ctx.textAlign = "center";
  }
}

/* ---------- the catalogue ---------- */

const DESIGNS: FlierDef[] = [
  { id: "full-classic", name: "Classic teal", size: "full", perPage: 1, w: 1275, h: 1650, draw: drawFullClassic },
  { id: "full-cream", name: "Cream & teal", size: "full", perPage: 1, w: 1275, h: 1650, draw: drawFullCream },
  { id: "quarter-teal", name: "Teal mini", size: "quarter", perPage: 4, w: 637, h: 825, draw: drawQuarterTeal },
  { id: "quarter-cream", name: "Cream mini", size: "quarter", perPage: 4, w: 637, h: 825, draw: drawQuarterCream },
  { id: "quarter-gold-band", name: "Gold band", size: "quarter", perPage: 4, w: 637, h: 825, draw: drawQuarterGoldBand },
  { id: "quarter-iris", name: "Iris photo", size: "quarter", perPage: 4, w: 637, h: 825, draw: drawQuarterIris },
  { id: "quarter-bold", name: "Big headline", size: "quarter", perPage: 4, w: 637, h: 825, draw: drawQuarterBold },
  { id: "quarter-dark", name: "After dark", size: "quarter", perPage: 4, w: 637, h: 825, draw: drawQuarterDark },
  { id: "card-teal", name: "Card — teal", size: "card", perPage: 10, w: 525, h: 300, draw: (c, w, h, a) => drawCardBase(c, w, h, a, true) },
  { id: "card-cream", name: "Card — cream", size: "card", perPage: 10, w: 525, h: 300, draw: (c, w, h, a) => drawCardBase(c, w, h, a, false) },
  ...POST_FLIERS.map((p) => ({
    id: `post-${p.post}-full`,
    name: `${p.name} (post)`,
    size: "full" as const,
    perPage: 1,
    w: 1275,
    h: 1650,
    draw: (c: CanvasRenderingContext2D, w: number, h: number, a: Assets) =>
      drawPostFlier(c, w, h, a, p.post, true),
  })),
  ...POST_FLIERS.map((p) => ({
    id: `post-${p.post}-quarter`,
    name: `${p.name} (post)`,
    size: "quarter" as const,
    perPage: 4,
    w: 637,
    h: 825,
    draw: (c: CanvasRenderingContext2D, w: number, h: number, a: Assets) =>
      drawPostFlier(c, w, h, a, p.post, false),
  })),
];

const GROUPS: Array<{ size: FlierDef["size"]; title: string; note: string }> = [
  { size: "full", title: "Full page", note: "1 per sheet — posters and notice boards" },
  { size: "quarter", title: "Quarter page", note: "4 per sheet — handouts and counter fliers" },
  { size: "card", title: "Card size", note: "10 per sheet — 3.5×2in cards for wallets and counters" },
];

/** Compose the printable US Letter sheet for a design from its
 *  single-flier canvas, with dashed cut guides on multi-up sheets. */
function composeSheet(def: FlierDef, single: HTMLCanvasElement): HTMLCanvasElement {
  const sheet = document.createElement("canvas");
  sheet.width = SHEET_W;
  sheet.height = SHEET_H;
  const ctx = sheet.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, SHEET_W, SHEET_H);
  if (def.size === "full") {
    ctx.drawImage(single, 0, 0);
    return sheet;
  }
  if (def.size === "quarter") {
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        ctx.drawImage(single, c === 0 ? 0 : 638, r * 825);
      }
    }
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(637.5, 0);
    ctx.lineTo(637.5, SHEET_H);
    ctx.moveTo(0, 825);
    ctx.lineTo(SHEET_W, 825);
    ctx.stroke();
    ctx.setLineDash([]);
    return sheet;
  }
  // Cards: 2 columns × 5 rows of 525×300, centered on the sheet.
  const ox = Math.floor((SHEET_W - 1050) / 2);
  const oy = Math.floor((SHEET_H - 1500) / 2);
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 2; c++) {
      ctx.drawImage(single, ox + c * 525, oy + r * 300);
    }
  }
  ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 10]);
  ctx.strokeRect(ox, oy, 1050, 1500);
  ctx.beginPath();
  ctx.moveTo(ox + 525, oy);
  ctx.lineTo(ox + 525, oy + 1500);
  for (let r = 1; r < 5; r++) {
    ctx.moveTo(ox, oy + r * 300);
    ctx.lineTo(ox + 1050, oy + r * 300);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  return sheet;
}

export default function AffiliateFlier({
  link,
  handle,
}: {
  link: string;
  handle: string;
}) {
  const [selected, setSelected] = useState<string>("full-classic");
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [printingAll, setPrintingAll] = useState(false);
  const [built, setBuilt] = useState(false);
  const [failed, setFailed] = useState(false);
  const singlesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const sheetUrlRef = useRef<string | null>(null);

  const def = DESIGNS.find((d) => d.id === selected) ?? DESIGNS[0];

  // Build every design once per link: the QR + iris once, the ten
  // post artworks (bare — the fliers add their own link band),
  // then every design's single canvas.
  useEffect(() => {
    let live = true;
    setFailed(false);
    setBuilt(false);
    (async () => {
      const qrData = await QRCode.toDataURL(link, {
        width: 1024,
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: INK, light: "#ffffff" },
      });
      const [qr, iris] = await Promise.all([loadImage(qrData), loadImage("/demo-iris.jpg")]);
      const postArt: Partial<Record<PostArtId, HTMLCanvasElement>> = {};
      await Promise.all(
        POST_FLIERS.map(async (p) => {
          try {
            postArt[p.post] = await buildPostArt(p.post, link, { bare: true });
          } catch {
            /* one missing artwork must not sink the studio */
          }
        }),
      );
      if (!live) return;
      const assets: Assets = {
        qr,
        iris,
        linkText: link.replace(/^https?:\/\//, ""),
        postArt,
      };
      const singles = new Map<string, HTMLCanvasElement>();
      for (const d of DESIGNS) {
        const canvas = document.createElement("canvas");
        canvas.width = d.w;
        canvas.height = d.h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no 2d context");
        d.draw(ctx, d.w, d.h, assets);
        singles.set(d.id, canvas);
      }
      singlesRef.current = singles;
      setBuilt(true);
    })().catch(() => {
      if (live) setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [link]);

  // Compose the sheet for the selected design.
  useEffect(() => {
    const single = singlesRef.current.get(def.id);
    if (!built || !single) {
      setSheetUrl(null);
      return;
    }
    let live = true;
    composeSheet(def, single).toBlob((blob) => {
      if (!live || !blob) return;
      const url = URL.createObjectURL(blob);
      if (sheetUrlRef.current) URL.revokeObjectURL(sheetUrlRef.current);
      sheetUrlRef.current = url;
      setSheetUrl(url);
    }, "image/png");
    return () => {
      live = false;
    };
  }, [def, built]);

  useEffect(
    () => () => {
      if (sheetUrlRef.current) URL.revokeObjectURL(sheetUrlRef.current);
    },
    [],
  );

  // Print EVERY design in one run (Adam, 2026-11-05): each design's
  // composed sheet becomes one page of a single print job, so the
  // browser's "Save as PDF" produces one PDF of all thirty fliers.
  async function printAll() {
    const singles = singlesRef.current;
    if (!built || singles.size === 0) return;
    setPrintingAll(true);
    try {
      const pages: string[] = [];
      for (const d of DESIGNS) {
        const single = singles.get(d.id);
        if (!single) continue;
        pages.push(composeSheet(d, single).toDataURL("image/jpeg", 0.88));
      }
      if (pages.length === 0) return;
      const w = window.open("", "_blank");
      if (!w) return;
      const imgs = pages
        .map(
          (src, i) =>
            `<img class="pg" src="${src}" alt="eyeKnow flier sheet ${i + 1} of ${pages.length}" />`,
        )
        .join("");
      w.document.write(
        `<!doctype html><html><head><title>eyeKnow fliers — all ${pages.length} designs — ${handle}</title>` +
          `<style>@page { size: letter; margin: 0; } body { margin: 0; } img.pg { display: block; width: 100%; height: auto; page-break-after: always; } img.pg:last-child { page-break-after: auto; }</style>` +
          `</head><body>${imgs}` +
          `<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 120); };</` +
          `script></body></html>`,
      );
      w.document.close();
    } finally {
      setPrintingAll(false);
    }
  }

  /** The full all-designs flier PDF as a Blob — the same composed
   *  sheets printAll sends to the browser print window, packed with
   *  jsPDF (150 dpi JPEG pages) for JSPrintManager auto-print. */
  async function buildAllPdfBlob(): Promise<Blob | null> {
    const singles = singlesRef.current;
    if (!built || singles.size === 0) return null;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "in", format: "letter", orientation: "portrait" });
    let first = true;
    for (const d of DESIGNS) {
      const single = singles.get(d.id);
      if (!single) continue;
      if (!first) doc.addPage();
      first = false;
      doc.addImage(composeSheet(d, single).toDataURL("image/jpeg", 0.85), "JPEG", 0, 0, 8.5, 11);
    }
    return doc.output("blob");
  }

  function printSheet() {
    if (!sheetUrl) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(
      `<!doctype html><html><head><title>eyeKnow fliers — ${def.name} — ${handle}</title>` +
        `<style>@page { size: letter; margin: 0; } body { margin: 0; } img { display: block; width: 100%; height: auto; }</style>` +
        `</head><body><img src="${sheetUrl}" alt="eyeKnow affiliate fliers" ` +
        `onload="setTimeout(function(){ window.print(); }, 60)" /></body></html>`,
    );
    w.document.close();
  }

  if (failed) {
    return (
      <p className="muted">
        The fliers couldn&apos;t be generated here — your link above still works anywhere you
        paste it.
      </p>
    );
  }

  return (
    <div>
      <p className="muted" style={{ marginTop: -6 }}>
        Thirty designs in three sizes — including a matching flier for every share post.
        Every one carries your QR code and your link, and none of them shows a price, so a
        flier never goes out of date when your price changes. Pick a design to preview the
        full printed sheet.
      </p>
      <label>
        Flier design
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={{
            display: "block",
            width: "100%",
            marginTop: 4,
            marginBottom: 12,
            padding: "9px 10px",
            fontSize: 16,
          }}
        >
          {GROUPS.map((g) => (
            <optgroup key={g.size} label={`${g.title} — ${g.note}`}>
              {DESIGNS.filter((d) => d.size === g.size).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {sheetUrl ? (
        <img
          src={sheetUrl}
          alt={`Printable sheet of the ${def.name} eyeKnow flier with your referral QR code for ${link}`}
          style={{
            display: "block",
            width: "100%",
            maxWidth: 400,
            margin: "6px auto 14px",
            borderRadius: 6,
            boxShadow: "0 10px 30px rgba(13, 59, 55, 0.25)",
          }}
        />
      ) : (
        <p className="muted">Preparing your fliers…</p>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a
          className="btn big"
          href={sheetUrl ?? undefined}
          download={`eyeknow-flier-${handle}-${def.id}.png`}
          aria-disabled={!sheetUrl}
          style={!sheetUrl ? { pointerEvents: "none", opacity: 0.55 } : undefined}
        >
          Download sheet (PNG)
        </a>
        <button type="button" className="btn big" disabled={!sheetUrl} onClick={printSheet}>
          Print sheet
        </button>
        <button type="button" className="btn big" disabled={!built || printingAll} onClick={printAll}>
          {printingAll ? "Preparing all…" : `Print all ${DESIGNS.length} designs`}
        </button>
      </div>
      <p className="muted" style={{ marginBottom: 0, marginTop: 10 }}>
        <b>{def.name}</b> prints {def.perPage} per US Letter sheet
        {def.perPage > 1 ? " — the dashed lines are cut guides" : ""}. Print at 100% scale.
        Every QR code scans to your link, so sales through these fliers split with you as
        usual.
      </p>
      <FlierAutoPrint
        ready={built}
        pageCount={DESIGNS.length}
        pdfKey={link}
        getPdfBlob={buildAllPdfBlob}
      />
    </div>
  );
}
