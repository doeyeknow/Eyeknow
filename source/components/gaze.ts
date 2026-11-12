// Shared "the eyes follow your finger" tracker (Adam, 2026-11-03):
// the pupils of the logo eyes (top bar, bottom-bar lens) and the
// hero eye on the home page turn toward wherever the user is
// touching — or the mouse is hovering — and ease back to centre
// when the touch ends. Each registered target supplies its own
// follow/return speeds, so the big hero eye drifts home slowly
// while the small bar icons settle quicker.
//
// Deliberately tiny and dependency-free. Under
// prefers-reduced-motion nothing is ever registered.

type GazeTarget = {
  el: HTMLElement | SVGSVGElement;
  apply: (nx: number, ny: number) => void;
  follow: number; // lerp rate per frame while tracking
  ret: number; // lerp rate per frame while returning to centre
  cur: { x: number; y: number };
  want: { x: number; y: number };
};

const targets = new Set<GazeTarget>();
const pointer = { x: 0, y: 0, seen: false, touching: false };
let raf = 0;
let installed = false;

function recompute() {
  for (const t of targets) {
    if (!pointer.seen || !pointer.touching) {
      t.want.x = 0;
      t.want.y = 0;
      continue;
    }
    const r = t.el.getBoundingClientRect();
    const dx = pointer.x - (r.left + r.width / 2);
    const dy = pointer.y - (r.top + r.height / 2);
    const dist = Math.hypot(dx, dy);
    if (dist < 1) {
      t.want.x = 0;
      t.want.y = 0;
      continue;
    }
    // Full deflection once the pointer is ~140px away; closer
    // touches give a partial gaze in the same direction.
    const s = Math.min(1, dist / 140);
    t.want.x = (dx / dist) * s;
    t.want.y = (dy / dist) * s;
  }
}

let lastTick = 0;

function tick(now: number) {
  raf = 0;
  // Time-normalized easing: the lerp rates are defined per 60fps
  // frame, and the step is scaled by the real elapsed time, so
  // the follow and the (slow) return take the same wall-clock
  // time on a fast screen and a struggling one alike.
  const dt = lastTick ? Math.min(100, Math.max(1, now - lastTick)) : 16.7;
  lastTick = now;
  const steps = dt / 16.7;
  let awake = false;
  for (const t of targets) {
    const returning = t.want.x === 0 && t.want.y === 0;
    const rate = returning ? t.ret : t.follow;
    const f = 1 - Math.pow(1 - rate, steps);
    t.cur.x += (t.want.x - t.cur.x) * f;
    t.cur.y += (t.want.y - t.cur.y) * f;
    if (Math.abs(t.want.x - t.cur.x) < 0.002 && Math.abs(t.want.y - t.cur.y) < 0.002) {
      t.cur.x = t.want.x;
      t.cur.y = t.want.y;
    } else {
      awake = true;
    }
    if (returning && (t.cur.x !== 0 || t.cur.y !== 0)) awake = true;
    t.apply(t.cur.x, t.cur.y);
  }
  if (awake) raf = requestAnimationFrame(tick);
}

function kick() {
  recompute();
  if (!raf) raf = requestAnimationFrame(tick);
}

function install() {
  if (installed) return;
  installed = true;
  const onPoint = (e: PointerEvent) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.seen = true;
    pointer.touching = true;
    kick();
  };
  window.addEventListener("pointerdown", onPoint, { passive: true });
  window.addEventListener("pointermove", onPoint, { passive: true });
  const onEnd = (e: PointerEvent) => {
    // A lifted finger ends the gaze; a mouse keeps "looking"
    // from its last hover position until it moves again.
    if (e.pointerType !== "mouse") {
      pointer.touching = false;
      kick();
    }
  };
  window.addEventListener("pointerup", onEnd, { passive: true });
  window.addEventListener("pointercancel", onEnd, { passive: true });
  window.addEventListener("blur", () => {
    pointer.touching = false;
    kick();
  });
  window.addEventListener("scroll", kick, { passive: true, capture: true });
}

export function registerGaze(opts: {
  el: HTMLElement | SVGSVGElement;
  apply: (nx: number, ny: number) => void;
  follow?: number;
  ret?: number;
}): () => void {
  if (typeof window === "undefined") return () => undefined;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return () => undefined;
  }
  install();
  const t: GazeTarget = {
    el: opts.el,
    apply: opts.apply,
    follow: opts.follow ?? 0.3,
    ret: opts.ret ?? 0.1,
    cur: { x: 0, y: 0 },
    want: { x: 0, y: 0 },
  };
  targets.add(t);
  kick();
  return () => {
    targets.delete(t);
  };
}
