"use client";

import type { ComponentType } from "react";
import type { ScanRecord } from "@/lib/chart";

// The post-purchase "deeper reading" overlay: after a checkout
// return verifies as unlocked, this sequence plays over the
// already-open full report, then closes. Extracted from IrisApp
// (2026-11-05) to keep that file under the deploy size cap.
export default function PurchaseReveal({
  scan,
  stage,
  StageOverlay,
  onSkip,
}: {
  scan: ScanRecord;
  stage: number;
  StageOverlay: ComponentType<{ stage: number }>;
  onSkip: () => void;
}) {
          const stages = [
            { label: "Payment confirmed — full reading unlocked", visual: 7 },
            { label: "Re-scanning all 12 chart sectors at full depth…", visual: 1 },
            {
              label: `Reading all ${scan.markers.length} signs in full detail…`,
              visual: 5,
            },
            { label: "Cross-checking fibers, rings & zones…", visual: 6 },
            { label: "Building your personalized diet recommendations…", visual: 8 },
            { label: "Printing your complete report…", visual: 9 },
          ];
          const cur = Math.min(stage, stages.length - 1);
          return (
            <div className="reveal-overlay no-print" role="dialog" aria-modal="true" aria-label="Preparing your full reading">
              <div className="reveal-card">
                <p className="report-brand">eyeKnow · Full reading unlocked ✓</p>
                <h2 className="reveal-title">Going deeper into your reading</h2>
                <div className="reading-visual" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={scan.image} alt="" />
                  <svg className="reading-base-rings" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="17" />
                    <circle cx="50" cy="50" r="31" />
                    <circle cx="50" cy="50" r="45" />
                  </svg>
                  <StageOverlay key={cur} stage={stages[cur].visual} />
                </div>
                <ol className="reading-steps reveal-steps">
                  {stages.map((s, i) => {
                    const state =
                      i < stage ? "done" : i === stage ? "active" : "pending";
                    return (
                      <li key={s.label} className={`rstep ${state}`}>
                        <span className="rstep-icon" aria-hidden="true">
                          {state === "done" ? "✓" : state === "active" ? "" : "·"}
                        </span>
                        <span>{s.label}</span>
                      </li>
                    );
                  })}
                </ol>
                {stage >= stages.length ? (
                  <p className="reveal-ready">Your full reading is ready ✓</p>
                ) : (
                  <button type="button" className="btn textlike" onClick={onSkip}>
                    Skip →
                  </button>
                )}
              </div>
            </div>
  );
}
