"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import UnlockPrice from "./DiscountPrice";

/**
 * "What's included in the full reading?" (Adam, 2026-11-07): the
 * full tier's companion to the basic modal — real screenshots of
 * the reading's sections (captured from the example reading),
 * the features list, and a call to action into the full checkout
 * at the reading's own price.
 */
export default function FullIncludesModal({
  scanId,
  accessToken,
  onUnlockFull,
  onClose,
}: {
  scanId: string;
  accessToken?: string;
  onUnlockFull: () => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const shot: React.CSSProperties = {
    width: "100%",
    display: "block",
    borderRadius: 12,
    border: "1px solid rgba(240, 230, 200, 0.25)",
  };
  const caption: React.CSSProperties = {
    margin: "6px 2px 16px",
    fontSize: "0.92rem",
    opacity: 0.9,
  };
  const tag: React.CSSProperties = {
    display: "inline-block",
    background: "rgba(217, 164, 65, 0.18)",
    border: "1px solid rgba(217, 164, 65, 0.65)",
    color: "#ffd76a",
    borderRadius: 999,
    padding: "1px 9px",
    fontSize: "0.78rem",
    marginLeft: 8,
    verticalAlign: "middle",
  };

  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 130,
        background: "rgba(10, 18, 24, 0.7)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="What's included in the full reading"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#14231f",
          color: "#f3ecd9",
          width: "min(460px, 100%)",
          maxHeight: "88vh",
          overflowY: "auto",
          borderRadius: "18px 18px 0 0",
          padding: "18px 18px calc(18px + env(safe-area-inset-bottom))",
          boxShadow: "0 -12px 40px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <b style={{ fontSize: "1.12rem" }}>What&rsquo;s included in the full reading?</b>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              fontSize: "1.3rem",
              cursor: "pointer",
              padding: "2px 8px",
            }}
          >
            ✕
          </button>
        </div>
        <p style={{ margin: "8px 0 16px", opacity: 0.9 }}>
          The full reading opens <b>everything</b> the reader found:
        </p>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/includes/basic-overview.jpg" alt="The reading overview: the iris illustration with every sign plotted" style={shot} />
        <p style={caption}>
          <b>Overview</b> — your iris with every sign plotted, your reading at a glance,
          and a temperament &amp; inherited-patterns sketch drawn from the scan itself.
        </p>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/includes/basic-findings.jpg" alt="A finding shown in full: the sign, its body area, its band, its stage, and how clearly it was seen" style={shot} />
        <p style={caption}>
          <b>Findings</b>
          <span style={tag}>In Full</span> — every sign the reader found, not just the
          top five, each in full detail.
        </p>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/includes/basic-bodymap.jpg" alt="The body map: front of the body with the areas the reading found" style={shot} />
        <p style={caption}>
          <b>Body Map</b>
          <span style={tag}>In Full</span> — the complete body map, front and back.
        </p>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/includes/full-diet.jpg" alt="Personalized diet recommendations built from the reading" style={shot} />
        <p style={caption}>
          <b>Diet</b>
          <span style={tag}>In Full</span> — diet recommendations matched to your
          constitution and the areas your reading found.
        </p>

        <b style={{ fontSize: "1rem" }}>Also unlocked with Full</b>
        <ul style={{ margin: "8px 0 4px", paddingLeft: 18, display: "grid", gap: 6, lineHeight: 1.45 }}>
          <li>Follow-up scans of these eyes for $1 each, tracked on your Timeline</li>
          <li>Both irises — one unlock covers the pair</li>
          <li>Print or save the full report</li>
          <li>Yours to keep — reopen it anytime in My readings</li>
        </ul>

        <button
          type="button"
          onClick={onUnlockFull}
          style={{
            display: "block",
            width: "100%",
            marginTop: 16,
            background: "#d9a441",
            border: "1px solid #d9a441",
            borderRadius: 12,
            padding: "13px 14px",
            color: "#231a04",
            cursor: "pointer",
            font: "inherit",
            fontWeight: 700,
          }}
        >
          Unlock the full reading —{" "}
          <UnlockPrice scanId={scanId} accessToken={accessToken} followup={false} />
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            display: "block",
            margin: "10px auto 0",
            background: "transparent",
            border: "none",
            color: "inherit",
            opacity: 0.8,
            font: "inherit",
            cursor: "pointer",
            padding: "6px 12px",
          }}
        >
          Not now
        </button>
      </div>
    </div>,
    document.body,
  );
}
