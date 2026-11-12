"use client";

import { HERO_EYE_SRCS, useHeroColorIndex } from "./heroColor";

/** The animated overlay stages of the reading screen (rings,
 *  orbit, unroll, shimmer, sign hunt). Extracted from IrisApp to
 *  keep that file under the per-file upload cap. */
const HUNT_SPOTS: { left: string; top: string; dark: boolean }[] = [
  { left: "30%", top: "26%", dark: true },
  { left: "63%", top: "20%", dark: false },
  { left: "74%", top: "44%", dark: true },
  { left: "55%", top: "62%", dark: false },
  { left: "33%", top: "58%", dark: true },
  { left: "45%", top: "38%", dark: false },
  { left: "68%", top: "72%", dark: true },
  { left: "24%", top: "44%", dark: false },
];

function sectorPath(i: number): string {
  const a0 = ((i * 30 + 1 - 90) * Math.PI) / 180;
  const a1 = (((i + 1) * 30 - 1 - 90) * Math.PI) / 180;
  const x0 = 50 + 45 * Math.cos(a0);
  const y0 = 50 + 45 * Math.sin(a0);
  const x1 = 50 + 45 * Math.cos(a1);
  const y1 = 50 + 45 * Math.sin(a1);
  return `M50 50 L${x0.toFixed(1)} ${y0.toFixed(1)} A45 45 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`;
}

export function StageOverlay({ stage }: { stage: number }) {
  // The printed sheet's iris follows the front-page colour cycle,
  // like every other demo eye (Adam, 2026-11-05).
  const eyeIdx = useHeroColorIndex();
  return (
    <div className="stage-anim">
      {stage === 0 && (
        <>
          <div className="anim-ring a" />
          <div className="anim-ring b" />
          <div className="anim-ring c" />
          <div className="anim-center-dot" />
        </>
      )}
      {stage === 1 && (
        <div className="anim-orbit">
          <span />
        </div>
      )}
      {stage === 2 && <div className="anim-unroll" />}
      {stage === 3 && <div className="anim-shimmer" />}
      {stage === 4 && (
        <>
          <div className="anim-ripple a" />
          <div className="anim-ripple b" />
          <div className="anim-ripple c" />
        </>
      )}
      {stage === 5 && (
        <div className="anim-spots">
          {HUNT_SPOTS.map((s, i) => (
            <span
              key={i}
              className={s.dark ? "dark" : "light"}
              style={{ left: s.left, top: s.top, animationDelay: `${i * 0.14}s` }}
            />
          ))}
        </div>
      )}
      {stage === 6 && (
        <svg className="anim-spokes" viewBox="0 0 100 100">
          {Array.from({ length: 24 }, (_, i) => (
            <line key={i} x1="50" y1="50" x2="50" y2="6" transform={`rotate(${i * 15} 50 50)`} />
          ))}
        </svg>
      )}
      {stage === 7 && (
        <svg className="anim-sectors" viewBox="0 0 100 100">
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d={sectorPath(i)} style={{ animationDelay: `${i * 0.13}s` }} />
          ))}
        </svg>
      )}
      {stage === 8 && (
        <div className="anim-write">
          <i />
          <i />
          <i />
          <i />
        </div>
      )}
      {stage === 9 && (
        <div className="anim-print">
          <div className="print-sheet">
            {/* The sheet that prints is a picture of the iris itself. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={HERO_EYE_SRCS[eyeIdx]} alt="" className="print-iris" />
          </div>
          <div className="print-slot" />
        </div>
      )}
    </div>
  );
}
