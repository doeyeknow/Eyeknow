"use client";

import { useRef, useState } from "react";
import type { ScanRecord } from "@/lib/chart";
import type { PersonGroup } from "@/lib/person";
import { missingEye } from "@/lib/person";
import UnlockModal from "./UnlockModal";

export type ReadingTab = "overview" | "findings" | "bodymap";

/** My readings — one card per PERSON (Adam, 2026-11-01). A card
 *  shows both irises (or the one that exists), the person's name,
 *  and the person-level unlock state. Tap opens the report;
 *  tap-and-hold (or right-click, or the ⋯ button) opens an action
 *  menu: findings, body map, print report, share, delete. */
export default function ReadingsList({
  persons,
  onOpen,
  onPrint,
  onDeletePerson,
  shareUrlFor,
  onUnlock,
}: {
  persons: PersonGroup[];
  onOpen: (scan: ScanRecord, tab?: ReadingTab) => void;
  onPrint: (scan: ScanRecord) => void;
  onDeletePerson: (person: PersonGroup) => void;
  shareUrlFor: (scan: ScanRecord) => string | null;
  /** Start a basic/full unlock checkout for this person (Adam,
   *  2026-11-06: the card's unlock button). */
  onUnlock: (person: PersonGroup, tier: "basic" | "full") => void;
}) {
  const [menuFor, setMenuFor] = useState<PersonGroup | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [unlockFor, setUnlockFor] = useState<PersonGroup | null>(null);
  const [sharedNote, setSharedNote] = useState<string | null>(null);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const repOf = (p: PersonGroup): ScanRecord => p.scans[0];

  const startPress = (p: PersonGroup) => {
    longPressed.current = false;
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      setConfirming(false);
      setSharedNote(null);
      setMenuFor(p);
    }, 550);
  };
  const endPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  const share = async (p: PersonGroup) => {
    const url = shareUrlFor(repOf(p));
    if (!url) return;
    const title = p.name ? `${p.name}'s eyeKnow reading` : "eyeKnow reading";
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        setMenuFor(null);
        return;
      }
      throw new Error("no native share");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        setSharedNote("Link copied ✓");
      } catch {
        setSharedNote(url);
      }
    }
  };

  const eyeBox = (p: PersonGroup, eye: "right" | "left") => {
    const rep = eye === "right" ? p.right : p.left;
    const label = eye === "right" ? "Right" : "Left";
    if (!rep) {
      return (
        <span className="person-eye missing" key={eye}>
          <span className="person-eye-plus">＋</span>
          <small>
            {label} iris
            <br />
            not scanned
          </small>
        </span>
      );
    }
    return (
      <span className="person-eye" key={eye}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={rep.image} alt={`${label} iris`} />
        <small className="person-eye-label">{label}</small>
      </span>
    );
  };

  return (
    <>
      <div className="person-grid">
        {persons.map((p) => {
          const missing = missingEye(p);
          return (
            <div
              key={p.personId}
              className="person-card"
              role="button"
              tabIndex={0}
              aria-label={`${p.name ?? "Unnamed reading"} — ${p.right && p.left ? "both irises" : "one iris"}, ${p.unlocked ? "unlocked" : "locked"}. Press and hold for actions.`}
              onClick={() => {
                if (longPressed.current) {
                  longPressed.current = false;
                  return;
                }
                onOpen(repOf(p));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") onOpen(repOf(p));
              }}
              onPointerDown={() => startPress(p)}
              onPointerUp={endPress}
              onPointerLeave={endPress}
              onPointerMove={endPress}
              onContextMenu={(e) => {
                e.preventDefault();
                endPress();
                setConfirming(false);
                setSharedNote(null);
                setMenuFor(p);
              }}
            >
              <span className="person-eyes">
                {eyeBox(p, "left")}
                {eyeBox(p, "right")}
              </span>
              {!p.unlocked && (
                <button
                  type="button"
                  className="person-menu-btn"
                  style={{ right: 82 }}
                  aria-label={`Unlock ${p.name ?? "this reading"}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setUnlockFor(p);
                  }}
                >
                  🔓
                </button>
              )}
              <button
                type="button"
                className="person-menu-btn"
                style={{ right: 44 }}
                aria-label={`Delete ${p.name ?? "this reading"}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  // Straight to the delete confirmation — the same
                  // two-step guard the action sheet uses.
                  setConfirming(true);
                  setSharedNote(null);
                  setMenuFor(p);
                }}
              >
                🗑
              </button>
              <button
                type="button"
                className="person-menu-btn"
                aria-label={`Actions for ${p.name ?? "this reading"}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirming(false);
                  setSharedNote(null);
                  setMenuFor(p);
                }}
              >
                ⋯
              </button>
              {p.unlocked ? (
                <span className="scan-badge status unlocked">✓ Unlocked</span>
              ) : (
                <span className="scan-badge status locked">🔒 Locked</span>
              )}
              <span className="scan-card-meta">
                <b>{p.name ?? "Unnamed reading"}</b>
                <small>
                  {new Date(p.latestAt).toLocaleDateString()} · {p.signCount} sign
                  {p.signCount === 1 ? "" : "s"}
                  {missing
                    ? ` · ${missing === "right" ? "Right" : "Left"} iris still to scan`
                    : " · both irises"}
                  {p.scans.length > 2 || (p.scans.length === 2 && !(p.right && p.left))
                    ? ` · ${p.scans.length} scans`
                    : ""}
                </small>
              </span>
            </div>
          );
        })}
      </div>

      {menuFor && (
        <div
          className="action-sheet-backdrop"
          onClick={() => setMenuFor(null)}
          role="presentation"
        >
          <div
            className="action-sheet"
            role="menu"
            aria-label={`Actions for ${menuFor.name ?? "this reading"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="action-sheet-title">
              {menuFor.name ?? "Unnamed reading"}
              <small>
                {menuFor.right && menuFor.left
                  ? "Both irises"
                  : `${menuFor.right ? "Right" : "Left"} iris only`}{" "}
                · {menuFor.unlocked ? "Unlocked" : "Locked"}
              </small>
            </p>
            {confirming ? (
              <>
                <p className="muted" style={{ margin: "4px 2px 10px" }}>
                  Delete this reading? Both irises and every scan in its Timeline are
                  removed. This can't be undone.
                </p>
                <button
                  type="button"
                  className="action-sheet-item danger"
                  onClick={() => {
                    onDeletePerson(menuFor);
                    setMenuFor(null);
                  }}
                >
                  🗑 Delete this reading
                </button>
                <button
                  type="button"
                  className="action-sheet-item"
                  onClick={() => setConfirming(false)}
                >
                  Keep it
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="action-sheet-item"
                  onClick={() => {
                    onOpen(repOf(menuFor), "findings");
                    setMenuFor(null);
                  }}
                >
                  🔍 Findings{menuFor.scans.some((sc) => sc.unlocked || sc.basic) ? "" : " 🔒"}
                </button>
                <button
                  type="button"
                  className="action-sheet-item"
                  onClick={() => {
                    onOpen(repOf(menuFor), "bodymap");
                    setMenuFor(null);
                  }}
                >
                  🗺 Body map{menuFor.scans.some((sc) => sc.unlocked || sc.basic) ? "" : " 🔒"}
                </button>
                {menuFor.scans.some((sc) => sc.unlocked || sc.basic) && (
                  <button
                    type="button"
                    className="action-sheet-item"
                    onClick={() => {
                      onPrint(repOf(menuFor));
                      setMenuFor(null);
                    }}
                  >
                    🖨 Print report
                  </button>
                )}
                {shareUrlFor(repOf(menuFor)) && (
                  <button
                    type="button"
                    className="action-sheet-item"
                    onClick={() => void share(menuFor)}
                  >
                    ↗ Share
                  </button>
                )}
                {sharedNote && <p className="action-sheet-note">{sharedNote}</p>}
                <button
                  type="button"
                  className="action-sheet-item danger"
                  onClick={() => setConfirming(true)}
                >
                  🗑 Delete
                </button>
              </>
            )}
            <button
              type="button"
              className="action-sheet-item cancel"
              onClick={() => setMenuFor(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {unlockFor && (
        <UnlockModal
          name={unlockFor.name}
          scanId={repOf(unlockFor).id}
          accessToken={repOf(unlockFor).accessToken}
          basicPaid={unlockFor.scans.some((sc) => sc.basic)}
          onBasic={() => {
            onUnlock(unlockFor, "basic");
            setUnlockFor(null);
          }}
          onFull={() => {
            onUnlock(unlockFor, "full");
            setUnlockFor(null);
          }}
          onClose={() => setUnlockFor(null)}
        />
      )}
    </>
  );
}
