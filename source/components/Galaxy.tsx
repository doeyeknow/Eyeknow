// The animated galaxy, ported from the Palm Reading app at Adam's
// direction (2026-11-03): pure CSS, no assets — deep-space base,
// three nebula blobs drifting on long loops, a tilted milky-way
// band, and twinkling stars from a fixed seed so the server render
// and the client render agree (no hydration mismatch). Used in the
// top bar (nav), the full-screen menu, the hero, and the home
// scroll scene. prefers-reduced-motion leaves a static starfield.

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Star = {
  id: number;
  left: number;
  top: number;
  size: number;
  dur: number;
  delay: number;
  bright: boolean;
};

function makeStars(seed: number, count: number, brightEvery: number, maxSize: number): Star[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: rnd() * 100,
    top: rnd() * 100,
    size: 0.8 + rnd() * maxSize,
    dur: 2.2 + rnd() * 4,
    delay: -rnd() * 6,
    bright: i % brightEvery === 0,
  }));
}

// Same seeds as Palm's two fields, plus a hero field of its own.
const FULL_STARS = makeStars(20261025, 110, 9, 2.2);
const NAV_STARS = makeStars(20261026, 42, 10, 1.4);
const HERO_STARS = makeStars(20261103, 84, 9, 2.2);

export default function Galaxy({
  variant,
  still,
}: {
  variant: "nav" | "full" | "hero";
  still?: boolean;
}) {
  const stars = variant === "nav" ? NAV_STARS : variant === "hero" ? HERO_STARS : FULL_STARS;
  return (
    <div
      className={`galaxy${variant === "nav" ? " nav-galaxy" : ""}${still ? " galaxy-still" : ""}`}
      aria-hidden="true"
    >
      <div className="galaxy-nebula n1" />
      <div className="galaxy-nebula n2" />
      {variant !== "nav" && <div className="galaxy-nebula n3" />}
      {variant !== "nav" && <div className="galaxy-band" />}
      {stars.map((s) => (
        <span
          key={s.id}
          className={s.bright ? "galaxy-star bright" : "galaxy-star"}
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animationDuration: `${s.dur}s`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
