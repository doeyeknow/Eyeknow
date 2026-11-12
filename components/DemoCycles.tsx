import { useEffect, useRef, useState } from "react";
import IrisIllustration from "./IrisIllustration";
import { HERO_EYE_SRCS, HERO_FILTERS, useHeroColorIndex } from "./heroColor";
import type { ComponentType } from "react";
import type { ScanRecord } from "@/lib/chart";

const DEMO_STAGES: { stage: number; label: string }[] = [
  { stage: 3, label: "Enhancing the image & adjusting contrast" },
  { stage: 0, label: "Locating the pupil" },
  { stage: 1, label: "Tracing the iris edge" },
  { stage: 4, label: "Scanning for nerve rings" },
  { stage: 5, label: "Hunting markings" },
  { stage: 7, label: "Placing signs on the chart" },
  { stage: 9, label: "Printing your report" },
];

/** Homepage hero: an endless, self-running demonstration of the
 *  scanning process using the same animations as a real reading. */
/** "Build your timeline" visual for How it works: a chain of scans
 *  of the same iris with the change summary cycling underneath. */
export function TimelinePreviewCycle() {
  const chips = ["＋ 2 new signs", "− 1 faded", "↑ 1 reading stronger"];
  const [i, setI] = useState(0);
  const eyeIdx = useHeroColorIndex();
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const iv = window.setInterval(() => setI((v) => (v + 1) % chips.length), 2000);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="tl-visual" aria-hidden="true">
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
      <div className="tl-dates">
        <span>Scan 1</span>
        <span>Scan 2</span>
        <span>Scan 3</span>
      </div>
      <div className="tl-chip" key={i}>
        {chips[i]}
      </div>
    </div>
  );
}

/** "Auto-read" mini visual for How it works: the demo iris with the
 *  reading animations cycling (trace → hunt → place the signs). */
export function MiniReadCycle({ StageOverlay }: { StageOverlay: ComponentType<{ stage: number }> }) {
  const visuals = [1, 5, 7];
  const [i, setI] = useState(0);
  const eyeIdx = useHeroColorIndex();
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const iv = window.setInterval(() => setI((v) => (v + 1) % visuals.length), 1500);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="mini-read" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={HERO_EYE_SRCS[eyeIdx]} alt="" />
      <svg className="reading-base-rings" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="17" />
        <circle cx="50" cy="50" r="31" />
        <circle cx="50" cy="50" r="45" />
      </svg>
      <StageOverlay key={i} stage={visuals[i]} />
    </div>
  );
}

const RP_VIEWS = ["Overview", "Body Map", "Findings", "Diet", "Timeline", "Notes"] as const;

/** Report preview for How it works: cycles the report's five views
 *  as little mock screens so visitors see what they'll get. */
export function ReportPreviewCycle() {
  const [i, setI] = useState(0);
  const eyeIdx = useHeroColorIndex();
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const iv = window.setInterval(() => setI((v) => (v + 1) % RP_VIEWS.length), 2300);
    return () => window.clearInterval(iv);
  }, []);
  const view = RP_VIEWS[i];
  return (
    <div className="report-preview" aria-hidden="true">
      <div className="rp-tabs">
        {RP_VIEWS.map((v) => (
          <span key={v} className={v === view ? "on" : ""}>
            {v}
          </span>
        ))}
      </div>
      <div className="rp-body" key={view}>
        {view === "Overview" && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="rp-iris" src={HERO_EYE_SRCS[eyeIdx]} alt="" />
            <div className="rp-lines">
              <b>Hematogenic constitution</b>
              <span />
              <span />
            </div>
          </>
        )}
        {view === "Body Map" && (
          <>
            <svg className="rp-bodyfig" viewBox="0 0 40 92">
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
        )}
        {view === "Findings" && (
          <div className="rp-lines wide">
            {[
              ["#6d28a8", "Lacuna — 2 o'clock"],
              ["#b3541e", "Pigment — 7 o'clock"],
              ["#1f6fb2", "Radii solaris — 11 o'clock"],
            ].map(([c, label]) => (
              <div className="rp-row" key={label}>
                <i className="rp-dot" style={{ background: c }} />
                <b>{label}</b>
              </div>
            ))}
          </div>
        )}
        {view === "Diet" && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="rp-diet" src="/diet/spread.jpg" alt="" />
            <div className="rp-lines">
              <b>Foods for your areas</b>
              <span />
              <span />
            </div>
          </>
        )}
        {view === "Timeline" && (
          <div className="rp-lines wide">
            <b>Timeline — changes over time</b>
            <div className="rp-row">
              <i className="rp-dot" style={{ background: "#d9a441" }} />
              <b>First scan — 15 signs</b>
            </div>
            <div className="rp-row">
              <i className="rp-dot" style={{ background: "#1e8a6e" }} />
              <b>Follow-up — 2 new · 1 faded</b>
            </div>
          </div>
        )}
        {view === "Notes" && (
          <div className="rp-lines wide">
            <b>Your notes & next steps</b>
            <span />
            <span />
            <span />
          </div>
        )}
      </div>
      <div className="rp-dots">
        {RP_VIEWS.map((v, di) => (
          <i key={v} className={di === i ? "on" : ""} />
        ))}
      </div>
    </div>
  );
}

export function ScanDemo({
  StageOverlay,
  personalScan = null,
}: {
  StageOverlay: ComponentType<{ stage: number }>;
  /** The visitor's first scan, once they have one: its illustration
   *  becomes the hero eye (Adam, 2026-11-05). */
  personalScan?: Pick<ScanRecord, "id" | "eye" | "color" | "markers" | "profile" | "image"> | null;
}) {
  const eyeIdx = useHeroColorIndex();
  // The hero eye no longer follows the user's touch (Adam,
  // 2026-11-05: "remove the tracking of the hero pupil") — it
  // sits still; only the small logo eyes keep the gaze.
  const [demoStep, setDemoStep] = useState(0);
  const [tick, setTick] = useState(0);
  const current = DEMO_STAGES[demoStep];
  useEffect(() => {
    // The finale (printing) lingers a little longer than the rest.
    const delay = current.stage === 9 ? 2500 : 1600;
    const t = window.setTimeout(() => {
      if (!document.hidden) setDemoStep((s) => (s + 1) % DEMO_STAGES.length);
      setTick((x) => x + 1);
    }, delay);
    return () => window.clearTimeout(t);
  }, [tick, demoStep, current.stage]);
  // Zoom in for the pupil step and STAY zoomed through the reading
  // steps; the finale zooms all the way back out for the printout.
  const zoomed = current.stage !== 3 && current.stage !== 9;
  return (
    <div className="scan-demo">
      <div className="scan-demo-visual" aria-hidden="true">
        <div className={`scan-demo-zoom${zoomed ? " zoomed" : ""}`}>
          <div className="scan-demo-gaze">
            {personalScan ? (
              <div className="scan-demo-personal" style={{ filter: HERO_FILTERS[eyeIdx] }}>
                <IrisIllustration scan={personalScan} bare />
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={HERO_EYE_SRCS[eyeIdx]} alt="" className={current.stage === 3 ? "enhancing" : ""} />
            )}
            <svg className="reading-base-rings" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="17" />
              <circle cx="50" cy="50" r="31" />
              <circle cx="50" cy="50" r="45" />
            </svg>
            <StageOverlay key={current.stage} stage={current.stage} />
          </div>
        </div>
      </div>
      <span className="scan-demo-live" key={current.stage}>
        {current.label}
      </span>
      <span className="sr-only">{current.label}</span>
      <div className="scan-demo-dots" aria-hidden="true">
        {DEMO_STAGES.map((d, i) => (
          <span key={d.stage} className={i === demoStep ? "on" : ""} />
        ))}
      </div>
    </div>
  );
}
