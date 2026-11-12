"use client";

import { useEffect, useRef, useState } from "react";
import {
  BODY_REGION_LABELS,
  bodyRegionFor,
  sectorsForRegion,
  type BodyRegion,
  type ScanRecord,
} from "@/lib/chart";
import { BackArt, FrontArt } from "./BodyMapArt";

// Interactive body map for the report: body areas from Adam's
// iridology chart drawn onto a stylized figure (front + back). Areas
// with findings light up by heat (how many signs, how strong);
// tapping an area opens its details pop-up (handled by the parent).
// Front ⇄ back is a sideways SWIPE on the body with a 3D flip —
// the Front/Back buttons were removed (Adam, 2026-11-02).

const FRONT_REGIONS: BodyRegion[] = [
  "head", "face", "throat", "chest", "heart", "liver", "spleen",
  "bowel", "kidneys", "pelvis", "arms", "legs",
];
const BACK_REGIONS: BodyRegion[] = [
  "head", "neck", "upperback", "spine", "kidneys", "pelvis", "arms", "legs",
];

export function regionStats(
  scan: Pick<ScanRecord, "markers" | "eye">,
): Map<BodyRegion, { count: number; heat: number }> {
  const acc = new Map<BodyRegion, { count: number; weight: number }>();
  for (const m of scan.markers) {
    const region = bodyRegionFor(scan.eye, m);
    const w = m.confidence === "strong" ? 3 : m.confidence === "moderate" ? 2 : 1;
    const cur = acc.get(region) ?? { count: 0, weight: 0 };
    cur.count += 1;
    cur.weight += w;
    acc.set(region, cur);
  }
  const out = new Map<BodyRegion, { count: number; heat: number }>();
  for (const [region, v] of acc) {
    out.set(region, {
      count: v.count,
      heat: v.weight >= 6 || v.count >= 3 ? 3 : v.weight >= 3 || v.count >= 2 ? 2 : 1,
    });
  }
  return out;
}

function Region({
  region,
  heat,
  active,
  onSelect,
  children,
  label,
}: {
  region: BodyRegion;
  heat: number;
  active: boolean;
  onSelect: (r: BodyRegion) => void;
  children: React.ReactNode;
  label: string;
}) {
  // Only areas actually marked in the iris (signs found) are
  // clickable — the rest are display-only (Adam's call, 2026-10-17).
  const clickable = heat > 0;
  return (
    <g
      className={`bm-region heat-${heat}${active ? " active" : ""}${clickable ? " clickable" : ""}`}
      {...(clickable
        ? {
            role: "button",
            "aria-label": label,
            tabIndex: 0,
            onClick: () => onSelect(region),
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(region);
              }
            },
          }
        : {})}
    >
      <title>{label}</title>
      {children}
    </g>
  );
}

export default function BodyMap({
  scan,
  activeRegion,
  onSelect,
}: {
  scan: ScanRecord;
  activeRegion: BodyRegion | null;
  onSelect: (region: BodyRegion) => void;
}) {
  const [side, setSide] = useState<"front" | "back">("front");
  const stats = regionStats(scan);
  const heat = (r: BodyRegion) => stats.get(r)?.heat ?? 0;

  // If a NEWLY selected region lives only on the hidden side, flip to
  // show it. Only reacts to selection changes — a manual swipe must
  // never be overridden by a stale selection.
  const prevRegionRef = useRef<BodyRegion | null>(null);
  useEffect(() => {
    if (activeRegion === prevRegionRef.current) return;
    prevRegionRef.current = activeRegion;
    if (!activeRegion) return;
    if (!FRONT_REGIONS.includes(activeRegion) && BACK_REGIONS.includes(activeRegion)) {
      setSide("back");
    } else if (!BACK_REGIONS.includes(activeRegion) && FRONT_REGIONS.includes(activeRegion)) {
      setSide("front");
    }
  }, [activeRegion]);

  const rg = (region: BodyRegion, children: React.ReactNode) => (
    <Region
      region={region}
      heat={heat(region)}
      active={activeRegion === region}
      onSelect={onSelect}
      label={`${BODY_REGION_LABELS[region]} — ${stats.get(region)?.count ?? 0} sign(s) found`}
    >
      {children}
    </Region>
  );

  /** Two passes over a view's shapes: first a fog layer over every
   *  area that isn't part of this reading (no signs found there), so
   *  only the reading's areas show the anatomy at full strength; then
   *  the tappable heat regions themselves. */
  const renderShapes = (shapes: Array<[BodyRegion, React.ReactNode]>) => (
    <>
      {shapes
        .filter(([region]) => heat(region) === 0)
        .map(([region, node], i) => (
          <g key={`fog-${region}-${i}`} className="bm-fog" aria-hidden="true">
            {node}
          </g>
        ))}
      {shapes.map(([region, node]) => (
        <g key={`rg-${region}`}>{rg(region, node)}</g>
      ))}
    </>
  );

  const armsNode = (
    <>
      <g transform="rotate(4 45 108)">
        <rect x="32" y="106" width="26" height="198" rx="11" />
      </g>
      <g transform="rotate(-4 195 108)">
        <rect x="182" y="106" width="26" height="198" rx="11" />
      </g>
    </>
  );
  const legsNode = (
    <>
      <rect x="80" y="330" width="36" height="182" rx="14" />
      <rect x="124" y="330" width="36" height="182" rx="14" />
    </>
  );
  const kidneysFrontNode = (
    <>
      <ellipse cx="80" cy="246" rx="10" ry="15" />
      <ellipse cx="160" cy="246" rx="10" ry="15" />
    </>
  );

  const FRONT_SHAPES: Array<[BodyRegion, React.ReactNode]> = [
    ["head", <ellipse cx="120" cy="27" rx="20" ry="11" />],
    ["face", <ellipse cx="120" cy="52" rx="17" ry="11" />],
    ["throat", <rect x="106" y="72" width="28" height="17" rx="6" />],
    ["chest", <ellipse cx="120" cy="156" rx="58" ry="44" />],
    ["heart", <ellipse cx="131" cy="156" rx="17" ry="15" />],
    ["liver", <ellipse cx="102" cy="222" rx="30" ry="16" />],
    ["spleen", <ellipse cx="163" cy="228" rx="10" ry="12" />],
    ["bowel", <ellipse cx="120" cy="272" rx="37" ry="26" />],
    ["kidneys", kidneysFrontNode],
    ["pelvis", <ellipse cx="120" cy="308" rx="42" ry="18" />],
    ["legs", legsNode],
    ["arms", armsNode],
  ];

  const BACK_SHAPES: Array<[BodyRegion, React.ReactNode]> = [
    ["head", <circle cx="120" cy="46" r="23" />],
    ["neck", <rect x="106" y="72" width="28" height="17" rx="6" />],
    ["upperback", <ellipse cx="120" cy="142" rx="56" ry="36" />],
    ["spine", <rect x="112" y="94" width="16" height="196" rx="7" />],
    ["kidneys", <ellipse cx="120" cy="246" rx="46" ry="17" />],
    ["pelvis", <ellipse cx="120" cy="308" rx="42" ry="18" />],
    ["legs", legsNode],
    ["arms", armsNode],
  ];

  const thisSide = side === "front" ? FRONT_REGIONS : BACK_REGIONS;
  const otherSide = side === "front" ? BACK_REGIONS : FRONT_REGIONS;
  const otherSideLit = otherSide.filter((r) => !thisSide.includes(r) && (stats.get(r)?.count ?? 0) > 0);
  const otherHasLit = otherSide.some(
    (r) => !thisSide.includes(r) && (stats.get(r)?.count ?? 0) > 0,
  );

  const activeCount = activeRegion ? stats.get(activeRegion)?.count ?? 0 : 0;
  const activeSectors = activeRegion ? sectorsForRegion(scan.eye, activeRegion) : [];

  // Sideways swipe on the body flips front ⇄ back (3D card flip).
  // A mostly-vertical gesture scrolls the page instead; the click
  // that ends a flipping swipe is swallowed so it can't also open
  // the region under the finger.
  const swipeRef = useRef<{
    id: number;
    x0: number;
    y0: number;
    done: boolean;
    vertical: boolean;
  } | null>(null);
  const flippedAtRef = useRef(0);
  const onPointerDown = (e: React.PointerEvent) => {
    if (swipeRef.current) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    swipeRef.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      done: false,
      vertical: false,
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const sw = swipeRef.current;
    if (!sw || sw.id !== e.pointerId || sw.done) return;
    const dx = e.clientX - sw.x0;
    const dy = e.clientY - sw.y0;
    if (!sw.vertical && Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) {
      sw.vertical = true;
    } else if (!sw.vertical && Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      sw.done = true;
      flippedAtRef.current = Date.now();
      setSide((s) => (s === "front" ? "back" : "front"));
    }
  };
  const endPointer = (e: React.PointerEvent) => {
    if (swipeRef.current?.id === e.pointerId) swipeRef.current = null;
  };

  return (
    <div className="bodymap" data-side={side}>
      <div
        className="bodymap-figures"
        style={{ touchAction: "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onClickCapture={(e) => {
          if (Date.now() - flippedAtRef.current < 400) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        <div className={`bm-flip-inner${side === "back" ? " flipped" : ""}`}>
          <figure className="bodymap-figure face-front" aria-hidden={side !== "front"}>
            <svg viewBox="0 0 240 540" role="group" aria-label="Body map, front view">
              <FrontArt />
              {renderShapes(FRONT_SHAPES)}
            </svg>
            <figcaption>Front</figcaption>
          </figure>

          <figure className="bodymap-figure face-back" aria-hidden={side !== "back"}>
            <svg viewBox="0 0 240 540" role="group" aria-label="Body map, back view">
              <BackArt />
              {renderShapes(BACK_SHAPES)}
            </svg>
            <figcaption>Back</figcaption>
          </figure>
        </div>
      </div>

      {activeRegion && (
        <p className="bm-caption">
          <b>{BODY_REGION_LABELS[activeRegion]}</b>
          {activeRegion === "bowel"
            ? " — the inner ring, all the way around the pupil."
            : activeSectors.length > 0
              ? ` — ${activeSectors.map((s) => `${s} o'clock`).join(", ")} on the chart.`
              : ` — the chart reads this area from the ${scan.eye === "right" ? "left" : "right"} iris.`}{" "}
          {activeCount === 0
            ? "No signs were found in this area."
            : `${activeCount} sign${activeCount === 1 ? "" : "s"} found — details in the pop-up, highlighted in the findings below.`}
        </p>
      )}
      {otherHasLit && (
        <p className="bm-caption muted">
          Also on the {side === "front" ? "back" : "front"} view:{" "}
          {otherSideLit.map((r) => BODY_REGION_LABELS[r]).join(", ")}.
        </p>
      )}
      <div className="bm-legend" aria-hidden="true">
        <span><i className="bm-swatch heat-1" /> lighter indication</span>
        <span><i className="bm-swatch heat-2" /> moderate</span>
        <span><i className="bm-swatch heat-3" /> strongest / most signs</span>
      </div>
    </div>
  );
}
