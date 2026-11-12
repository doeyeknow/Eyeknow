"use client";

import { useEffect, useState } from "react";

// Homepage cross-promo for the Palm Reading app (Adam, 2026-11-05):
// mostly pictures, little text. The slides are real frames from
// Palm Reading's own reading animation (palm.eyeknow.app), rotating
// every few seconds; the button is the way over. Copy keeps Palm
// Reading's rules: a traditional reading, never a diagnosis.
const SLIDES = [
  { src: "/palm-slide-1.jpg", alt: "Palm Reading detecting the hand type — Fire, an oblong palm with short fingers" },
  { src: "/palm-slide-2.jpg", alt: "Palm Reading weighing the mounts, the pads beneath the fingers" },
  { src: "/palm-slide-3.jpg", alt: "Palm Reading reading the thumb — will and logic" },
  { src: "/palm-slide-4.jpg", alt: "Palm Reading locating the Head line, the line of the mind" },
  { src: "/palm-slide-5.jpg", alt: "Palm Reading locating the Sun line, the line of recognition" },
  { src: "/palm-slide-6.jpg", alt: "Palm Reading finding the subtle details — the Mystic Cross in the palm's centre" },
];

export default function PalmPromo() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % SLIDES.length), 4200);
    return () => clearInterval(t);
  }, []);

  return (
    <section
      className="panel palm-panel"
      aria-label="Palm Reading app"
      style={{ position: "relative", opacity: 1, background: "transparent", borderColor: "transparent", boxShadow: "none" }}
    >
      {/* The panel's faded look (Adam's 0.7) lives on this backdrop
          layer only, so the screenshots and text render at full
          opacity 1 (Adam, 2026-11-05). */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 18,
          background: "rgba(11, 34, 31, 0.94)",
          border: "1px solid rgba(217, 164, 65, 0.55)",
          opacity: 0.7,
          boxShadow: "var(--shadow)",
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>
      <h2>🖐️ Now reading palms, too</h2>
      <div
        style={{
          position: "relative",
          maxWidth: 320,
          margin: "14px auto 0",
          borderRadius: 14,
          overflow: "hidden",
          aspectRatio: "302 / 378",
          background: "#0b221f",
        }}
      >
        {SLIDES.map((s, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={s.src}
            src={s.src}
            alt={i === idx ? s.alt : ""}
            aria-hidden={i !== idx}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: i === idx ? 1 : 0,
              transition: "opacity 0.9s ease",
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 7, justifyContent: "center", marginTop: 12 }}>
        {SLIDES.map((s, i) => (
          <button
            key={s.src}
            type="button"
            aria-label={`Show Palm Reading image ${i + 1}`}
            onClick={() => setIdx(i)}
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              border: "none",
              padding: 0,
              cursor: "pointer",
              background: i === idx ? "#d3ab4a" : "rgba(243, 234, 216, 0.35)",
            }}
          />
        ))}
      </div>
      <p style={{ marginTop: 14 }}>
        Photograph your palm and the back of your hand — Palm Reading reads them the old
        way. A traditional reading, never a diagnosis.
      </p>
      <a className="btn big" href="https://palm.eyeknow.app">
        Check it out →
      </a>
      </div>
    </section>
  );
}
