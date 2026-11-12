"use client";

import { useEffect, useId } from "react";
import { SIGN_COLORS, SIGNS, type SignId } from "@/lib/chart";

/** Plain-language guide to the six signs (Adam's direction): most
 *  readers have never heard words like "lacuna" or "radii solaris",
 *  so every sign name in a report can be tapped to open this pop-up —
 *  a drawn picture of the marking plus what it looks like and what
 *  the tradition reads it as, in everyday words. The content is
 *  generic education about the sign type, never the reader's own
 *  findings, so it is safe on locked previews too. */
export const SIGN_GUIDE: Record<SignId, { plain: string; looks: string; means: string }> = {
  ring: {
    plain: "Nerve ring",
    looks:
      "One or more circular grooves running around the iris, like rings pressed into the surface — ripples on a pond, frozen into the fibers. They can circle the whole iris or just cross one area of it.",
    means:
      "The tradition reads nerve rings as tension being held in the body — the area the ring crosses is working under strain. The classic theme in the old texts is learning to relax that area: rest, ease, and letting the nervous system settle.",
  },
  lacuna: {
    plain: "Lacuna — a dark marking",
    looks:
      "A dark, leaf-shaped or oval patch where the iris fibers open up and close around a hollow. The word is Latin for a small pit or pool — like the Spanish laguna, a little lake sitting in the fibers. Practitioners give lacunae shape names from the old chart dictionaries — a leaf, a lance, a diamond, a butterfly, a medusa — after the silhouette of the hollow, and note whether it sits closed within the fibres or opened toward an edge.",
    means:
      "The tradition reads a lacuna as an area of inherited weakness — a spot that was less strongly built from birth. It is not a claim that something is wrong there; in this reading it simply marks the area the chart says needs the most support.",
  },
  radial: {
    plain: "Radial furrow — radii solaris",
    looks:
      "A dark line running straight out from the pupil toward the edge of the iris, like a spoke on a wheel or a crack in ice. The old Latin name, radii solaris, means “rays of the sun.”",
    means:
      "Unbroken radial fibers are the chart's picture of strength, so a deep furrow is read as a break in that strength along its line — in the tradition it is often linked with the bowel area the line crosses, and with material being carried outward rather than cleared.",
  },
  pigment: {
    plain: "Pigment deposit",
    looks:
      "A spot of dark brown, rust, or near-black colour sitting on the surface of the iris, with edges of its own — a freckle on the eye, clearly different from the iris's own colour around it.",
    means:
      "The tradition reads pigment deposits as material the body has stored rather than eliminated — settled deposits that built up over time. The darker and heavier the deposit, the deeper and longer-standing the tradition considers the picture.",
  },
  cloudy: {
    plain: "Cloudiness — a white marking",
    looks:
      "A pale, whitish or milky haze over part of the iris — sometimes a soft film, sometimes fine white lines or dots lying over the fibers, softening the colour beneath.",
    means:
      "White markings are the tradition's picture of overactivity: congestion, irritation, an area working too hard right now. Where dark markings are read as settled and long-standing, white ones are read as active and recent — the area asking for decongestion and rest.",
  },
  fiber: {
    plain: "Fiber separation — honeycomb",
    looks:
      "In that area the iris fibers stop running in tight, straight lines. They loosen, wave, and separate, leaving a net-like or honeycomb texture with little gaps showing through.",
    means:
      "The chart reads tight, dense, parallel fibers as a strong build in that area, and separated, honeycomb fibers as a weaker one — in the tradition, that area is seen as less resilient and slower to recover, so it is treated gently and supported steadily.",
  },
};

/** Schematic drawing of one sign on a stylised iris — a teaching
 *  diagram in the flat style of the classic charts, with the sign
 *  picked out in its marker colour. Not a photograph. */
export function SignArt({ sign }: { sign: SignId }) {
  const blurId = useId();
  const fibers = Array.from({ length: 60 }, (_, i) => i * 6);
  const pt = (r: number, deg: number): [number, number] => {
    const a = (deg * Math.PI) / 180;
    return [60 + r * Math.sin(a), 60 - r * Math.cos(a)];
  };
  const spoke = (deg: number, halfWidth: number) => {
    const [x1, y1] = pt(17, deg - halfWidth);
    const [x2, y2] = pt(53, deg - halfWidth * 0.4);
    const [x3, y3] = pt(53, deg + halfWidth * 0.4);
    const [x4, y4] = pt(17, deg + halfWidth);
    return `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`;
  };
  const c = SIGN_COLORS[sign].bg;
  return (
    <svg viewBox="0 0 120 120" className="sign-art-svg" role="img" aria-label={`Drawing of a ${SIGN_GUIDE[sign].plain.toLowerCase()} on an iris`}>
      <circle cx="60" cy="60" r="55" fill="#8a6844" />
      {fibers.map((deg) => {
        const [x1, y1] = pt(17, deg);
        const [x2, y2] = pt(53, deg);
        return (
          <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(46,30,8,0.35)" strokeWidth="1" />
        );
      })}
      <circle cx="60" cy="60" r="26" fill="none" stroke="rgba(30,19,4,0.45)" strokeWidth="1.6" />
      {sign === "ring" && (
        <>
          <circle cx="60" cy="60" r="44" fill="none" stroke={c} strokeWidth="3" />
          <circle cx="60" cy="60" r="35" fill="none" stroke={c} strokeWidth="3" />
        </>
      )}
      {sign === "lacuna" && (
        <path
          d="M 84 22 C 95 33, 95 46, 84 56 C 73 46, 73 33, 84 22 Z"
          fill="#3b1470"
          stroke="#ffffff"
          strokeWidth="1.6"
          transform="rotate(18 84 39)"
        />
      )}
      {sign === "radial" && (
        <>
          <path d={spoke(205, 3.4)} fill={c} stroke="#ffffff" strokeWidth="0.7" />
          <path d={spoke(222, 2.6)} fill={c} stroke="#ffffff" strokeWidth="0.7" />
          <path d={spoke(190, 2.2)} fill={c} stroke="#ffffff" strokeWidth="0.7" />
        </>
      )}
      {sign === "pigment" && (
        <path
          d="M 30 74 C 26 82, 31 90, 39 91 C 48 92, 53 86, 50 78 C 47 70, 34 66, 30 74 Z"
          fill="#5e2708"
          stroke="#ffffff"
          strokeWidth="1.4"
        />
      )}
      {sign === "cloudy" && (
        <g filter={`url(#${blurId})`}>
          <ellipse cx="80" cy="80" rx="17" ry="11" fill="#ffffff" opacity="0.55" transform="rotate(-30 80 80)" />
          <ellipse cx="74" cy="74" rx="11" ry="7" fill="#ffffff" opacity="0.8" transform="rotate(-30 74 74)" />
          <ellipse cx="86" cy="86" rx="8" ry="5" fill="#ffffff" opacity="0.7" transform="rotate(-30 86 86)" />
        </g>
      )}
      {sign === "fiber" && (
        <g fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round">
          <path d="M 74 20 C 78 30, 72 38, 77 48" />
          <path d="M 84 24 C 89 33, 82 42, 88 51" />
          <path d="M 93 31 C 98 39, 92 46, 97 54" />
          <path d="M 68 27 C 71 35, 66 42, 70 50" />
        </g>
      )}
      <circle cx="60" cy="60" r="15" fill="#14100a" />
      <circle cx="55" cy="54" r="3.4" fill="rgba(255,255,255,0.85)" />
      <circle cx="60" cy="60" r="55" fill="none" stroke="#5d4526" strokeWidth="2.5" />
      <defs>
        <filter id={blurId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>
    </svg>
  );
}

export default function SignGuideModal({
  sign,
  onClose,
}: {
  sign: SignId;
  onClose: () => void;
}) {
  const g = SIGN_GUIDE[sign];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop sign-guide-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`What is a ${g.plain}?`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card sign-guide-card">
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <p className="report-brand">Sign guide</p>
        <h2 className="modal-title">
          <span className="sign-dot" style={{ background: SIGN_COLORS[sign].bg }} aria-hidden="true" />
          {SIGNS[sign].label}
        </h2>
        <div className="sign-art">
          <SignArt sign={sign} />
          <p className="sign-art-caption">
            A drawing of a {g.plain.toLowerCase()} — the marking picked out in its colour.
          </p>
        </div>
        <h3 className="sign-guide-h">What you&apos;re looking at</h3>
        <p>{g.looks}</p>
        <h3 className="sign-guide-h">What the tradition reads</h3>
        <p>{g.means}</p>
        <p className="muted sign-guide-foot">
          This is the traditional iridology reading of the marking, in plain words —
          presented as tradition, not as a medical fact.
        </p>
      </div>
    </div>
  );
}
