"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ScanRecord } from "@/lib/chart";
import { chartAreaFor, revealPicks, SIGNS, SIGN_COLORS } from "@/lib/chart";
import IrisIllustration from "./IrisIllustration";
import UnlockPrice from "./DiscountPrice";
import UnlockModal from "./UnlockModal";
import Galaxy from "./Galaxy";
import { REGION_ICONS } from "./RegionBadge";
import type { BodyRegion, RevealAreaPick } from "@/lib/chart";

/** A body part's line icon in the app's style (gold, currentColor). */
function RIcon({ region, size = 18 }: { region: BodyRegion; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="rvi-icon"
    >
      {REGION_ICONS[region]}
    </svg>
  );
}

// The post-scan reveal (Adam, 2026-11-05): before the report, get
// the person excited — "Are you ready to see what eyeKnow found?",
// a brief overview of what the reader is most confident about,
// then one slide per body area that needs the most support
// (three), then the way into the reading: free preview, the $3
// basic reading, or the full unlock.

// Each slide gets a good read before it changes (Adam, 2026-11-05:
// more time than the original 3.6s).
const SLIDE_MS = 6000;

const REGION_LINES: Record<BodyRegion, string> = {
  head: "A busy, pressured pattern: mental overwork, tension carried up from the neck and shoulders, or the circulation to the head working harder than it should. An old knock to the head can echo in this area for years.",
  face: "Strain and tiredness — long hours of close focus and screens, or heaviness around the sinuses after colds and dusty seasons.",
  throat: "A voice that gets used hard — talking, singing, teaching all day — or a throat that has weathered a lot of coughs, smoke or dry air.",
  neck: "Tension and stiffness — posture at a desk or behind a wheel, sleeping at an odd angle, or the after-echo of a whiplash-style jolt.",
  chest: "Breathing that runs shallower than it should — smoky or dusty air, old chesty colds, or tension that keeps the ribcage held tight.",
  heart: "The circulation working under pressure — long stretches of stress, short sleep, and the general wear of pushing hard for a long time.",
  liver: "The body's clearing work running heavy — rich food and drink, medications, and the general filtering load of modern life.",
  spleen: "The body's defence and clearing work running heavy — after illnesses, in run-down stretches, when energy stays low.",
  bowel: "Digestion under strain: hurried meals, food that doesn't agree, irregular rhythms, and stress that lands in the gut.",
  kidneys: "The body's water balance under strain — not enough water, plenty of coffee or salt — and a lower back that takes the load first.",
  pelvis: "Tension and pressure low in the body — long sitting, heavy lifting, or an old fall onto the tailbone that the body still remembers.",
  arms: "Overuse — repetitive work, gripping, lifting — or a knock or strain the arm still carries.",
  legs: "Miles and impact — long standing, heavy work, old sprains and knocks — and circulation that has to work uphill.",
  spine: "Strain and posture — lifting, twisting, long sitting — or the echo of an old back injury that never quite left the pattern.",
  upperback: "Tension carried high — hunching over work, carrying weight on one side, or an old shoulder strain.",
};

export default function RevealSlides({
  scan,
  onDone,
  onUnlockBasic,
  onUnlockFull,
  busy,
  onExit,
  personName,
  onNamePerson,
  onFinaleChange,
  unlockSignal,
  onCouponUnlock,
}: {
  scan: ScanRecord;
  onDone: () => void;
  onUnlockBasic: () => void;
  onUnlockFull: () => void;
  busy?: boolean;
  /** The person this scan belongs to, and the rename saver — the
   *  first slide carries a bare name line (Adam, 2026-11-06). */
  personName?: string | null;
  onNamePerson?: (name: string) => void;
  /** Tells the app when the locked finale is showing, so the
   *  bottom bar's center lens can turn into the unlock button;
   *  unlockSignal increments when that button is tapped. */
  onFinaleChange?: (atUnlockFinale: boolean) => void;
  unlockSignal?: number;
  /** Coupon-code free unlock (Adam, 2026-11-12): the server has
   *  already validated the code — the app refreshes the reading. */
  onCouponUnlock?: (code: string) => void;
  /** Shown under the finale's unlock buttons when the intro was
   *  opened from My readings (Adam, 2026-11-06): the way back to
   *  the list without paying — the report itself opens only after
   *  the basic or full unlock is paid. */
  onExit?: () => void;
}) {
  const picks = useMemo(() => revealPicks(scan), [scan]);
  const areas = picks.needsSupport;
  const total = 1 + areas.length + 1; // hook + area slides + finale
  // A named reading skips the first slide — its name ask is
  // already answered (Adam, 2026-11-06).
  const [idx, setIdx] = useState(() => ((personName ?? "").trim() ? 1 : 0));
  const [auto, setAuto] = useState(true);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [nameFocus, setNameFocus] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [dir, setDir] = useState(1);
  const [areaDetail, setAreaDetail] = useState<RevealAreaPick | null>(null);

  useEffect(() => {
    if (!auto || idx >= total - 1) return undefined;
    // Typing a name on the first slide holds the slideshow.
    if (nameFocus) return undefined;
    // The name ask itself holds the slideshow: on a phone the input
    // may never take focus after a scan (no user gesture in the
    // stack), so a focus-only hold let the slide flip away in 6s and
    // the ask was gone before it could be answered (Adam, 2026-11-07).
    // While the reading is unnamed, slide 0 waits; the arrows and
    // dots still move on, and entering a name advances as before.
    if (idx === 0 && !(savedName ?? personName ?? "").trim()) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const t = window.setTimeout(() => {
      setDir(1);
      setIdx((v) => Math.min(v + 1, total - 1));
    }, SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [auto, idx, total, nameFocus, savedName, personName]);

  const go = (i: number) => {
    setAuto(false);
    setDir(i >= idx ? 1 : -1);
    setIdx(Math.max(0, Math.min(i, total - 1)));
  };
  const locked = !scan.unlocked;
  const atUnlockFinale = locked && idx === total - 1;
  useEffect(() => {
    onFinaleChange?.(atUnlockFinale);
  }, [atUnlockFinale, onFinaleChange]);
  useEffect(() => () => onFinaleChange?.(false), [onFinaleChange]);
  // Start from the CURRENT signal: the counter lives in the app
  // shell and survives this component, so a press from an earlier
  // reading must not read as a fresh press on mount (Adam,
  // 2026-11-06: the modal was opening before the button was clicked).
  const askRef = useRef(unlockSignal ?? 0);
  useEffect(() => {
    if (unlockSignal && unlockSignal !== askRef.current) {
      askRef.current = unlockSignal;
      setUnlockOpen(true);
    }
  }, [unlockSignal]);
  // Once a name is entered, the input hides and the finale header
  // carries the name, on one line (Adam, 2026-11-06).
  const named = (savedName ?? personName ?? "").trim();
  const finaleText = named
    ? `Do you know what eyeKnow about ${named}?`
    : "Do you know what eyeKnow?";
  const hookText = named
    ? `You won\u2019t believe what eyeKnow about ${named}!`
    : "You won\u2019t believe what eyeKnow!";
  const eyeWord = scan.eye === "left" ? "left" : "right";
  const poss = named ? (named.endsWith("s") ? `${named}\u2019` : `${named}\u2019s`) : null;
  // The illustration stays on every slide (Adam, 2026-11-05); on a
  // body-area slide it marks only that area's points.
  const onArea = idx >= 1 && idx <= areas.length;
  const slideScan = onArea
    ? {
        ...scan,
        markers: scan.markers.filter(
          (m) => chartAreaFor(scan.eye, m.sector, m.zone).label === areas[idx - 1].area,
        ),
      }
    : scan;

  // The marked points on the illustration: color-coded by sign (the
  // report's SIGN_COLORS) and numbered for the slide (Adam,
  // 2026-11-05). Positions mirror IrisIllustration's canvas mapping
  // (photo coords → iris disc, PHOTO_IRIS_R = 0.36, drawn at 0.97R).
  const dotPos = (m: ScanRecord["markers"][number]) => {
    let dx = (m.x - 0.5) / 0.36;
    let dy = (m.y - 0.5) / 0.36;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    return {
      left: `${(50 + dx * 48.5).toFixed(1)}%`,
      top: `${(50 + dy * 48.5).toFixed(1)}%`,
    };
  };
  const illus = (big = false, markMode: "dots" | "icons" = "dots") => (
    <div className={`rvi-illus${big ? " big" : ""}`}>
      <IrisIllustration scan={slideScan} bare still />
      {onArea && (
        <span className="rvi-pupil-icon">
          <RIcon region={areas[idx - 1].region} size={38} />
        </span>
      )}
      {markMode === "icons" &&
        areas.map((a) => {
          const pts = scan.markers
            .filter(
              (m) => chartAreaFor(scan.eye, m.sector, m.zone).label === a.area,
            )
            .map(dotPos);
          if (!pts.length) return null;
          const cx = pts.reduce((t, q) => t + parseFloat(q.left), 0) / pts.length;
          const cy = pts.reduce((t, q) => t + parseFloat(q.top), 0) / pts.length;
          return (
            <button
              type="button"
              key={a.area}
              aria-label={`Open ${a.area} detection details`}
              onClick={() => {
                setAuto(false);
                setAreaDetail(a);
              }}
              style={{
                position: "absolute",
                left: `${cx}%`,
                top: `${cy}%`,
                transform: "translate(-50%, -50%)",
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "rgba(10, 26, 22, 0.88)",
                border: "1.5px solid #ffd76a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffd76a",
                zIndex: 3,
                cursor: "pointer",
                padding: 0,
              }}
            >
              <RIcon region={a.region} size={20} />
            </button>
          );
        })}
      {markMode === "dots" &&
        slideScan.markers.map((m, i) => (
        <span
          key={m.id}
          className="rvi-mdot"
          style={{
            ...dotPos(m),
            background: SIGN_COLORS[m.sign].bg,
            color: SIGN_COLORS[m.sign].fg,
          }}
          >
            {i + 1}
          </span>
        ))}
    </div>
  );

  return (
    <section className="rvi-wrap" style={{ perspective: 1200 }}>
      <style>{`
        @keyframes rviFlipF {
          from { transform: rotateY(58deg); opacity: 0; }
          to { transform: rotateY(0deg); opacity: 1; }
        }
        @keyframes rviFlipB {
          from { transform: rotateY(-58deg); opacity: 0; }
          to { transform: rotateY(0deg); opacity: 1; }
        }
        .rvi-flip-f { animation: rviFlipF 0.55s ease both; }
        .rvi-flip-b { animation: rviFlipB 0.55s ease both; }
        .rvi-arrow {
          width: 46px; height: 46px; border-radius: 50%;
          border: 1.5px solid rgba(240, 230, 200, 0.55);
          background: rgba(16, 34, 29, 0.55); color: #f3ecd9;
          font-size: 1.7rem; line-height: 1; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          padding: 0 0 4px;
        }
        .galaxy-still .galaxy-star,
        .galaxy-still .galaxy-nebula,
        .galaxy-still .galaxy-band { animation: none !important; }
        @media (prefers-reduced-motion: reduce) {
          .rvi-flip-f, .rvi-flip-b { animation: none; }
        }
      `}</style>
      <Galaxy variant="full" still />
      <div
        className={`rvi-card${idx === 0 ? " top" : ""} ${dir >= 0 ? "rvi-flip-f" : "rvi-flip-b"}`}
        key={idx}
      >
        {idx === 0 && (
          <>
            <h1
              className="rvi-hook"
              style={
                named && named.length > 24 ? { fontSize: "0.78em" } : undefined
              }
            >
              {named ? (
                <>
                  <span style={{ fontSize: "1.5em" }}>
                    Hey <span style={{ color: "#ffd76a" }}>{named}</span>,
                  </span>
                  <br />
                  what eyeKnow about you
                  <br />
                  is going to blow your mind!
                </>
              ) : (
                hookText
              )}
            </h1>
            <p className="rvi-sub">
              We found <b>{picks.totalSigns} sign{picks.totalSigns === 1 ? "" : "s"}</b> in{" "}
              {poss ?? "your"} {eyeWord} iris.
            </p>
            {onNamePerson && !named && (
              <div style={{ textAlign: "center", marginTop: 10 }}>
                <input
                  type="text"
                  autoFocus
                  defaultValue={personName ?? ""}
                  placeholder="Who does this scan belong to?"
                  aria-label="Name of the person this scan belongs to"
                  maxLength={60}
                  autoComplete="off"
                  onFocus={() => setNameFocus(true)}
                  onBlur={(e) => {
                    setNameFocus(false);
                    const v = e.target.value.trim();
                    if (v !== (personName ?? "")) onNamePerson(v);
                    setSavedName(v ? v : null);
                    // A name given = onward (Adam, 2026-11-06).
                    if (v) go(1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    borderBottom: "2px solid rgba(240, 230, 200, 0.65)",
                    outline: "none",
                    textAlign: "center",
                    font: "inherit",
                    fontSize: "1.5rem",
                    color: "inherit",
                    width: "min(400px, 88%)",
                    padding: "8px 10px",
                  }}
                />
              </div>
            )}
          </>
        )}
        {idx >= 1 && idx <= areas.length && (
          <>
            <p className="rvi-kicker">
              Area {idx} of {areas.length} that could use support
            </p>
            <h2 className="rvi-area">{areas[idx - 1].area}</h2>
            {illus()}
            <p className="rvi-area-line">
              {REGION_LINES[areas[idx - 1].region] ??
                "The tissue working harder than it should — everyday strain, held tension, or the echo of an old knock can all leave their mark here."}
            </p>
          </>
        )}
        {idx === total - 1 && (
          <>
            <h2
              className="rvi-finale-head"
              style={
                named && named.length > 24 ? { fontSize: "0.78em" } : undefined
              }
            >
              {named ? (
                <>
                  <span style={{ fontSize: "1.5em" }}>
                    Hey <span style={{ color: "#ffd76a" }}>{named}</span>,
                  </span>
                  <br />
                  what eyeKnow about you
                  <br />
                  is going to blow your mind!
                </>
              ) : (
                finaleText
              )}
            </h2>
            {illus(false, "icons")}
            <p className="rvi-sub" style={{ textAlign: "center", marginBottom: 6 }}>
              We found <b>{picks.totalSigns} sign{picks.totalSigns === 1 ? "" : "s"}</b> in{" "}
              {poss ?? "your"} {eyeWord} iris.
            </p>
            <p className="rvi-sub" style={{ textAlign: "center", marginTop: 0, marginBottom: 10, fontSize: "0.85em" }}>
              Tap an area icon to see what we detected in that part of {poss ?? "your"} eye.
            </p>
            {!locked && (

              <div className="rvi-actions">
                <button type="button" className="btn big" onClick={onDone}>
                  See your full reading →
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {areaDetail && (
        <div className="modal-backdrop" onClick={() => setAreaDetail(null)} role="presentation">
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${areaDetail.area} detection details`}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setAreaDetail(null)}
              aria-label="Close area details"
            >
              ×
            </button>
            <p className="report-brand">
              eyeKnow · {poss ?? "your"} {eyeWord} iris · {areaDetail.area}
            </p>
            <h3 className="modal-title">{areaDetail.area}</h3>
            <div className="modal-iris">
              <img src={scan.image} alt={`${eyeWord} iris crop for ${areaDetail.area}`} />
              <svg
                className="modal-iris-overlay"
                viewBox="0 0 100 100"
                aria-hidden="true"
              >
                <rect width="100" height="100" fill="rgba(8, 18, 14, 0.35)" />
                {scan.markers
                  .filter((m) => chartAreaFor(scan.eye, m.sector, m.zone).label === areaDetail.area)
                  .map((m) => (
                    <circle
                      key={m.id}
                      cx={m.x * 100}
                      cy={m.y * 100}
                      r={2.6}
                      fill={SIGN_COLORS[m.sign].bg}
                      stroke="rgba(255,255,255,0.85)"
                      strokeWidth="0.6"
                    />
                  ))}
              </svg>
            </div>
            <ul className="modal-findings">
              {scan.markers
                .filter((m) => chartAreaFor(scan.eye, m.sector, m.zone).label === areaDetail.area)
                .map((m) => (
                  <li key={m.id}>
                    <b style={{ color: SIGN_COLORS[m.sign].fg ? undefined : "#0d3b37" }}>
                      {SIGNS[m.sign].label}
                    </b>{" "}
                    — {m.tone ? `${m.tone} tone · ` : ""}
                    {m.confidence ? `${m.confidence} confidence` : ""}
                    <div style={{ color: "#55685f", fontSize: "0.92em", marginTop: 4 }}>
                      {SIGNS[m.sign].traditional}
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      )}
      {unlockOpen && (
        <UnlockModal
          name={named || null}
          scanId={scan.id}
          accessToken={scan.accessToken}
          basicPaid={Boolean(scan.basic)}
          onBasic={() => {
            setUnlockOpen(false);
            onUnlockBasic();
          }}
          onFull={() => {
            setUnlockOpen(false);
            onUnlockFull();
          }}
          onCouponUnlock={(code) => {
            setUnlockOpen(false);
            onCouponUnlock?.(code);
          }}
          onClose={() => setUnlockOpen(false)}
        />
      )}
      <div className="rvi-nav">
        {idx > 0 ? (
          <button
            type="button"
            className="rvi-arrow"
            onClick={() => go(idx - 1)}
            aria-label="Previous slide"
          >
            ‹
          </button>
        ) : (
          <span style={{ width: 46 }} />
        )}
        <div className="rvi-dots" role="tablist" aria-label="Reveal progress">
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={`Slide ${i + 1}`}
              className={`rvi-dot${i === idx ? " on" : ""}`}
              onClick={() => go(i)}
            />
          ))}
        </div>
        {idx < total - 1 ? (
          <button
            type="button"
            className="rvi-arrow"
            onClick={() => go(idx + 1)}
            aria-label="Next slide"
          >
            ›
          </button>
        ) : (
          <span style={{ width: 46 }} />
        )}
      </div>
      {idx === total - 1 && locked && (
        <p className="rvi-sub" style={{ textAlign: "center", marginTop: 10 }}>
          Tap the 🔓 below to unlock
        </p>
      )}
    </section>
  );
}
