"use client";

// The eyeKnow logo as an inline SVG (identical art to
// public/logo.svg) whose pupil follows the user's touch via the
// shared gaze tracker. Used in the top bar and in the bottom
// bar's capture lens (Adam, 2026-11-03).
//
// The dark dot is the part that visibly travels (Adam, 2026-11-03:
// "the black dot … move to the direction of where they touch") —
// it rolls around inside the cream disc toward the touch, clamped
// so it never leaves the disc; the disc itself drifts a little
// with it for depth.

import { useEffect, useRef } from "react";
import { registerGaze } from "./gaze";
import { HERO_LOGO_STROKES, useHeroColorIndex } from "./heroColor";

// The dot's resting offset from the eye's centre, exactly as in
// logo.svg (cx 34.6, cy 29.4 against the 32,32 centre).
const DOT_HOME = { x: 2.6, y: -2.6 };
// The dot (r 1.9) stays inside the cream disc (r 5.2): its centre
// may roam at most 5.2 − 1.9 = 3.3 units from the eye's centre.
const DOT_MAX_R = 3.3;
const DOT_TRAVEL = 4.4;
const DISC_TRAVEL = 2.2;

export default function LogoEye({ className }: { className?: string }) {
  // The logo eye wears the front page's colour of this refresh, so
  // every eye matches (Adam, 2026-11-05).
  const eyeIdx = useHeroColorIndex();
  const svgRef = useRef<SVGSVGElement>(null);
  const discRef = useRef<SVGGElement>(null);
  const dotRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const disc = discRef.current;
    const dot = dotRef.current;
    if (!svg || !disc || !dot) return undefined;
    return registerGaze({
      el: svg,
      follow: 0.35,
      ret: 0.09,
      apply: (nx, ny) => {
        disc.setAttribute(
          "transform",
          `translate(${(nx * DISC_TRAVEL).toFixed(2)} ${(ny * DISC_TRAVEL).toFixed(2)})`,
        );
        let fx = DOT_HOME.x + nx * DOT_TRAVEL;
        let fy = DOT_HOME.y + ny * DOT_TRAVEL;
        const mag = Math.hypot(fx, fy);
        if (mag > DOT_MAX_R) {
          fx = (fx / mag) * DOT_MAX_R;
          fy = (fy / mag) * DOT_MAX_R;
        }
        dot.setAttribute("transform", `translate(${fx.toFixed(2)} ${fy.toFixed(2)})`);
      },
    });
  }, []);

  return (
    <svg ref={svgRef} className={className} viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M3 32 C13 13.5 23 7.5 32 7.5 C41 7.5 51 13.5 61 32 C51 50.5 41 56.5 32 56.5 C23 56.5 13 50.5 3 32 Z"
        fill="none"
        stroke="#f3ead2"
        strokeWidth="3.6"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="32" r="14.5" fill="none" stroke={HERO_LOGO_STROKES[eyeIdx]} strokeWidth="3" />
      <circle
        cx="32"
        cy="32"
        r="10.5"
        fill="none"
        stroke={HERO_LOGO_STROKES[eyeIdx]}
        strokeWidth="2.4"
        strokeDasharray="2.6 3.1"
      />
      <g ref={discRef} data-disc="1">
        <circle cx="32" cy="32" r="5.2" fill="#f3ead2" />
      </g>
      <g ref={dotRef} data-pupil="1" transform={`translate(${DOT_HOME.x} ${DOT_HOME.y})`}>
        <circle cx="32" cy="32" r="1.9" fill="#0d3b37" />
      </g>
    </svg>
  );
}
