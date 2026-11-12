"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import UnlockPrice from "./DiscountPrice";
import BasicIncludesModal from "./BasicIncludesModal";
import FullIncludesModal from "./FullIncludesModal";

/**
 * The unlock chooser (Adam, 2026-11-06): pressing unlock anywhere
 * opens this modal — never a swap to inline buttons. Basic, full,
 * or a Timeline subscription; the pick hands off to the real
 * checkout. Portalled to the body so no stacking context (the
 * foreground home scene, the reveal card) can trap it.
 */
export default function UnlockModal({
  name,
  scanId,
  accessToken,
  basicPaid,
  onBasic,
  onFull,
  onClose,
}: {
  name: string | null;
  scanId: string;
  accessToken?: string;
  /** Basic already paid — the basic option drops out. */
  basicPaid?: boolean;
  onBasic: () => void;
  onFull: () => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [showBasicInfo, setShowBasicInfo] = useState(false);
  const [showFullInfo, setShowFullInfo] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const row: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    textAlign: "left",
    background: "rgba(255, 255, 255, 0.06)",
    border: "1px solid rgba(240, 230, 200, 0.25)",
    borderRadius: 12,
    padding: "13px 14px",
    color: "inherit",
    cursor: "pointer",
    font: "inherit",
    marginTop: 10,
  };

  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        background: "rgba(10, 18, 24, 0.66)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Unlock this reading"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#14231f",
          color: "#f3ecd9",
          width: "min(460px, 100%)",
          maxHeight: "86vh",
          overflowY: "auto",
          borderRadius: "18px 18px 0 0",
          padding: "18px 18px calc(18px + env(safe-area-inset-bottom))",
          boxShadow: "0 -12px 40px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <b style={{ fontSize: "1.12rem" }}>Unlock {name ?? "this reading"}</b>
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

        {!basicPaid && (
          <>
          <button type="button" style={row} onClick={onBasic}>
            <span style={{ fontSize: "1.5rem" }}>🔓</span>
            <span>
              <b>Basic reading — $3</b>
              <br />
              <small style={{ opacity: 0.85 }}>
                The 5 most important signs in full, with the complete body map.
              </small>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setShowBasicInfo(true)}
            style={{
              display: "block",
              margin: "8px auto 0",
              background: "transparent",
              border: "none",
              color: "#ffd76a",
              font: "inherit",
              fontSize: "0.92rem",
              cursor: "pointer",
              padding: "4px 8px",
              textDecoration: "underline",
            }}
          >
            What&rsquo;s included in the basic reading?
          </button>
          </>
        )}

        {showBasicInfo && (
          <BasicIncludesModal
            onClose={() => setShowBasicInfo(false)}
            onUnlockBasic={() => {
              setShowBasicInfo(false);
              onBasic();
            }}
          />
        )}

        <>
        <button type="button" style={row} onClick={onFull}>
          <span style={{ fontSize: "1.5rem" }}>🔓</span>
          <span>
            <b>
              Full reading —{" "}
              <UnlockPrice scanId={scanId} accessToken={accessToken} followup={false} />
            </b>
            <br />
            <small style={{ opacity: 0.85 }}>
              Every sign in full, diet recommendations, and the Timeline.
            </small>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setShowFullInfo(true)}
          style={{
            display: "block",
            margin: "8px auto 0",
            background: "transparent",
            border: "none",
            color: "#ffd76a",
            font: "inherit",
            fontSize: "0.92rem",
            cursor: "pointer",
            padding: "4px 8px",
            textDecoration: "underline",
          }}
        >
          What&rsquo;s included in the full reading?
        </button>
        </>

        {showFullInfo && (
          <FullIncludesModal
            scanId={scanId}
            accessToken={accessToken}
            onClose={() => setShowFullInfo(false)}
            onUnlockFull={() => {
              setShowFullInfo(false);
              onFull();
            }}
          />
        )}

        <a
          href="/subscription"
          style={{ ...row, textDecoration: "none", boxSizing: "border-box" }}
        >
          <span style={{ fontSize: "1.5rem" }}>🗓</span>
          <span>
            <b>Timeline subscription — from $149</b>
            <br />
            <small style={{ opacity: 0.85 }}>
              A year or more of scans for both irises, with a monthly human overview.
            </small>
          </span>
        </a>

        <button
          type="button"
          onClick={onClose}
          style={{
            display: "block",
            margin: "14px auto 0",
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
