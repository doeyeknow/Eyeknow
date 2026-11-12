"use client";

import { useEffect } from "react";

// Scroll motion for the eyeKnow home view: sections slide in as they
// scroll into view, and the hero content drifts at a slower rate than
// the page (parallax). Enhancement-only by construction:
//  - the hidden start state lives behind the `fx-on` class, which this
//    effect adds — no JS, no observer, or reduced motion means the
//    content is simply fully visible, never hidden pending animation.
//  - transforms and opacity only; nothing scroll-jacks or traps.
//  - unmounts (leaving the home view) restore everything.
export default function ScrollFx() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const root = document.documentElement;
    root.classList.add("fx-on");

    const sections = Array.from(document.querySelectorAll("main section"));
    const pending = new Set(sections);
    const revealOne = (el: Element) => {
      el.classList.add("fx-in");
      reveal.unobserve(el);
      pending.delete(el);
    };
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) revealOne(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    sections.forEach((s) => reveal.observe(s));
    // Jump safety: a fast scroll (anchor link, restored position) can
    // carry a section fully past the viewport without the observer ever
    // seeing it intersect. Anything already above the viewport — or in
    // it — must never stay hidden, so sweep on mount and on scroll.
    const sweep = () => {
      const vh = window.innerHeight;
      for (const el of Array.from(pending)) {
        const r = el.getBoundingClientRect();
        if (r.bottom <= 0 || (r.top < vh && r.bottom > 0)) revealOne(el);
      }
    };
    sweep();

    let ticking = false;
    const parallax = () => {
      ticking = false;
      sweep();
      const hero = document.querySelector(".hero");
      const grid = hero?.querySelector(".hero-grid") as HTMLElement | null;
      if (!hero || !grid) return;
      const rect = hero.getBoundingClientRect();
      const vh = window.innerHeight;
      if (rect.bottom < 0 || rect.top > vh) {
        grid.style.transform = "";
        return;
      }
      const centerOffset = rect.top + rect.height / 2 - vh / 2;
      const shift = Math.max(-40, Math.min(40, -centerOffset * 0.08));
      grid.style.transform = `translateY(${shift.toFixed(1)}px)`;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(parallax);
      }
    };
    parallax();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      reveal.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      root.classList.remove("fx-on");
      const grid = document.querySelector(".hero-grid") as HTMLElement | null;
      if (grid) grid.style.transform = "";
    };
  }, []);

  return null;
}
