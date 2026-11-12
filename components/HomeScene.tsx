"use client";

// The home page's scroll journey (Adam, 2026-11-03): a fixed scene
// behind the content that starts as the animated galaxy, changes
// to a soft sky with drifting clouds as you scroll down, and grows
// grass along the bottom of the screen as you scroll to the very
// bottom. Driven by scroll progress through direct style writes
// (no React re-renders); prefers-reduced-motion gets the settled
// daytime scene with the grass fully grown.

import { useEffect, useRef } from "react";
import Galaxy from "./Galaxy";
import ShareButtons from "./ShareButtons";
import TaosWalker from "./TaosWalker";

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Blade = { d: string; w: number; c: string };

function makeGrass(seed: number, count: number, hMin: number, hMax: number, colors: string[]): Blade[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => {
    const x = (i / count) * 1000 + (rnd() - 0.5) * 14;
    const h = hMin + rnd() * (hMax - hMin);
    const bend = (rnd() - 0.5) * 34;
    const tip = bend * 1.7;
    return {
      d: `M ${x.toFixed(1)} 170 C ${(x + bend * 0.3).toFixed(1)} ${(170 - h * 0.55).toFixed(1)}, ${(x + bend).toFixed(1)} ${(170 - h * 0.82).toFixed(1)}, ${(x + tip).toFixed(1)} ${(170 - h).toFixed(1)}`,
      w: 3.5 + rnd() * 3.2,
      c: colors[Math.floor(rnd() * colors.length)],
    };
  });
}

// Taller grass (Adam, 2026-11-05): blade heights roughly half again
// as tall, in a 170-unit field.
// The bosque: cottonwoods along the river (Adam, 2026-11-05).
// left = % across the screen, size = relative scale, lag = how far
// into the grow phase this tree waits before it starts growing.
const TREES = [
  { left: "0%", size: 0.72, lag: 0.05, gold: true },
  { left: "90%", size: 0.78, lag: 0.3, gold: false },
];

// Rim grass for the cliff tops: sparser and shorter than the old
// full-width bottom grass, so the cliffs and bridge stay visible.
const GRASS_BACK = makeGrass(777, 34, 13, 40, ["#1d5c33", "#256b3a", "#1a5230"]);
const GRASS_FRONT = makeGrass(4242, 42, 15, 46, ["#2e7d46", "#359551", "#3fa055", "#2a6e3e"]);

// Drift durations roughly halved and the travel widened in CSS —
// the sky should feel alive, not glacial (Adam, 2026-11-05).
const CLOUDS = [
  { top: "10%", left: "4%", w: 190, dur: 40, delay: -22, op: 0.95 },
  { top: "20%", left: "58%", w: 140, dur: 32, delay: -25, op: 0.85 },
  { top: "30%", left: "26%", w: 230, dur: 48, delay: -8, op: 0.9 },
  { top: "42%", left: "74%", w: 120, dur: 28, delay: -17, op: 0.75 },
  { top: "52%", left: "8%", w: 160, dur: 44, delay: -31, op: 0.85 },
  { top: "63%", left: "48%", w: 200, dur: 36, delay: -14, op: 0.8 },
  { top: "74%", left: "80%", w: 150, dur: 34, delay: -27, op: 0.7 },
];

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export default function HomeScene({
  onCreator,
  reducedMotion = false,
}: {
  /** Opens the creator & books modal — the "?" water button. */
  onCreator?: () => void;
  /** Reduced motion: the gorge stays in the background layer
   *  (settled scene, as before) and the footer keeps the water
   *  buttons; nothing is pinned in the foreground. */
  reducedMotion?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fgRef = useRef<HTMLDivElement>(null);
  const gorgeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const fg = fgRef.current;
    const q = (sel: string) =>
      (root.querySelector(sel) ?? fg?.querySelector(sel) ?? null) as HTMLElement | null;
    const gorgeEl = gorgeRef.current;
    const btnsEl = q(".scene-water-row");
    const rainbowEl = q(".scene-rainbow");
    const reflectionEl = q(".scene-reflection");
    const galaxyEl = q(".scene-galaxy");
    const skyEl = q(".scene-sky");
    const groundEl = q(".scene-ground");
    const backEl = q(".grass-back");
    const frontEl = q(".grass-front");
    const mtnL = q(".mtn-left");
    const mtnR = q(".mtn-right");
    const sunEl = q(".scene-sun");
    const puebloEl = q(".scene-pueblo");
    const teepeesEl = q(".scene-teepees");
    const riverEl = q(".scene-river");
    const flowEl = q(".river-flow");
    const bridgeEl = q(".scene-bridge");
    const treeEls = Array.from(root.querySelectorAll(".scene-tree")) as HTMLElement[];
    const plantEls = Array.from(root.querySelectorAll(".rim-plants")) as HTMLElement[];
    if (!galaxyEl || !skyEl || !groundEl || !backEl || !frontEl || !mtnL || !mtnR || !sunEl || !riverEl || !flowEl || !bridgeEl || !puebloEl || !teepeesEl) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // The pinned phase (Adam, 2026-11-05): once the scroll reaches
    // the bottom, the gorge — mountains, sun, river and the water
    // buttons — stays FIXED in the foreground while the last
    // content scrolls behind the sun and mountains. It holds on
    // the way back up, too, until the scroll returns to the
    // galaxy band, where the whole gorge slides down out of the
    // scene together and the latch resets.
    let latched = false;

    const update = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      const g = reduced ? 0 : 1 - smooth(0.03, 0.2, p);
      const sky = reduced ? 1 : smooth(0.05, 0.22, p);
      if (!reduced) {
        if (!latched && p >= 0.9) latched = true;
        else if (latched && p <= 0.04) latched = false;
      }
      const grow = reduced || latched ? 1 : smooth(0.68, 0.97, p);
      // Adam, 2026-11-05: mountains slide in from the left and right,
      // then the sun rises between them. On the latched way back
      // up, they slide back out to the sides as the rainbow rises
      // (Adam, 2026-11-05).
      const rainbowT = latched ? 1 - smooth(0.38, 0.55, p) : 0;
      const sunsetT = latched ? 1 - smooth(0.55, 0.88, p) : 0;
      const exitE = latched && p < 0.3 ? 1 - smooth(0.05, 0.3, p) : 0;
      // The counter-zooms run ahead of the slide (Adam, 2026-11-05):
      // the rainbow shrinks away and the villages grow toward the
      // viewer DURING the visible part of the exit, finishing
      // while everything is still on screen — not after the gorge
      // has already sunk out of sight.
      // Strengthened (Adam, 2026-11-05, third pass): the zooms
      // complete inside the first fifth of the slide, while the
      // villages are still on screen, and the villages more than
      // double — "come closer" has to read at a glance.
      const zoomE = Math.min(1, exitE * 5);
      const mtn = reduced ? 1 : latched ? 1 - rainbowT : smooth(0.45, 0.72, p);
      const sun = reduced || latched ? 1 : smooth(0.74, 0.97, p);
      galaxyEl.style.opacity = String(g);
      galaxyEl.style.visibility = g < 0.02 ? "hidden" : "visible";
      skyEl.style.opacity = String(sky);
      groundEl.style.opacity = String(grow);
      const slideVw = ((1 - mtn) * 53.6).toFixed(1);
      backEl.style.transform = `translateX(${-Number(slideVw)}vw) scaleY(${Math.pow(grow, 1.35).toFixed(3)})`;
      frontEl.style.transform = `translateX(${slideVw}vw) scaleY(${grow.toFixed(3)})`;
      mtnL.style.transform = `translateX(${(-(1 - mtn) * 103).toFixed(1)}%)`;
      mtnR.style.transform = `translateX(${((1 - mtn) * 103).toFixed(1)}%)`;
      sunEl.style.bottom = `${(-95 + sun * 250).toFixed(1)}px`;
      sunEl.style.opacity = String(Math.min(1, sun * 1.7));
      // The return journey (Adam, 2026-11-05): while the gorge is
      // latched and the scroll comes back up, the sun goes down
      // and turns sunset colours; once it has set, a rainbow arcs
      // from the Adobe pueblo to the teepees. Both ride the gorge
      // wrapper, so they slide out with everything else at the
      // galaxy band.
      if (rainbowEl) {
        rainbowEl.style.opacity = String(rainbowT);
        // As the gorge slides back down into the galaxy band, the
        // rainbow zooms out — shrinks away as it sinks (Adam,
        // 2026-11-05).
        rainbowEl.style.transform = zoomE > 0 ? `scale(${(1 - zoomE * 0.55).toFixed(3)})` : "";
      }
      // The sunset reflects in the river as it sets (Adam,
      // 2026-11-05): the glow on the water tracks the sun down.
      if (reflectionEl) {
        reflectionEl.style.opacity = String(sunsetT * 0.95);
      }
      if (latched) {
        const t = sunsetT;
        const mix = (a: number[], b: number[]) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
        const core = mix([255, 237, 176], [255, 140, 66]);
        const mid = mix([255, 209, 102], [250, 80, 50]);
        const glow = mix([255, 190, 84], [250, 80, 50]);
        sunEl.style.background = `radial-gradient(circle, rgb(${core.join(",")}) 0%, rgb(${mid.join(",")}) 42%, rgba(${glow.join(",")},0.5) 62%, rgba(${glow.join(",")},0) 72%)`;
        sunEl.style.bottom = `${(155 - t * 195).toFixed(1)}px`;
        sunEl.style.opacity = String(1 - t * 0.2);
        // ...and it zooms — grows large as it sinks, the way a
        // setting sun swells at the horizon (Adam, 2026-11-05).
        sunEl.style.transform = `scale(${(1 + t * 0.85).toFixed(3)})`;
      } else if (sunEl.style.background) {
        sunEl.style.background = "";
        sunEl.style.transform = "";
      }
      // The Pueblo slides in from the left bank and the teepees
      // from the right as the mountains arrive (Adam, 2026-11-05).
      const banks = reduced || latched ? 1 : smooth(0.5, 0.78, p);
      const villageZoom = (1 + zoomE * 1.1).toFixed(3);
      puebloEl.style.transformOrigin = "50% 100%";
      puebloEl.style.transform = `translateX(${(-(1 - banks) * 62).toFixed(1)}%) scale(${villageZoom})`;
      puebloEl.style.opacity = String(banks);
      teepeesEl.style.transformOrigin = "50% 100%";
      teepeesEl.style.transform = `translateX(${((1 - banks) * 62).toFixed(1)}%) scale(${villageZoom})`;
      teepeesEl.style.opacity = String(banks);
      // The Rio Grande arrives with the ground phase; its current
      // only starts moving at the very end of the scroll — "and
      // then the water flows" (Adam, 2026-11-05).
      const river = reduced || latched ? 1 : smooth(0.6, 0.85, p);
      riverEl.style.opacity = String(river);
      flowEl.style.opacity = reduced ? "0" : latched ? "1" : String(smooth(0.88, 1, p));
      if (btnsEl) btnsEl.style.opacity = String(river);
      // The exit: latched, back up in the galaxy band — the whole
      // gorge slides down out of the scene together.
      if (gorgeEl) {
        if (latched && p < 0.3) {
          const e = 1 - smooth(0.05, 0.3, p);
          gorgeEl.style.transform = `translateY(${(e * 108).toFixed(1)}%)`;
        } else {
          gorgeEl.style.transform = "";
        }
      }
      // The bridge lands across the gorge once the cliffs are in.
      const bridgeIn = reduced || latched ? 1 : smooth(0.58, 0.84, p);
      bridgeEl.style.opacity = String(bridgeIn * (1 - rainbowT));
      bridgeEl.style.transform = `translateX(-50%) translateY(${((1 - bridgeIn) * 10).toFixed(1)}px)`;
      plantEls.forEach((el) => {
        const dir = el.classList.contains("rim-plants-l") ? -1 : 1;
        el.style.transform = `translateX(${(dir * Number(slideVw)).toFixed(1)}vw) scaleY(${grow.toFixed(3)})`;
      });
      treeEls.forEach((t, i) => {
        const lag = TREES[i]?.lag ?? 0;
        const s = reduced ? 1 : Math.min(1, Math.max(0, (grow - lag) / (1 - lag || 1)));
        t.style.transform = `scale(${s.toFixed(3)})`;
      });
    };
    update();
    if (reduced) return;
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          update();
          ticking = false;
        });
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
    // Re-run when the reduced-motion layout flips: the gorge
    // elements move between the background and foreground layers,
    // and the settled styles must land on the live nodes.
  }, [reducedMotion]);

  // The gorge group — sun, cliffs, banks, river, bridge, grass —
  // plus, in the foreground layer, the water buttons pinned over
  // the river (Adam, 2026-11-05). In reduced motion the group
  // renders inside the background scene instead, exactly as
  // before, and the footer keeps the buttons.
  const gorge = (
    <>
      <div className="scene-sun" />
      <div
        className="scene-rainbow"
        aria-hidden="true"
        style={{ position: "absolute", left: "3%", right: "3%", bottom: 84, height: "min(44vw, 360px)", opacity: 0, transformOrigin: "50% 100%" }}
      >
        <svg viewBox="0 0 600 320" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: "100%" }}>
          {[
            ["#e53935", 292],
            ["#fb8c00", 284],
            ["#fdd835", 276],
            ["#43a047", 268],
            ["#1e88e5", 260],
            ["#8e24aa", 252],
          ].map(([c, r]) => (
            <path
              key={c as string}
              d={`M ${(300 - (r as number)).toFixed(0)} 320 A ${r} ${r} 0 0 1 ${(300 + (r as number)).toFixed(0)} 320`}
              fill="none"
              stroke={c as string}
              strokeWidth="7"
              opacity="0.75"
            />
          ))}
        </svg>
      </div>
      <div className="scene-mtn mtn-left">
        <svg viewBox="0 0 520 200" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 200 L0 18 C120 12, 260 14, 398 20 L424 58 L412 94 L440 138 L462 200 Z" fill="#86644a" />
          <path d="M0 84 C160 76, 300 80, 428 110 L440 138 C300 108, 140 104, 0 110 Z" fill="#75563c" opacity="0.55" />
          <path d="M0 142 C150 134, 320 140, 448 170 L462 200 L0 200 Z" fill="#65492f" opacity="0.5" />
          <path d="M398 20 L424 58 L412 94 L394 58 Z" fill="#997552" opacity="0.85" />
          <path d="M0 18 C120 12, 260 14, 398 20" fill="none" stroke="#a87f56" strokeWidth="3" />
          <path d="M60 200 L120 96 L196 200 Z" fill="#6d5138" opacity="0.35" />
          <path d="M250 60 L330 130 L268 200 L196 118 Z" fill="#997552" opacity="0.28" />
          <path d="M398 20 L424 58 L400 96 L372 52 Z" fill="#5d4430" opacity="0.4" />
          <path d="M0 52 C140 44, 300 48, 406 66" fill="none" stroke="#5d4430" strokeWidth="2" opacity="0.35" />
          <path d="M0 118 C150 110, 310 116, 434 148" fill="none" stroke="#a87f56" strokeWidth="2" opacity="0.45" />
          <path d="M0 168 C160 160, 330 168, 452 188" fill="none" stroke="#4e3826" strokeWidth="2" opacity="0.3" />
          <path d="M150 30 l10 22 l-6 18 l12 20" fill="none" stroke="rgba(40,26,16,0.45)" strokeWidth="2" />
          <path d="M330 96 l8 18 l-5 16" fill="none" stroke="rgba(40,26,16,0.4)" strokeWidth="2" />
          <path d="M96 200 l16 -12 l16 12 Z" fill="#75563c" opacity="0.8" />
          <path d="M236 200 l13 -9 l13 9 Z" fill="#75563c" opacity="0.8" />
          <path d="M356 200 l18 -13 l18 13 Z" fill="#65492f" opacity="0.8" />
          <ellipse cx="70" cy="194" rx="16" ry="7" fill="#7d5f45" />
          <ellipse cx="300" cy="196" rx="12" ry="5" fill="#997552" opacity="0.7" />
          <path d="M0 34 C130 27, 290 30, 402 44" fill="none" stroke="#a87f56" strokeWidth="1.6" opacity="0.5" />
          <path d="M0 66 C150 58, 310 64, 420 88" fill="none" stroke="#4e3826" strokeWidth="1.6" opacity="0.3" />
          <path d="M0 100 C160 92, 320 100, 436 128" fill="none" stroke="#997552" strokeWidth="1.6" opacity="0.4" />
          <path d="M0 156 C150 148, 320 156, 446 180" fill="none" stroke="#997552" strokeWidth="1.6" opacity="0.35" />
          <path d="M40 120 L96 60 L150 118 L110 178 L52 176 Z" fill="#5d4430" opacity="0.22" />
          <path d="M210 26 L268 84 L232 150 L176 84 Z" fill="#a87f56" opacity="0.2" />
          <path d="M330 150 L386 104 L424 150 L392 200 L342 200 Z" fill="#4e3826" opacity="0.25" />
          <path d="M96 150 L150 108 L196 152 L160 200 L104 200 Z" fill="#997552" opacity="0.18" />
          <path d="M238 34 l7 16 l-5 14 l9 16" fill="none" stroke="rgba(40,26,16,0.4)" strokeWidth="1.8" />
          <path d="M64 84 l6 14 l-4 12" fill="none" stroke="rgba(40,26,16,0.35)" strokeWidth="1.8" />
          <path d="M392 130 l7 15 l-4 13 l8 14" fill="none" stroke="rgba(40,26,16,0.38)" strokeWidth="1.8" />
          <path d="M286 168 l6 12 l-4 10" fill="none" stroke="rgba(40,26,16,0.32)" strokeWidth="1.8" />
          <path d="M118 96 h34 M204 132 h28 M318 74 h30 M150 176 h26" stroke="rgba(46,30,18,0.35)" strokeWidth="2.4" />
          <g fill="#5d4430" opacity="0.4">
            <circle cx="88" cy="70" r="2.2" /><circle cx="176" cy="46" r="1.8" /><circle cx="262" cy="96" r="2.4" />
            <circle cx="348" cy="58" r="1.8" /><circle cx="128" cy="140" r="2" /><circle cx="226" cy="168" r="2.2" />
            <circle cx="306" cy="140" r="1.7" /><circle cx="52" cy="150" r="1.8" /><circle cx="404" cy="168" r="2" />
          </g>
          <g fill="#b08a5e" opacity="0.45">
            <circle cx="140" cy="58" r="1.7" /><circle cx="292" cy="40" r="1.6" /><circle cx="196" cy="112" r="1.8" />
            <circle cx="368" cy="112" r="1.6" /><circle cx="84" cy="112" r="1.5" /><circle cx="252" cy="186" r="1.7" />
          </g>
          <path d="M168 200 l12 -8 l12 8 Z" fill="#86644a" opacity="0.85" />
          <path d="M404 200 l14 -10 l14 10 Z" fill="#75563c" opacity="0.85" />
          <ellipse cx="196" cy="197" rx="9" ry="4" fill="#65492f" />
          <ellipse cx="428" cy="195" rx="11" ry="5" fill="#86644a" opacity="0.8" />
        </svg>
      </div>
      <div className="scene-mtn mtn-right">
        <svg viewBox="0 0 520 200" preserveAspectRatio="none" aria-hidden="true">
          <path d="M520 200 L520 18 C400 12, 260 14, 122 20 L96 58 L108 94 L80 138 L58 200 Z" fill="#7d5f45" />
          <path d="M520 84 C360 76, 220 80, 92 110 L80 138 C220 108, 380 104, 520 110 Z" fill="#6d5138" opacity="0.55" />
          <path d="M520 142 C370 134, 200 140, 72 170 L58 200 L520 200 Z" fill="#5d4430" opacity="0.5" />
          <path d="M122 20 L96 58 L108 94 L126 58 Z" fill="#997552" opacity="0.85" />
          <path d="M520 18 C400 12, 260 14, 122 20" fill="none" stroke="#a87f56" strokeWidth="3" />
          <path d="M460 200 L400 96 L324 200 Z" fill="#63482f" opacity="0.35" />
          <path d="M270 60 L190 130 L252 200 L324 118 Z" fill="#997552" opacity="0.28" />
          <path d="M122 20 L96 58 L120 96 L148 52 Z" fill="#523a24" opacity="0.4" />
          <path d="M520 52 C380 44, 220 48, 114 66" fill="none" stroke="#523a24" strokeWidth="2" opacity="0.35" />
          <path d="M520 118 C370 110, 210 116, 86 148" fill="none" stroke="#a87f56" strokeWidth="2" opacity="0.45" />
          <path d="M520 168 C360 160, 190 168, 68 188" fill="none" stroke="#453122" strokeWidth="2" opacity="0.3" />
          <path d="M370 30 l-10 22 l6 18 l-12 20" fill="none" stroke="rgba(40,26,16,0.45)" strokeWidth="2" />
          <path d="M190 96 l-8 18 l5 16" fill="none" stroke="rgba(40,26,16,0.4)" strokeWidth="2" />
          <path d="M424 200 l-16 -12 l-16 12 Z" fill="#6d5138" opacity="0.8" />
          <path d="M284 200 l-13 -9 l-13 9 Z" fill="#6d5138" opacity="0.8" />
          <path d="M164 200 l-18 -13 l-18 13 Z" fill="#5d4430" opacity="0.8" />
          <ellipse cx="450" cy="194" rx="16" ry="7" fill="#75563c" />
          <ellipse cx="220" cy="196" rx="12" ry="5" fill="#997552" opacity="0.7" />
          <path d="M520 34 C390 27, 230 30, 118 44" fill="none" stroke="#a87f56" strokeWidth="1.6" opacity="0.5" />
          <path d="M520 66 C370 58, 210 64, 100 88" fill="none" stroke="#453122" strokeWidth="1.6" opacity="0.3" />
          <path d="M520 100 C360 92, 200 100, 84 128" fill="none" stroke="#997552" strokeWidth="1.6" opacity="0.4" />
          <path d="M520 156 C370 148, 200 156, 74 180" fill="none" stroke="#997552" strokeWidth="1.6" opacity="0.35" />
          <path d="M480 120 L424 60 L370 118 L410 178 L468 176 Z" fill="#523a24" opacity="0.22" />
          <path d="M310 26 L252 84 L288 150 L344 84 Z" fill="#a87f56" opacity="0.2" />
          <path d="M190 150 L134 104 L96 150 L128 200 L178 200 Z" fill="#453122" opacity="0.25" />
          <path d="M424 150 L370 108 L324 152 L360 200 L416 200 Z" fill="#997552" opacity="0.18" />
          <path d="M282 34 l-7 16 l5 14 l-9 16" fill="none" stroke="rgba(40,26,16,0.4)" strokeWidth="1.8" />
          <path d="M456 84 l-6 14 l4 12" fill="none" stroke="rgba(40,26,16,0.35)" strokeWidth="1.8" />
          <path d="M128 130 l-7 15 l4 13 l-8 14" fill="none" stroke="rgba(40,26,16,0.38)" strokeWidth="1.8" />
          <path d="M234 168 l-6 12 l4 10" fill="none" stroke="rgba(40,26,16,0.32)" strokeWidth="1.8" />
          <path d="M402 96 h-34 M316 132 h-28 M202 74 h-30 M370 176 h-26" stroke="rgba(46,30,18,0.35)" strokeWidth="2.4" />
          <g fill="#523a24" opacity="0.4">
            <circle cx="432" cy="70" r="2.2" /><circle cx="344" cy="46" r="1.8" /><circle cx="258" cy="96" r="2.4" />
            <circle cx="172" cy="58" r="1.8" /><circle cx="392" cy="140" r="2" /><circle cx="294" cy="168" r="2.2" />
            <circle cx="214" cy="140" r="1.7" /><circle cx="468" cy="150" r="1.8" /><circle cx="116" cy="168" r="2" />
          </g>
          <g fill="#b08a5e" opacity="0.45">
            <circle cx="380" cy="58" r="1.7" /><circle cx="228" cy="40" r="1.6" /><circle cx="324" cy="112" r="1.8" />
            <circle cx="152" cy="112" r="1.6" /><circle cx="436" cy="112" r="1.5" /><circle cx="268" cy="186" r="1.7" />
          </g>
          <path d="M352 200 l-12 -8 l-12 8 Z" fill="#7d5f45" opacity="0.85" />
          <path d="M116 200 l-14 -10 l-14 10 Z" fill="#6d5138" opacity="0.85" />
          <ellipse cx="324" cy="197" rx="9" ry="4" fill="#5d4430" />
          <ellipse cx="92" cy="195" rx="11" ry="5" fill="#7d5f45" opacity="0.8" />
        </svg>
      </div>
      <div className="scene-pueblo">
        <svg viewBox="0 0 300 190" aria-hidden="true">
          <rect x="98" y="34" width="106" height="156" fill="#c39a5f" />
          <rect x="40" y="76" width="86" height="114" fill="#cda671" />
          <rect x="180" y="106" width="94" height="84" fill="#d4af77" />
          <rect x="6" y="120" width="62" height="70" fill="#c9a26b" />
          <rect x="98" y="30" width="106" height="6" fill="#a87f4c" />
          <rect x="40" y="72" width="86" height="6" fill="#a87f4c" />
          <rect x="180" y="102" width="94" height="6" fill="#a87f4c" />
          <rect x="6" y="116" width="62" height="6" fill="#a87f4c" />
          <g fill="#6e4f2e">
            <circle cx="108" cy="44" r="3" /><circle cx="124" cy="44" r="3" /><circle cx="140" cy="44" r="3" /><circle cx="156" cy="44" r="3" /><circle cx="172" cy="44" r="3" /><circle cx="188" cy="44" r="3" />
            <circle cx="50" cy="86" r="3" /><circle cx="66" cy="86" r="3" /><circle cx="82" cy="86" r="3" /><circle cx="98" cy="86" r="3" /><circle cx="114" cy="86" r="3" />
            <circle cx="190" cy="116" r="3" /><circle cx="206" cy="116" r="3" /><circle cx="222" cy="116" r="3" /><circle cx="238" cy="116" r="3" /><circle cx="254" cy="116" r="3" />
            <circle cx="16" cy="130" r="3" /><circle cx="32" cy="130" r="3" /><circle cx="48" cy="130" r="3" />
          </g>
          <g fill="#4a3826">
            <rect x="140" y="58" width="13" height="17" rx="2" />
            <rect x="168" y="58" width="13" height="17" rx="2" />
            <rect x="66" y="98" width="12" height="16" rx="2" />
            <rect x="94" y="98" width="12" height="16" rx="2" />
            <rect x="216" y="126" width="12" height="15" rx="2" />
            <rect x="26" y="140" width="11" height="14" rx="2" />
          </g>
          <path d="M146 190 L146 156 A10 10 0 0 1 166 156 L166 190 Z" fill="#3c2c1c" />
          <g stroke="#8a6134" strokeWidth="4" strokeLinecap="round">
            <line x1="196" y1="190" x2="216" y2="104" />
            <line x1="210" y1="190" x2="230" y2="104" />
          </g>
          <g stroke="#8a6134" strokeWidth="3">
            <line x1="201" y1="168" x2="215" y2="168" />
            <line x1="205" y1="146" x2="219" y2="146" />
            <line x1="209" y1="124" x2="223" y2="124" />
          </g>
        </svg>
      </div>
      <div className="scene-teepees">
        <svg viewBox="0 0 280 190" aria-hidden="true">
          <g stroke="#6e5136" strokeWidth="3" strokeLinecap="round">
            <line x1="140" y1="26" x2="126" y2="0" />
            <line x1="140" y1="26" x2="140" y2="-4" />
            <line x1="140" y1="26" x2="154" y2="0" />
          </g>
          <path d="M140 22 L198 190 L82 190 Z" fill="#f2e9d5" />
          <path d="M140 22 L198 190 L140 190 Z" fill="#e2d1a9" />
          <path d="M140 148 L156 190 L124 190 Z" fill="#5a4632" />
          <path d="M103 156 L177 156" stroke="#a34a2e" strokeWidth="5" />
          <g stroke="#6e5136" strokeWidth="2.4" strokeLinecap="round">
            <line x1="52" y1="76" x2="42" y2="56" />
            <line x1="52" y1="76" x2="52" y2="52" />
            <line x1="52" y1="76" x2="62" y2="56" />
          </g>
          <path d="M52 72 L92 190 L12 190 Z" fill="#eee1c6" />
          <path d="M52 72 L92 190 L52 190 Z" fill="#d9c69c" />
          <path d="M52 158 L61 190 L43 190 Z" fill="#5a4632" />
          <g stroke="#6e5136" strokeWidth="2.4" strokeLinecap="round">
            <line x1="232" y1="66" x2="222" y2="46" />
            <line x1="232" y1="66" x2="232" y2="42" />
            <line x1="232" y1="66" x2="242" y2="46" />
          </g>
          <path d="M232 62 L268 190 L196 190 Z" fill="#f2e9d5" />
          <path d="M232 62 L268 190 L232 190 Z" fill="#e2d1a9" />
          <path d="M232 156 L240 190 L224 190 Z" fill="#5a4632" />
        </svg>
      </div>
      {TREES.map((t, i) => (
        <div
          key={i}
          className="scene-tree"
          style={{ left: t.left, height: `${Math.round(120 * t.size)}px` }}
        >
          <svg viewBox="0 0 100 150" aria-hidden="true">
            <path d="M46 150 C 47 118, 48 96, 46 74 L 54 74 C 52 96, 53 118, 54 150 Z" fill="#5d422a" />
            <circle cx="50" cy="46" r="30" fill={t.gold ? "#d9a441" : "#2e7d46"} />
            <circle cx="28" cy="60" r="20" fill={t.gold ? "#c79335" : "#359551"} />
            <circle cx="72" cy="60" r="21" fill={t.gold ? "#e2b354" : "#3fa055"} />
            <circle cx="50" cy="66" r="22" fill={t.gold ? "#d9a441" : "#2a6e3e"} />
          </svg>
        </div>
      ))}
      <div className="scene-river">
        <div className="river-flow" />
      </div>
      <div
        className="scene-reflection"
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "20%",
          right: "20%",
          bottom: 0,
          height: 118,
          background:
            "radial-gradient(ellipse 100% 115% at 50% 0%, rgba(255,176,92,0.95) 0%, rgba(255,120,60,0.55) 45%, rgba(250,80,50,0.22) 72%, rgba(250,80,50,0) 100%)",
          filter: "blur(4px)",
          opacity: 0,
        }}
      />
      <div className="scene-bridge">
        <svg viewBox="0 0 600 150" preserveAspectRatio="none" aria-hidden="true">
          <path d="M18 108 C 160 44, 440 44, 582 108" fill="none" stroke="#8b979c" strokeWidth="9" />
          <path d="M18 121 C 160 58, 440 58, 582 121" fill="none" stroke="#6f7d82" strokeWidth="7" />
          <path d="M70 92 L70 30 M140 66 L140 30 M215 50 L215 30 M300 44 L300 30 M385 50 L385 30 M460 66 L460 30 M530 92 L530 30" stroke="#8b979c" strokeWidth="6" />
          <rect x="4" y="24" width="592" height="7" fill="#a7b1b5" />
          <rect x="4" y="12" width="592" height="3.5" fill="#a7b1b5" />
          <path d="M24 24 L24 13 M84 24 L84 13 M144 24 L144 13 M204 24 L204 13 M264 24 L264 13 M324 24 L324 13 M384 24 L384 13 M444 24 L444 13 M504 24 L504 13 M564 24 L564 13" stroke="#a7b1b5" strokeWidth="3.5" />
        </svg>
      </div>
      <div className="scene-ground" />
      <svg className="scene-grass grass-back" viewBox="0 0 1000 170" preserveAspectRatio="none">
        {GRASS_BACK.map((b, i) => (
          <path
            key={i}
            d={b.d}
            stroke={b.c}
            strokeWidth={b.w}
            fill="none"
            strokeLinecap="round"
            style={{ animationDuration: `${(3.6 + (i % 7) * 0.43).toFixed(2)}s`, animationDelay: `${(-((i * 0.61) % 3.6)).toFixed(2)}s` }}
          />
        ))}
      </svg>
      <svg className="scene-grass grass-front" viewBox="0 0 1000 170" preserveAspectRatio="none">
        {GRASS_FRONT.map((b, i) => (
          <path
            key={i}
            d={b.d}
            stroke={b.c}
            strokeWidth={b.w}
            fill="none"
            strokeLinecap="round"
            style={{ animationDuration: `${(2.9 + (i % 7) * 0.37).toFixed(2)}s`, animationDelay: `${(-((i * 0.53) % 2.9)).toFixed(2)}s` }}
          />
        ))}
      </svg>
      <div className="rim-plants rim-plants-l">
        <svg viewBox="0 0 500 56" preserveAspectRatio="none" aria-hidden="true">
          <g fill="#3e7d4e">
            <ellipse cx="60" cy="42" rx="14" ry="9" transform="rotate(-18 60 42)" />
            <ellipse cx="78" cy="33" rx="11" ry="8" transform="rotate(24 78 33)" />
            <ellipse cx="47" cy="31" rx="10" ry="7" transform="rotate(-42 47 31)" />
          </g>
          <g stroke="#4a7d3a" strokeWidth="3.5" strokeLinecap="round">
            <line x1="250" y1="55" x2="237" y2="27" />
            <line x1="250" y1="55" x2="250" y2="20" />
            <line x1="250" y1="55" x2="263" y2="27" />
            <line x1="250" y1="55" x2="231" y2="38" />
            <line x1="250" y1="55" x2="269" y2="38" />
          </g>
          <g stroke="#7a9a52" strokeWidth="7" strokeLinecap="round">
            <line x1="410" y1="55" x2="410" y2="27" />
            <line x1="410" y1="39" x2="397" y2="30" />
            <line x1="410" y1="35" x2="422" y2="25" />
          </g>
        </svg>
      </div>
      <div className="rim-plants rim-plants-r">
        <svg viewBox="0 0 500 56" preserveAspectRatio="none" aria-hidden="true">
          <path d="M88 55 L88 40" stroke="#5d422a" strokeWidth="5" />
          <circle cx="88" cy="30" r="17" fill="#2a5c33" />
          <circle cx="70" cy="38" r="12" fill="#2e7d46" />
          <circle cx="106" cy="38" r="12" fill="#256b3a" />
          <g fill="#3e7d4e">
            <ellipse cx="300" cy="42" rx="14" ry="9" transform="rotate(16 300 42)" />
            <ellipse cx="318" cy="33" rx="11" ry="8" transform="rotate(-22 318 33)" />
            <ellipse cx="287" cy="31" rx="10" ry="7" transform="rotate(40 287 31)" />
          </g>
          <g stroke="#4a7d3a" strokeWidth="3.5" strokeLinecap="round">
            <line x1="445" y1="55" x2="433" y2="29" />
            <line x1="445" y1="55" x2="445" y2="22" />
            <line x1="445" y1="55" x2="457" y2="29" />
            <line x1="445" y1="55" x2="427" y2="40" />
            <line x1="445" y1="55" x2="463" y2="40" />
          </g>
        </svg>
      </div>
      <TaosWalker onOpen={onCreator} />
      {!reducedMotion && onCreator && (
        <div
          className="water-row scene-water-row"
          style={{ position: "absolute", left: 16, right: 16, bottom: 76, pointerEvents: "none" }}
        >
          <span style={{ pointerEvents: "auto", display: "inline-flex" }}>
            <ShareButtons
              variant="modal"
              iconOnly
              url="https://eyeknow.app/"
              title="eyeKnow — Traditional Iridology Readings"
              text="eyeKnow — a traditional iridology reading from a photo of your eye:"
              label="Share eyeKnow"
            />
          </span>
        </div>
      )}
    </>
  );

  return (
    <>
      <div className="home-scene no-print" ref={ref} aria-hidden="true">
        <div className="scene-sky">
          {CLOUDS.map((c, i) => (
            <span
              key={i}
              className="cloud"
              style={{
                top: c.top,
                left: c.left,
                width: c.w,
                animationDuration: `${c.dur}s`,
                animationDelay: `${c.delay}s`,
              }}
            >
              <span className="cloud-in" style={{ opacity: c.op }} />
            </span>
          ))}
        </div>
        <div className="scene-galaxy">
          <Galaxy variant="full" />
        </div>
        {reducedMotion && gorge}
      </div>
      {!reducedMotion && (
        <div
          className="home-scene home-scene-fg no-print"
          ref={fgRef}
          style={{ background: "transparent", zIndex: 2 }}
        >
          <div ref={gorgeRef} style={{ position: "absolute", inset: 0, willChange: "transform" }}>
            {gorge}
          </div>
        </div>
      )}
    </>
  );
}
