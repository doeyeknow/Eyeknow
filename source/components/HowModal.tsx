"use client";

import HowItWasMade from "./HowItWasMade";

// One modal for the bottom bar's "How it works": how the app works
// AND how it was made (Adam, 2026-11-05 — the standalone homepage
// section is gone; this is its home now).
export default function HowModal({
  open,
  onClose,
  onExample,
}: {
  open: boolean;
  onClose: () => void;
  onExample: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="modal-backdrop no-print"
      role="dialog"
      aria-modal="true"
      aria-label="How eyeKnow works and how it was made"
      onClick={onClose}
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 className="modal-title" style={{ marginTop: 0 }}>
          How it works
        </h2>
        <ol className="how-modal-steps">
          <li>
            <b>Photograph.</b> Use your camera (or upload a close-up) — a guide helps you
            fill the frame with one eye, lit evenly.
          </li>
          <li>
            <b>Auto-read.</b> The app finds your pupil and iris edge, unrolls the iris onto
            the traditional chart, and measures the classic signs — dark patches, pigment,
            furrows, rings, cloudiness, fiber texture. Dark irises get an automatic contrast
            boost first, so their fibers read properly.
          </li>
          <li>
            <b>Read your report.</b> Your report explains, zone by zone, what the traditional
            chart associates with each sign found, and how clearly each was defined, plus your
            constitution type — across six views: Overview, Body Map, Findings, Diet,
            Timeline, and Notes. Save it, print it, or compare with your next scan.
          </li>
          <li>
            <b>Build your timeline.</b> Follow your report's recommendations, then rescan the
            same iris — once your reading is unlocked, follow-up scans are just $1. Each new
            scan is compared with the last automatically, so you can observe the traditional
            signs change as you follow the recommendations.
          </li>
        </ol>
        <button type="button" className="btn" onClick={onExample}>
          📖 See an example full reading
        </button>
        <h2 className="modal-title" style={{ marginTop: 28 }}>
          How this app was made
        </h2>
        <p className="muted">
          Every eyeKnow report is mapped against this traditional iridology chart — the
          named areas for the left and right iris, the stomach and bowel ring at the
          center, and the skin/lymph ring at the edge. Your findings use the chart's own
          area names.
        </p>
        <HowItWasMade />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="chart-img"
          src="/iridology-chart.jpg"
          alt="Traditional iridology chart showing the left and right iris with named body areas"
          loading="lazy"
        />
        <div className="disclaimer-card">
          <b>An honest note:</b> iridology is a traditional practice. An eyeKnow report
          presents what the traditional chart associates with the features measured on your
          iris — it is not a medical diagnosis and is not a substitute for professional
          medical advice. The automatic reader is pattern-spotting, not a trained medical
          AI, and faint signs can be missed — especially in poor light. Scans are stored
          on this device, or in your account when you're signed in.
        </div>
      </div>
    </div>
  );
}
