"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * "What's included in the basic reading?" (Adam, 2026-11-07):
 * a visual answer — real screenshots of the reading's sections
 * (captured from the example reading) plus the list of what the
 * $3 basic unlock opens. Opened from the unlock chooser's Basic
 * row; its call to action hands off to the same basic checkout.
 */
export default function BasicIncludesModal({
  onUnlockBasic,
  onClose,
}: {
  onUnlockBasic: () => void;
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
        aria-label="What's included in the basic reading"
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
          <b style={{ fontSize: "1.12rem" }}>What&rsquo;s included in the basic reading?</b>
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
          The basic reading is <b>$3, one-time</b>. Here is the reading it opens:
        </p>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/includes/basic-overview.jpg" alt="The reading overview: the iris illustration with every sign plotted" style={shot} />
        <p style={caption}>
          <b>Overview</b> — your iris, with every sign the reader found plotted on it.
        </p>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/includes/basic-findings.jpg" alt="A finding shown in full: the sign, its body area, its band, its stage, and how clearly it was seen" style={shot} />
        <p style={caption}>
          <b>Findings</b>
          <span style={tag}>In Basic</span> — your 5 most important signs, each in full:
          where it sits, its band, its stage, and how clearly it was seen.
        </p>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/includes/basic-bodymap.jpg" alt="The body map: front of the body with the areas the reading found" style={shot} />
        <p style={caption}>
          <b>Body Map</b>
          <span style={tag}>In Basic</span> — the complete body map, front and back,
          showing where each sign lands.
        </p>

        <b style={{ fontSize: "1rem" }}>Also unlocked with Basic</b>
        <ul style={{ margin: "8px 0 4px", paddingLeft: 18, display: "grid", gap: 6, lineHeight: 1.45 }}>
          <li>Both irises — one unlock covers the pair</li>
          <li>Print or save your report</li>
          <li>Yours to keep — reopen it anytime in My readings</li>
        </ul>

        <p style={{ margin: "12px 0 0", fontSize: "0.9rem", opacity: 0.8 }}>
          The full reading adds every sign in full, diet recommendations,
          temperament &amp; inherited patterns, and $1 follow-up scans.
        </p>

        <button
          type="button"
          onClick={onUnlockBasic}
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
          Unlock the basic reading — $3
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
