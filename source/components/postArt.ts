"use client";

/** Artwork for the affiliate share posts — one square (1080×1080)
 *  picture per post template, drawn on canvas in the same
 *  teal-and-gold language as the printable fliers. Every picture
 *  prints the affiliate's link along the bottom (so a screenshot
 *  still points back to them) and shows NO price — prices live in
 *  the post text and on the landing page, so a picture never goes
 *  stale. Used by components/ShareToolbox.tsx for the preview, the
 *  native share sheet (as a file), and Save image. */

const TEAL_DARK = "#0d3b37";
const TEAL = "#0d5c55";
const TEAL_DEEP = "#082a27";
const GOLD = "#c9a227";
const GOLD_LIGHT = "#dcbc4a";
const CREAM = "#f3ead8";
const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const S = 1080;
const CX = S / 2;
const HEADLINE = "Reveal secrets to health through your eyes.";

export type PostArtId =
  | "reading"
  | "preview"
  | "freescans"
  | "gift"
  | "books"
  | "timeline"
  | "subscription"
  | "bodymap"
  | "diet"
  | "constitution";

type Assets = {
  iris: HTMLImageElement | null;
  greens: HTMLImageElement | null;
  coverGround: HTMLImageElement | null;
  coverTrouble: HTMLImageElement | null;
  linkText: string;
};

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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

function drawCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const lines = wrapLines(ctx, text, maxWidth);
  lines.forEach((l, i) => ctx.fillText(l, CX, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startPx: number,
  weight: string,
  family: string,
): void {
  let px = startPx;
  ctx.font = `${weight} ${px}px ${family}`;
  while (px > 12 && ctx.measureText(text).width > maxWidth) {
    px -= 1;
    ctx.font = `${weight} ${px}px ${family}`;
  }
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

/** Shared frame: teal gradient, gold hairline border, wordmark at
 *  the top, gold rule + the affiliate's link at the bottom. */
function frame(ctx: CanvasRenderingContext2D) {
  const grad = ctx.createLinearGradient(0, 0, S * 0.3, S);
  grad.addColorStop(0, TEAL);
  grad.addColorStop(0.55, TEAL_DARK);
  grad.addColorStop(1, TEAL_DEEP);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, S - 56, S - 56);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  // Wordmark.
  ctx.font = `700 46px ${SERIF}`;
  const eyeW = ctx.measureText("eye").width;
  const knowW = ctx.measureText("Know").width;
  const startX = CX - (eyeW + knowW) / 2;
  ctx.textAlign = "left";
  ctx.fillStyle = CREAM;
  ctx.fillText("eye", startX, 96);
  ctx.fillStyle = GOLD_LIGHT;
  ctx.fillText("Know", startX + eyeW, 96);
  ctx.textAlign = "center";
}

function footer(ctx: CanvasRenderingContext2D, linkText: string) {
  // Bare art (for the printable fliers, which add their own QR and
  // link band) passes an empty link text and gets no footer.
  if (!linkText) return;
  ctx.fillStyle = GOLD;
  ctx.fillRect(CX - 70, 952, 140, 3);
  ctx.fillStyle = CREAM;
  fitFont(ctx, linkText, 880, 30, "700", SANS);
  ctx.fillText(linkText, CX, 1002);
}

function circlePhoto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  cx: number,
  cy: number,
  r: number,
) {
  if (!img) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(243, 234, 216, 0.12)";
    ctx.fill();
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    ctx.drawImage(img, sx, sy, side, side, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 6;
  ctx.stroke();
}

function irisCircle(
  ctx: CanvasRenderingContext2D,
  iris: HTMLImageElement | null,
  cx: number,
  cy: number,
  r: number,
) {
  circlePhoto(ctx, iris, cx, cy, r);
}

function drawReading(ctx: CanvasRenderingContext2D, a: Assets) {
  frame(ctx);
  irisCircle(ctx, a.iris, CX, 415, 235);
  ctx.fillStyle = CREAM;
  ctx.font = `700 57px ${SERIF}`;
  const after = drawCentered(ctx, HEADLINE, 745, 880, 66);
  ctx.fillStyle = "rgba(243, 234, 216, 0.9)";
  ctx.font = `28px ${SANS}`;
  drawCentered(ctx, "A traditional iris reading from one photo of your eye.", after + 30, 840, 38);
  footer(ctx, a.linkText);
}

function drawPreview(ctx: CanvasRenderingContext2D, a: Assets) {
  frame(ctx);
  irisCircle(ctx, a.iris, CX, 300, 118);
  ctx.fillStyle = GOLD_LIGHT;
  fitFont(ctx, "FREE PREVIEW", 900, 96, "700", SANS);
  ctx.fillText("FREE PREVIEW", CX, 590);
  ctx.fillStyle = CREAM;
  ctx.font = `700 42px ${SERIF}`;
  const after = drawCentered(ctx, "See the top signs in your iris — free.", 672, 880, 52);
  ctx.fillStyle = "rgba(243, 234, 216, 0.9)";
  ctx.font = `28px ${SANS}`;
  drawCentered(ctx, "No account. No card. Just look — then decide.", after + 26, 840, 38);
  footer(ctx, a.linkText);
}

function drawFreeScans(ctx: CanvasRenderingContext2D, a: Assets) {
  frame(ctx);
  // Ten gold dots in a ring — one per free reading.
  const ringR = 262;
  ctx.fillStyle = GOLD;
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 10;
    ctx.beginPath();
    ctx.arc(CX + ringR * Math.cos(ang), 400 + ringR * Math.sin(ang), 17, 0, Math.PI * 2);
    ctx.fill();
  }
  irisCircle(ctx, a.iris, CX, 400, 178);
  ctx.fillStyle = GOLD_LIGHT;
  fitFont(ctx, "10 FREE READINGS", 920, 78, "700", SANS);
  ctx.fillText("10 FREE READINGS", CX, 782);
  ctx.fillStyle = "rgba(243, 234, 216, 0.92)";
  ctx.font = `28px ${SANS}`;
  drawCentered(
    ctx,
    "come with every full reading bought through my link — one for you, ten to pass around.",
    838,
    830,
    38,
  );
  footer(ctx, a.linkText);
}

function drawGift(ctx: CanvasRenderingContext2D, a: Assets) {
  frame(ctx);
  // A gift box in gold line work: lid, body, ribbon, bow.
  const bx = CX - 165;
  const by = 300;
  ctx.strokeStyle = GOLD_LIGHT;
  ctx.lineWidth = 7;
  ctx.fillStyle = "rgba(220, 188, 74, 0.14)";
  // Bow: two loops.
  ctx.save();
  ctx.translate(CX - 52, by - 38);
  ctx.rotate(-0.5);
  ctx.beginPath();
  ctx.ellipse(0, 0, 56, 30, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.translate(CX + 52, by - 38);
  ctx.rotate(0.5);
  ctx.beginPath();
  ctx.ellipse(0, 0, 56, 30, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  // Lid.
  roundRect(ctx, bx - 18, by, 366, 62, 10);
  ctx.fill();
  ctx.stroke();
  // Body.
  roundRect(ctx, bx, by + 62, 330, 218, 10);
  ctx.fill();
  ctx.stroke();
  // Ribbon cross.
  ctx.fillStyle = GOLD;
  ctx.fillRect(CX - 24, by, 48, 62);
  ctx.fillRect(CX - 24, by + 62, 48, 218);
  ctx.fillStyle = CREAM;
  ctx.font = `700 58px ${SERIF}`;
  ctx.fillText("Gift a reading", CX, 700);
  ctx.fillStyle = "rgba(243, 234, 216, 0.92)";
  ctx.font = `28px ${SANS}`;
  drawCentered(
    ctx,
    "Send someone a full eyeKnow reading — it arrives as a link and unlocks in full for them.",
    762,
    830,
    38,
  );
  footer(ctx, a.linkText);
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  cx: number,
  cy: number,
  w: number,
  h: number,
  angle: number,
  title: string,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-w / 2 - 7, -h / 2 - 7, w + 14, h + 14);
  if (img) {
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.clip();
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  } else {
    ctx.fillStyle = TEAL_DARK;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = CREAM;
    ctx.font = `700 30px ${SERIF}`;
    drawCenteredAt(ctx, title, 0, w - 40, 38);
  }
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawCenteredAt(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const lines = wrapLines(ctx, text, maxWidth);
  lines.forEach((l, i) => ctx.fillText(l, 0, y + i * lineHeight));
}

function drawBooks(ctx: CanvasRenderingContext2D, a: Assets) {
  frame(ctx);
  drawCover(ctx, a.coverGround, 388, 415, 296, 444, -0.055, "The Ground We Stand On");
  drawCover(ctx, a.coverTrouble, 692, 415, 296, 444, 0.055, "The Trouble with English");
  ctx.fillStyle = CREAM;
  ctx.font = `700 52px ${SERIF}`;
  ctx.fillText("Books by Kyle Jacob Butler", CX, 742);
  ctx.fillStyle = "rgba(243, 234, 216, 0.92)";
  ctx.font = `28px ${SANS}`;
  drawCentered(ctx, "The Ground We Stand On and The Trouble with English — instant downloads.", 806, 830, 38);
  footer(ctx, a.linkText);
}

function drawTimeline(ctx: CanvasRenderingContext2D, a: Assets) {
  frame(ctx);
  irisCircle(ctx, a.iris, 252, 400, 102);
  irisCircle(ctx, a.iris, CX, 400, 102);
  irisCircle(ctx, a.iris, 828, 400, 102);
  ctx.fillStyle = GOLD_LIGHT;
  ctx.font = `700 56px ${SANS}`;
  ctx.fillText("→", 396, 418);
  ctx.fillText("→", 684, 418);
  ctx.fillStyle = CREAM;
  ctx.font = `700 56px ${SERIF}`;
  ctx.fillText("Watch your signs change", CX, 700);
  ctx.fillStyle = "rgba(243, 234, 216, 0.92)";
  ctx.font = `28px ${SANS}`;
  drawCentered(
    ctx,
    "Rescan the same iris over time — every new scan is compared with the last.",
    762,
    830,
    38,
  );
  footer(ctx, a.linkText);
}

function drawSubscription(ctx: CanvasRenderingContext2D, a: Assets) {
  frame(ctx);
  // A calendar card: one gold dot per week — a reading every week.
  const x = 330;
  const y = 168;
  const w = 420;
  const h = 400;
  ctx.fillStyle = CREAM;
  roundRect(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.fillStyle = TEAL_DARK;
  roundRect(ctx, x, y, w, 64, 18);
  ctx.fill();
  ctx.fillRect(x, y + 44, w, 20);
  ctx.fillStyle = GOLD;
  for (const hx of [x + 70, x + w - 70]) {
    ctx.beginPath();
    ctx.arc(hx, y, 13, 0, Math.PI * 2);
    ctx.fill();
  }
  const cols = 7;
  const rows = 4;
  const gx = (w - 76) / (cols - 1);
  const gy = 62;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dx = x + 38 + c * gx;
      const dy = y + 118 + r * gy;
      const weekly = c === 2;
      ctx.beginPath();
      ctx.arc(dx, dy, weekly ? 15 : 10, 0, Math.PI * 2);
      ctx.fillStyle = weekly ? GOLD : "rgba(13, 59, 55, 0.3)";
      ctx.fill();
      if (weekly) {
        ctx.strokeStyle = TEAL_DARK;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
  }
  ctx.fillStyle = GOLD_LIGHT;
  fitFont(ctx, "A READING EVERY WEEK", 920, 68, "700", SANS);
  ctx.fillText("A READING EVERY WEEK", CX, 690);
  ctx.fillStyle = "rgba(243, 234, 216, 0.92)";
  ctx.font = `28px ${SANS}`;
  drawCentered(
    ctx,
    "The Timeline subscription: weekly scans of each iris, plus a personal overview by a real person every month.",
    752,
    830,
    38,
  );
  footer(ctx, a.linkText);
}

function drawBodymap(ctx: CanvasRenderingContext2D, a: Assets) {
  frame(ctx);
  ctx.strokeStyle = GOLD_LIGHT;
  ctx.lineWidth = 6;
  ctx.fillStyle = "rgba(243, 234, 216, 0.08)";
  // Head.
  ctx.beginPath();
  ctx.arc(CX, 252, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Torso.
  roundRect(ctx, CX - 80, 312, 160, 236, 72);
  ctx.fill();
  ctx.stroke();
  // Legs.
  roundRect(ctx, CX - 72, 548, 62, 128, 28);
  ctx.fill();
  ctx.stroke();
  roundRect(ctx, CX + 10, 548, 62, 128, 28);
  ctx.fill();
  ctx.stroke();
  // Arms.
  ctx.beginPath();
  ctx.moveTo(CX - 74, 344);
  ctx.lineTo(CX - 138, 500);
  ctx.moveTo(CX + 74, 344);
  ctx.lineTo(CX + 138, 500);
  ctx.stroke();
  // Hot spots lit by signs.
  for (const [hx, hy] of [
    [CX, 380],
    [CX - 34, 452],
    [CX + 38, 492],
  ] as Array<[number, number]>) {
    ctx.beginPath();
    ctx.arc(hx, hy, 17, 0, Math.PI * 2);
    ctx.fillStyle = GOLD;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hx, hy, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }
  ctx.fillStyle = CREAM;
  ctx.font = `700 50px ${SERIF}`;
  ctx.fillText("Your signs, on a body map", CX, 770);
  ctx.fillStyle = "rgba(243, 234, 216, 0.92)";
  ctx.font = `28px ${SANS}`;
  drawCentered(ctx, "Every finding placed where tradition maps it — tap a lit area and its signs pop up.", 830, 830, 38);
  footer(ctx, a.linkText);
}

function drawDiet(ctx: CanvasRenderingContext2D, a: Assets) {
  frame(ctx);
  circlePhoto(ctx, a.greens, CX, 400, 205);
  ctx.fillStyle = CREAM;
  ctx.font = `700 56px ${SERIF}`;
  ctx.fillText("Eat for your pattern", CX, 716);
  ctx.fillStyle = "rgba(243, 234, 216, 0.92)";
  ctx.font = `28px ${SANS}`;
  drawCentered(
    ctx,
    "A traditional diet focus built from your constitution and the areas your signs highlight.",
    778,
    830,
    38,
  );
  footer(ctx, a.linkText);
}

function drawnIris(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  inner: string,
  outer: string,
  label: string,
) {
  const grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 5;
  ctx.stroke();
  // Fibres.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const ang = (i * Math.PI) / 6;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * r * 0.38, cy + Math.sin(ang) * r * 0.38);
    ctx.lineTo(cx + Math.cos(ang) * r * 0.92, cy + Math.sin(ang) * r * 0.92);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.34, 0, Math.PI * 2);
  ctx.fillStyle = "#101010";
  ctx.fill();
  ctx.fillStyle = "rgba(243, 234, 216, 0.9)";
  ctx.font = `26px ${SANS}`;
  ctx.fillText(label, cx, cy + r + 44);
}

function drawConstitution(ctx: CanvasRenderingContext2D, a: Assets) {
  frame(ctx);
  drawnIris(ctx, 252, 390, 104, "#8fb6d9", "#2c4a6b", "Lymphatic");
  drawnIris(ctx, CX, 390, 104, "#a8703a", "#472a12", "Hematogenic");
  drawnIris(ctx, 828, 390, 104, "#c2ab54", "#5c5426", "Biliary");
  ctx.fillStyle = CREAM;
  ctx.font = `700 56px ${SERIF}`;
  ctx.fillText("What type are you?", CX, 690);
  ctx.fillStyle = "rgba(243, 234, 216, 0.92)";
  ctx.font = `28px ${SANS}`;
  drawCentered(ctx, "Your constitution, read traditionally from the colour of your iris.", 752, 830, 38);
  footer(ctx, a.linkText);
}

const DRAWERS: Record<PostArtId, (ctx: CanvasRenderingContext2D, a: Assets) => void> = {
  reading: drawReading,
  preview: drawPreview,
  freescans: drawFreeScans,
  gift: drawGift,
  books: drawBooks,
  timeline: drawTimeline,
  subscription: drawSubscription,
  bodymap: drawBodymap,
  diet: drawDiet,
  constitution: drawConstitution,
};

/** Discount badge for the share picture (Adam, 2026-11-01):
 *  when the affiliate's price beats the $19.99 base, the picture
 *  carries a small cream badge, top-right — the base price struck
 *  through, smaller, above their price. Only the share art gets
 *  it: the fliers' bare version stays price-free, and the generic
 *  /share-art previews stay price-free too (they serve everyone). */
function drawPriceBadge(ctx: CanvasRenderingContext2D, priceCents: number) {
  const base = "$19.99";
  const price = `$${(priceCents / 100).toFixed(2)}`;
  const w = 252;
  const h = 110;
  const x = S - 52 - w;
  const y = 50;
  ctx.save();
  roundRect(ctx, x, y, w, h, 18);
  ctx.fillStyle = CREAM;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = GOLD;
  ctx.stroke();
  ctx.textAlign = "center";
  // Their price, big.
  ctx.fillStyle = TEAL_DARK;
  ctx.font = `800 47px ${SANS}`;
  ctx.fillText(price, x + w / 2, y + 55);
  // The base price, smaller, struck through.
  ctx.font = `600 27px ${SANS}`;
  const bw = ctx.measureText(base).width;
  ctx.fillStyle = "rgba(23, 37, 31, 0.72)";
  ctx.fillText(base, x + w / 2, y + 92);
  ctx.strokeStyle = "rgba(179, 38, 30, 0.85)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + w / 2 - bw / 2 - 4, y + 83);
  ctx.lineTo(x + w / 2 + bw / 2 + 4, y + 83);
  ctx.stroke();
  ctx.restore();
}

/** Build the square artwork for one post template. With
 *  `bare: true` the printed-link footer is left off — the
 *  printable fliers use that version and add their own QR code
 *  and link band underneath. `priceCents` (the affiliate's saved
 *  price) adds the discount badge when it beats the base price. */
export async function buildPostArt(
  id: PostArtId,
  link: string,
  opts?: { bare?: boolean; priceCents?: number },
): Promise<HTMLCanvasElement> {
  const [iris, greens, coverGround, coverTrouble] = await Promise.all([
    loadImage("/demo-iris.jpg"),
    loadImage("/diet/greens.jpg"),
    loadImage("/book-covers/ground-we-stand-on.jpg"),
    loadImage("/book-covers/trouble-with-english.jpg"),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  DRAWERS[id](ctx, {
    iris,
    greens,
    coverGround,
    coverTrouble,
    linkText: opts?.bare ? "" : link.replace(/^https?:\/\//, ""),
  });
  if (!opts?.bare && opts?.priceCents && opts.priceCents < 1999) {
    drawPriceBadge(ctx, opts.priceCents);
  }
  return canvas;
}
