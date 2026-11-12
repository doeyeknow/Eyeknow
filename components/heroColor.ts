"use client";

import { useEffect, useState } from "react";

// One colour for every eye on the front page (Adam, 2026-11-05):
// the hero eye changes colour on every refresh, and every other
// eye on the page — the logo eye, the demo minis, the cover-card
// irises — matches it. The index advances once per page load
// (module-level memo: every consumer in the load shares it),
// persists across refreshes via local storage, and cycles six
// colours: brown, blue, green, gold, violet, grey.

export const HERO_EYE_SRCS = [
  "/demo-iris.jpg",
  "/demo-iris-blue.jpg",
  "/demo-iris-green.jpg",
  "/demo-iris-gold.jpg",
  "/demo-iris-violet.jpg",
  "/demo-iris-grey.jpg",
];

/** The same cycle as filters — for the personal hero (the visitor's
 *  own scan illustration) and any canvas eye that must recolour
 *  without a recoloured source file. */
export const HERO_FILTERS = [
  "none",
  "hue-rotate(180deg)",
  "hue-rotate(100deg)",
  "hue-rotate(16deg)",
  "hue-rotate(-115deg)",
  "hue-rotate(180deg) saturate(0.38)",
];

/** The logo eye's ring colour per step (its natural state is the
 *  gold at step 3; step 0 is the browner gold of the demo iris). */
export const HERO_LOGO_STROKES = [
  "#a5713d",
  "#5b8dd6",
  "#57a773",
  "#d9a441",
  "#9a7bc8",
  "#98a2ab",
];

const KEY = "eyeknow-hero-eye-v1";
let memo: number | null = null;

export function heroColorIndex(): number {
  if (memo !== null) return memo;
  let next = 0;
  try {
    const last = Number(window.localStorage.getItem(KEY) ?? -1);
    next = (last + 1) % HERO_EYE_SRCS.length;
    window.localStorage.setItem(KEY, String(next));
  } catch {
    /* storage unavailable — stay on the natural colour */
    next = 0;
  }
  memo = next;
  return next;
}

export function useHeroColorIndex(): number {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(heroColorIndex());
  }, []);
  return idx;
}
