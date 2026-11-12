"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { HERO_EYE_SRCS, useHeroColorIndex } from "./heroColor";

/** Section icons — one per part of the report, drawn in the app's
 *  24×24 line style. Used by the "What the report covers" cards and
 *  by the report's tab bar (icons in place of text labels). */
export const SECTION_ICONS = {
  overview: (
    <>
      <path d="M2.5 12C5 6.6 8.5 4.6 12 4.6S19 6.6 21.5 12C19 17.4 15.5 19.4 12 19.4S5 17.4 2.5 12Z" />
      <circle cx="12" cy="12" r="3.1" />
    </>
  ),
  findings: (
    <>
      <circle cx="5" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="5" cy="18" r="1.5" fill="currentColor" stroke="none" />
      <path d="M9.5 6h10M9.5 12h10M9.5 18h6.5" />
    </>
  ),
  bodymap: (
    <>
      <circle cx="12" cy="4.8" r="2.5" />
      <path d="M12 8v5.5M6.8 10.2 12 8.6l5.2 1.6M9.6 20.5 12 13.5l2.4 7" />
    </>
  ),
  colour: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <circle cx="9" cy="9.2" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="14.8" cy="9.2" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="9" cy="14.8" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="15.2" cy="15.2" r="1.7" />
    </>
  ),
  diet: (
    <>
      <path d="M5.5 18.5C5.5 10.5 11.5 5 19.5 5c0 8-5.5 13.5-13.5 13.5" />
      <path d="M5.5 18.5c1.8-4.8 5-8.2 9.5-10.5" />
    </>
  ),
  timeline: (
    <>
      <circle cx="5.5" cy="12" r="2.4" />
      <circle cx="18.5" cy="12" r="2.4" />
      <path d="M8 12h8M14.2 9.6 16.6 12l-2.4 2.4" />
    </>
  ),
  notes: (
    <>
      <rect x="5.5" y="3.5" width="13" height="17" rx="2" />
      <path d="M9.3 8h5.2M9.3 12h5.2M9.3 16h3.2" />
    </>
  ),
};

/** "What the report covers": a card per part of the report, each
 *  with its icon and a small visual of that part of the report in
 *  the same mock style as the report preview.
 *
 *  Scroll animation (Adam, 2026-11-01): each card animates ONCE,
 *  when that card itself scrolls well into view — its rise-in,
 *  then its mock visual's own flourish (rows slide in, body-map
 *  hot spots pop, swatches grow, the timeline irises arrive in
 *  sequence). Each card is unobserved as it plays, so scrolling
 *  away and back never replays it.
 *
 *  Why per-card: the first version observed the whole grid and
 *  checked only `isIntersecting`, which flips true the moment a
 *  single pixel of the grid enters the viewport — so the entire
 *  sequence played while the section was still below the fold
 *  (Adam's report, 2026-11-01). Each card is now observed on its
 *  own, and the play check requires a real intersection ratio,
 *  so a card plays only when it is genuinely on screen.
 *  Enhancement only: the pre-animation state is applied by JS (the
 *  `cover-armed` class) after mount, so no-JS and reduced-motion
 *  visitors simply see the finished cards. */
export default function CoverCards() {
  const eyeIdx = useHeroColorIndex();
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof IntersectionObserver === "undefined") return;
    grid.classList.add("cover-armed");
    const cards = Array.from(grid.querySelectorAll<HTMLElement>(".cover-card"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.3) {
            (e.target as HTMLElement).classList.add("cover-play");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.3, rootMargin: "0px 0px -10% 0px" },
    );
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);
  const swatches: Array<[string, string]> = [
    ["#f5f1e3", "Acute"],
    ["#e6c93c", "Sub-acute"],
    ["#dd7f22", "Chronic"],
    ["#8a5a24", "Chronic"],
    ["#2a251f", "Deepest"],
  ];
  const cards: Array<{
    icon: keyof typeof SECTION_ICONS;
    title: string;
    copy: string;
    visual: ReactNode;
  }> = [
    {
      icon: "overview",
      title: "Overview & constitution",
      copy: "Your reading at a glance in plain language, the traditional type read from your iris colour (lymphatic, hematogenic, or biliary), and where your signs cluster across the iris's three rings.",
      visual: (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="rp-iris" src={HERO_EYE_SRCS[eyeIdx]} alt="" />
          <div className="rp-lines">
            <b>Your reading at a glance</b>
            <b>Hematogenic constitution</b>
            <span />
          </div>
        </>
      ),
    },
    {
      icon: "findings",
      title: "Findings, clearest first",
      copy: "Every sign the reader found, sorted with the clearest first — each with where it sits on the body, its traditional reading, its colour stage, and how clearly it was seen.",
      visual: (
        <div className="rp-lines wide">
          {[
            ["#b91c1c", "Nerve ring"],
            ["#6d28a8", "Dark marking (lacuna)"],
            ["#b3541e", "Pigment deposit"],
          ].map(([c, label]) => (
            <div className="rp-row" key={label}>
              <i className="rp-dot" style={{ background: c }} />
              <b>{label}</b>
            </div>
          ))}
          <span className="cover-pill">Confidence: Strong first</span>
        </div>
      ),
    },
    {
      icon: "bodymap",
      title: "Interactive body map",
      copy: "Your findings lit up on a front-and-back body visual — tap a lit area and its signs pop up with the matching section of your iris highlighted.",
      visual: (
        <>
          <svg className="rp-bodyfig" viewBox="0 0 40 92" aria-hidden="true">
            <circle cx="20" cy="9" r="7" />
            <rect x="9" y="19" width="22" height="42" rx="10" />
            <rect x="11" y="61" width="8" height="27" rx="4" />
            <rect x="21" y="61" width="8" height="27" rx="4" />
            <circle className="rp-hot" cx="20" cy="32" r="3.4" />
            <circle className="rp-hot" cx="16" cy="47" r="3.4" />
            <circle className="rp-hot" cx="25" cy="55" r="3.4" />
          </svg>
          <div className="rp-lines">
            <b>Areas lit by your signs</b>
            <span />
            <span />
          </div>
        </>
      ),
    },
    {
      icon: "colour",
      title: "Colour, stage, inheritance & temperament",
      copy: "Each sign's colour is read as its stage — acute and active through to chronic and settled — along with your constitution strength, the signs you inherited (and which family line they came down), and a temperament sketch — the personality half of the classic reading.",
      visual: (
        <div className="rp-lines wide">
          <b>Every sign's stage, by its colour</b>
          <div className="cover-swatches">
            {swatches.map(([bg, label], i) => (
              <figure key={i}>
                <i style={{ background: bg }} />
                <figcaption>{label}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      ),
    },
    {
      icon: "diet",
      title: "Personalized diet recommendations",
      copy: "Traditional food themes built from your constitution, the areas your reading highlights, and your sign patterns — with a nutrient focus for each area. Real foods, everyday eating.",
      visual: (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="rp-diet" src="/diet/greens.jpg" alt="" />
          <div className="rp-lines">
            <b>Foods for your areas</b>
            <span />
            <span />
          </div>
        </>
      ),
    },
    {
      icon: "timeline",
      title: "Timeline — watch the signs change",
      copy: "Rescan the same iris over time and each new scan is compared with the last: what's new, what faded, what reads stronger or weaker — and what lightened a stage, the healing direction. Follow-ups unlock for $1.",
      visual: (
        <div className="rp-lines wide">
          <div className="tl-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="tl-iris" src={HERO_EYE_SRCS[eyeIdx]} alt="" />
            <span className="tl-arrow">→</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="tl-iris" src={HERO_EYE_SRCS[eyeIdx]} alt="" />
            <span className="tl-arrow">→</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="tl-iris tl-now" src={HERO_EYE_SRCS[eyeIdx]} alt="" />
          </div>
          <span className="cover-pill">↑ 1 lightened a stage</span>
        </div>
      ),
    },
    {
      icon: "notes",
      title: "Notes & the honest framing",
      copy: "The classic lifestyle themes traditional iridology attaches to your pattern, how the reading was made — and the standing note that this is a traditional reading, never a medical diagnosis.",
      visual: (
        <div className="rp-lines wide">
          <b>Notes from the traditional reading</b>
          <span />
          <span />
          <span />
        </div>
      ),
    },
  ];
  return (
    <div className="cover-grid" ref={gridRef}>
      {cards.map((c) => (
        <div className="cover-card" key={c.title}>
          <div className="cover-head">
            <span className="cover-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {SECTION_ICONS[c.icon]}
              </svg>
            </span>
            <h3>{c.title}</h3>
          </div>
          <div className="cover-shot" aria-hidden="true">
            <div className="cover-inner">{c.visual}</div>
          </div>
          <p>{c.copy}</p>
        </div>
      ))}
    </div>
  );
}

