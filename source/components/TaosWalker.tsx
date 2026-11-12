"use client";

import { useEffect, useRef, useState } from "react";

// Kyle, modeled on his woodcut author portrait (Adam, 2026-11-06):
// dark side-swept hair, mustache and goatee, dark jacket over a
// plaid shirt. He lives on the right cliff's grass rim in the
// home scene. Scroll to the very bottom of the page and he walks
// in from the right, waves, and holds up a cardboard sign —
// "Made with ❤️ from Taos, NM". Scroll back up and he lowers
// the sign and walks out the way he came. Rendered inside the
// scene's gorge group, so he rides its entrances and exits.
// Reduced motion: he is simply there at the bottom, sign up.

type Phase = "waiting" | "walking" | "waving" | "sign" | "leaving";

export default function TaosWalker({ onOpen }: { onOpen?: () => void }) {
  const [phase, setPhase] = useState<Phase>("waiting");
  const [out, setOut] = useState(false);
  const phaseRef = useRef<Phase>("waiting");
  phaseRef.current = phase;

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));

    const enter = () => {
      if (reduced) {
        setPhase("sign");
        return;
      }
      setOut(false);
      setPhase("walking");
      later(() => phaseRef.current === "walking" && setPhase("waving"), 3900);
      later(() => phaseRef.current === "waving" && setPhase("sign"), 5700);
    };
    const leave = () => {
      if (reduced) {
        setPhase("waiting");
        return;
      }
      setPhase("leaving");
      later(() => setOut(true), 550);
      later(() => {
        setPhase("waiting");
        setOut(false);
        // Already back at the bottom? Walk in again without
        // waiting for another scroll nudge.
        later(() => {
          const doc = document.documentElement;
          if (
            doc.scrollHeight - (window.scrollY + window.innerHeight) <= 80 &&
            phaseRef.current === "waiting"
          )
            enter();
        }, 60);
      }, 3550);
    };
    const onScroll = () => {
      const doc = document.documentElement;
      const fromBottom = doc.scrollHeight - (window.scrollY + window.innerHeight);
      const p = phaseRef.current;
      if (fromBottom <= 80 && p === "waiting") enter();
      else if (fromBottom > 300 && (p === "walking" || p === "waving" || p === "sign")) leave();
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const walking = phase === "walking" || (phase === "leaving" && out);
  const waving = phase === "waving";
  const signUp = phase === "sign";
  const gone = phase === "waiting" || out;

  return (
    <div
      role={onOpen ? "button" : "img"}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
      aria-label="About the creator and his books — Kyle, on the cliff grass, holds a cardboard sign: Made with ❤️ from Taos, NM"
      style={{
        position: "absolute",
        bottom: "calc(var(--cliffH) * 0.9 - 12px)",
        right: gone ? -110 : "23%",
        transition:
          phase === "walking"
            ? "right 3.9s cubic-bezier(.3,.65,.35,1)"
            : phase === "leaving" && out
              ? "right 2.9s cubic-bezier(.45,.6,.6,1)"
              : undefined,
        width: 170,
        height: 150,
        marginRight: -85,
        pointerEvents: onOpen ? "auto" : "none",
        cursor: onOpen ? "pointer" : undefined,
      }}
    >
      <style>{`
        @keyframes twStep { 0% { transform: rotate(13deg) translateY(0); } 25% { transform: rotate(0deg) translateY(-1.7px); } 50% { transform: rotate(-13deg) translateY(0); } 75% { transform: rotate(0deg) translateY(-1.7px); } 100% { transform: rotate(13deg) translateY(0); } }
        @keyframes twBob { 0%, 50%, 100% { transform: translateY(0.7px); } 25%, 75% { transform: translateY(-1.3px); } }
        @keyframes twSwayWalk { 0%, 100% { transform: rotate(1.1deg); } 50% { transform: rotate(-1.1deg); } }
        @keyframes twWave { 0%, 100% { transform: rotate(-15deg); } 50% { transform: rotate(15deg); } }
        @keyframes twSway { 0%, 100% { transform: translate(-10px, -56px) rotate(-3.4deg); } 50% { transform: translate(-10px, -56px) rotate(-0.6deg); } }
        .tw-leg { transform-box: fill-box; transform-origin: 50% 5%; }
        .tw-arm-r { transform-box: fill-box; transform-origin: 18% 10%; transition: transform 0.45s ease; }
        .tw-wave { transform-box: fill-box; transform-origin: 18% 10%; }
        .tw-arm-l { transform-box: fill-box; transform-origin: 82% 10%; transition: transform 0.45s ease; }
        .tw-sign { transform-box: fill-box; transform-origin: 50% 92%; }
        @media (prefers-reduced-motion: reduce) {
          .tw-leg, .tw-arm-r, .tw-arm-l, .tw-wave, .tw-sign { animation: none !important; transition: none !important; }
          svg { animation: none !important; }
        }
      `}</style>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          bottom: 0,
          marginLeft: -32,
          animation: walking ? "twBob 0.8s ease-in-out infinite" : undefined,
        }}
      >
        <svg viewBox="0 0 72 118" width="64" height="105" style={{ display: "block", overflow: "visible", transformOrigin: "50% 100%", animation: walking ? "twSwayWalk 0.8s ease-in-out infinite" : undefined }}>
          <defs>
            <clipPath id="tw-shirt">
              <rect x="29" y="36" width="14" height="32" />
            </clipPath>
          </defs>

          {/* legs — dark jeans + boots */}
          <g className="tw-leg" style={{ animation: walking ? "twStep 0.8s ease-in-out infinite" : undefined }}>
            <path d="M27.5 62 L34.5 62 L34 104 L28 104 Z" fill="#3c4457" />
            <path d="M26 104 L35.5 104 L36.5 112 Q36.5 114.5 33.5 114.5 L26.5 114.5 Q24.5 114.5 24.8 111 Z" fill="#4a3421" />
          </g>
          <g className="tw-leg" style={{ animation: walking ? "twStep 0.8s ease-in-out -0.4s infinite" : undefined }}>
            <path d="M37.5 62 L44.5 62 L44 104 L38 104 Z" fill="#454f66" />
            <path d="M36.5 104 L46 104 L47.2 111 Q47.5 114.5 44 114.5 L37.5 114.5 Q35.5 114.5 35.8 112 Z" fill="#553c26" />
          </g>

          {/* torso — plaid shirt, light tee at the neck, dark jacket */}
          <rect x="29" y="36" width="14" height="32" fill="#7a4636" />
          <g clipPath="url(#tw-shirt)" stroke="#5d3427" strokeWidth="1.6" opacity="0.65">
            <path d="M32 36 V68 M36 36 V68 M40 36 V68 M29 42 H43 M29 50 H43 M29 58 H43 M29 65 H43" />
          </g>
          <path d="M31.5 34 L40.5 34 L36 45 Z" fill="#e9e2cf" />
          <path d="M21.5 36 Q21 33 24.5 32.5 L31 32 L30 68 L21.5 68 Q20.5 50 21.5 36 Z" fill="#31363a" />
          <path d="M50.5 36 Q51 33 47.5 32.5 L41 32 L42 68 L50.5 68 Q51.5 50 50.5 36 Z" fill="#31363a" />
          <path d="M30.5 33 L27 42 L30 44 Z" fill="#26292c" />
          <path d="M41.5 33 L45 42 L42 44 Z" fill="#26292c" />
          <rect x="21.5" y="52" width="7.5" height="5" rx="1" fill="none" stroke="#26292c" strokeWidth="1.1" />
          <rect x="43" y="52" width="7.5" height="5" rx="1" fill="none" stroke="#26292c" strokeWidth="1.1" />

          {/* arms — jacket sleeves */}
          <g className="tw-arm-l" style={{ transform: signUp ? "rotate(150deg)" : "rotate(5deg)" }}>
            <path d="M17 35 L23 35 L21.5 59 Q21 62 18.5 61.5 Q16 61 16.2 58 Z" fill="#31363a" />
            <circle cx="18.8" cy="63.5" r="3.4" fill="#e0aa76" />
          </g>
          <g
            className="tw-arm-r"
            style={{
              transform: signUp ? "rotate(-150deg)" : waving ? "rotate(-148deg)" : "rotate(-5deg)",
            }}
          >
            <g
              className="tw-wave"
              style={{ animation: waving ? "twWave 0.45s ease-in-out infinite" : undefined }}
            >
              <path d="M49 35 L55 35 L55.8 58 Q56 61 53.5 61.5 Q51 62 50.5 59 Z" fill="#31363a" />
              <circle cx="53.2" cy="63.5" r="3.4" fill="#e0aa76" />
            </g>
          </g>

          {/* head — after the portrait: dark side-swept hair,
              mustache + goatee, kind eyes, slight smile */}
          <rect x="32.5" y="25" width="7" height="9" fill="#d9a06c" />
          <circle cx="25.6" cy="17" r="3" fill="#e8b98a" />
          <circle cx="46.4" cy="17" r="3" fill="#e8b98a" />
          <path d="M26 8 Q36 1.5 46 8 L46.8 20 Q46.8 29 36 30.5 Q25.2 29 25.2 20 Z" fill="#e8b98a" />
          <path d="M25 15.5 Q23.8 2.5 36 2 Q48.2 2.5 47 15.5 Q46.5 9.5 43.5 7.6 Q38 11 31.5 10.2 Q26.5 9.6 25 15.5 Z" fill="#2b2320" />
          <path d="M30 12.8 Q32.5 11.8 35 12.6" stroke="#191412" strokeWidth="1.7" fill="none" strokeLinecap="round" />
          <path d="M37.5 12.6 Q40 11.8 42.2 12.8" stroke="#191412" strokeWidth="1.7" fill="none" strokeLinecap="round" />
          <circle cx="32.2" cy="16.8" r="1.25" fill="#241a12" />
          <circle cx="39.8" cy="16.8" r="1.25" fill="#241a12" />
          <path d="M36.2 16.5 L35 21 Q36 22 37.2 21.2" stroke="#c98f5f" strokeWidth="1.1" fill="none" strokeLinecap="round" />
          <path d="M30.8 23.4 Q36 21.8 41.2 23.4 L40.6 26.2 Q36 24.9 31.4 26.2 Z" fill="#2b2320" />
          <path d="M31.8 27.2 Q36 29.2 40.2 27.2" stroke="#8a5636" strokeWidth="1.3" fill="none" strokeLinecap="round" />
          <path d="M31 27.8 Q36 34.5 41 27.8 Q40.4 32.8 36 33.2 Q31.6 32.8 31 27.8 Z" fill="#2b2320" opacity="0.92" />
          <g fill="#2b2320" opacity="0.3">
            <circle cx="27.6" cy="24" r="0.65" /><circle cx="44.4" cy="24" r="0.65" />
            <circle cx="28.4" cy="27" r="0.6" /><circle cx="43.6" cy="27" r="0.6" />
          </g>

          {/* the cardboard sign — in front of him when it is up,
              its sway keyframes carry the raised translate */}
          <g
            className="tw-sign"
            style={{
              opacity: signUp ? 1 : 0,
              transform: signUp
                ? "translate(-10px, -56px) rotate(-2deg)"
                : "translate(10px, 8px) rotate(24deg) scale(0.5)",
              transition: "transform 0.65s cubic-bezier(.34,1.45,.5,1), opacity 0.3s ease",
              animation: signUp ? "twSway 3.4s ease-in-out 0.8s infinite" : undefined,
            }}
          >
            <rect x="0" y="0" width="92" height="52" rx="3" fill="#c9a06b" stroke="#a87f4c" strokeWidth="2" />
            <rect x="4" y="4" width="84" height="44" rx="2" fill="none" stroke="#b28c55" strokeWidth="1" strokeDasharray="3 4" />
            <text
              x="46"
              y="22"
              textAnchor="middle"
              fontSize="12.5"
              fill="#5a4020"
              style={{ fontFamily: "'Segoe Print','Bradley Hand','Comic Sans MS',cursive", fontWeight: 700 }}
            >
              Made with ❤️
            </text>
            <text
              x="46"
              y="40"
              textAnchor="middle"
              fontSize="12"
              fill="#5a4020"
              style={{ fontFamily: "'Segoe Print','Bradley Hand','Comic Sans MS',cursive", fontWeight: 700 }}
            >
              from Taos, NM
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
