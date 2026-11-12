"use client";

import { useEffect, useRef, useState } from "react";
import BodyMap from "./BodyMap";
import UnlockRemindButton from "./UnlockRemindButton";
import ShareButtons from "./ShareButtons";
import IrisIllustration from "./IrisIllustration";
import IrisFlip from "./IrisFlip";
import AffPrice from "./AffiliatePrice";
import UnlockPrice from "./DiscountPrice";
import SignGuideModal from "./SignGuide";
import { buildDiet } from "@/lib/diet";
import QRCode from "qrcode";
import { withReferral } from "./ReferralCapture";
import {
  BODY_REGION_LABELS,
  CONSTITUTIONS,
  SIGN_COLORS,
  SIGNS,
  TONES,
  ZONES,
  bodyRegionFor,
  buildFindings,
  chartAreaFor,
  constitutionGradeText,
  familyLine,
  generalNotes,
  LACUNA_FORM_LABEL,
  inheritedFindings,
  sectorsForRegion,
  systemSummary,
  temperamentLines,
  toneIsActive,
  wholeIrisNotes,
  zoneSummary,
  type BodyRegion,
  type ScanRecord,
  type SignId,
  type ToneId,
} from "@/lib/chart";
import { compareScans, markerPlace } from "@/lib/compare";
import { RegionBadge, RegionHero, SignBadges } from "./RegionBadge";
import { SECTION_ICONS } from "./CoverCards";
import SubscriptionOffer from "./SubscriptionOffer";
import PlotPhoto from "./PlotPhoto";

/** Report tabs are icons, not text (Adam's direction): one section
 *  icon per tab, the same set as the "What the report covers" cards.
 *  Labels survive as aria-label/title and in the app top bar. */
const TAB_ICONS: Record<TabId, keyof typeof SECTION_ICONS> = {
  overview: "overview",
  bodymap: "bodymap",
  findings: "findings",
  diet: "diet",
  timeline: "timeline",
  notes: "notes",
};

type TabId = "overview" | "bodymap" | "findings" | "diet" | "timeline" | "notes";

/** Sign-description text for the body map and Findings: no clock
 *  positions and no confidence sentence — the badges show the body
 *  part, zone, and confidence level instead. */
function cleanBody(body: string): string {
  return body
    .replace(
      /^On the chart, the \d+ o'clock position in this band is ([^.]+)\./,
      "This is the $1 area of this band.",
    )
    .replace(/\s*The automatic reader found[^.]*\./, "");
}

/** Free preview shows the 5 most important signs (strongest first). */
export const PREVIEW_COUNT = 5;

export function previewScan(scan: ScanRecord): ScanRecord {
  const weight = (c?: string) => (c === "strong" ? 3 : c === "moderate" ? 2 : c === "light" ? 1 : 0);
  const markers = scan.markers
    .map((m, i) => ({ m, i }))
    .sort((a, b) => weight(b.m.confidence) - weight(a.m.confidence) || a.i - b.i)
    .slice(0, PREVIEW_COUNT)
    .sort((a, b) => a.i - b.i)
    .map(({ m }) => m);
  return { ...scan, markers };
}

type Modal = { kind: "region"; region: BodyRegion } | { kind: "sector"; sector: number } | null;

// ── Iris section highlighting for the details pop-up ──────────────
// The stored scan is a square crop of side ≈ 2.7 × iris radius
// centered on the iris, so on a 100-unit overlay the iris edge sits
// at r=37. Zone radii follow the chart bands the reader uses.
const IRIS_R = 37;
const ZONE_RADII: Record<string, [number, number]> = {
  inner: [9, 14.1], // bowel ring visual band
  middle: [14.1, 27.8],
  outer: [27.8, IRIS_R],
  organ: [14.1, IRIS_R], // organ band (middle + outer) when no markers
  bowelring: [9, 16.7],
};

/** Preview teaser: keep a finding body's first two sentences. */
function shortenBody(body: string): string {
  const sentences = body.match(/[^.!?]+[.!?]+/g);
  if (!sentences || sentences.length <= 2) return body;
  return `${sentences.slice(0, 2).join(" ").trim()} …`;
}

function polar(cx: number, cy: number, r: number, clockDeg: number): [number, number] {
  const rad = (clockDeg * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
}

/** Annulus wedge path between radii r1..r2 across a clock-angle span. */
function wedgePath(r1: number, r2: number, a0: number, a1: number): string {
  const [x0, y0] = polar(50, 50, r2, a0);
  const [x1, y1] = polar(50, 50, r2, a1);
  const [x2, y2] = polar(50, 50, r1, a1);
  const [x3, y3] = polar(50, 50, r1, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r2} ${r2} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r1} ${r1} 0 ${large} 0 ${x3} ${y3} Z`;
}

/** Full ring (for the bowel, which circles the pupil). */
function ringPath(r1: number, r2: number): string {

  return (
    `M 50 ${50 - r2} A ${r2} ${r2} 0 1 1 50 ${50 + r2} A ${r2} ${r2} 0 1 1 50 ${50 - r2} Z ` +
    `M 50 ${50 - r1} A ${r1} ${r1} 0 1 0 50 ${50 + r1} A ${r1} ${r1} 0 1 0 50 ${50 - r1} Z`
  );
}

function sectorCenterDeg(sector: number): number {
  return (sector % 12) * 30;
}

export default function ReportView({
  scan: fullScan,
  onBack,
  onDelete,
  locked = false,
  basic = false,
  onUnlock,
  onUnlockBasic,
  unlockBusy = false,
  unlockNote = null,
  onExample,
  onGift,
  tab: controlledTab,
  onTabChange,
  shareUrl = null,
  example = false,
  chain,
  onRescan,
  onOpenScan,
  followupPrice = false,
  personName = null,
  onRenamePerson,
  personReps,
  otherEyeMissing = null,
  onScanOtherEye,
}: {
  scan: ScanRecord;
  onBack?: () => void;
  onDelete?: (id: string) => void;
  /** When locked, only the 5 most important signs are shown and the
   *  diet section is replaced by the unlock offer. */
  locked?: boolean;
  /** The $3 basic tier (Adam, 2026-11-05): the top signs are shown
   *  in FULL (no shortening, stage/shape notes kept) while the rest
   *  of the full reading stays locked. Only meaningful when locked. */
  basic?: boolean;
  onUnlock?: () => void;
  onUnlockBasic?: () => void;
  unlockBusy?: boolean;
  unlockNote?: string | null;
  /** Opens the built-in example of a full reading (purchase panel). */
  onExample?: () => void;
  /** Opens the gift-a-reading flow (purchase panel). */
  onGift?: () => void;
  /** Controlled tab (the app top bar mirrors and drives it). */
  tab?: TabId;
  onTabChange?: (t: TabId) => void;
  /** Link back to this exact reading (printed-report QR code).
   *  Only set when the reading lives in the viewer's account. */
  shareUrl?: string | null;
  /** True for the built-in example reading (no print/save PDF). */
  example?: boolean;
  /** Timeline chain (oldest → newest), including this scan. */
  chain?: ScanRecord[];
  /** Starts a follow-up rescan of this iris (Timeline tab). */
  onRescan?: () => void;
  /** Opens another reading from the Timeline chain. */
  onOpenScan?: (scan: ScanRecord) => void;
  /** True when this follow-up unlocks at the $1 Timeline price. */
  followupPrice?: boolean;
  /** The person this reading belongs to — one person is one
   *  reading, both irises together (Adam, 2026-11-01). */
  personName?: string | null;
  /** Save a new name for the person (rides on all their scans). */
  onRenamePerson?: (name: string) => void;
  /** The person's representative scans, newest per eye (≤2). */
  personReps?: ScanRecord[];
  /** The eye this person has not scanned yet, if exactly one. */
  otherEyeMissing?: "right" | "left" | null;
  /** Start the scan for that other iris. */
  onScanOtherEye?: () => void;
}) {
  // Findings read clearest-first: the display copy of the scan has
  // its markers sorted by reader confidence (strong → moderate →
  // light; stable within a level), so the Findings list and the
  // body-map pop-up share one order — the order the reader was
  // most sure about, first.
  const confRank = (c?: string) =>
    c === "strong" ? 3 : c === "moderate" ? 2 : c === "light" ? 1 : 0;
  const baseScan = locked ? previewScan(fullScan) : fullScan;
  const scan: ScanRecord = {
    ...baseScan,
    markers: [...baseScan.markers].sort(
      (a, b) => confRank(b.confidence) - confRank(a.confidence),
    ),
  };
  // The illustration draws EVERY sign the reader found (from
  // fullScan), while the written details stay limited to the
  // preview's five — Adam's standing rule, carried over from the
  // plotted photo the illustration replaced.
  const allFindings = buildFindings(scan);
  // No duplicate findings (Adam, 2026-11-03): the same marking in
  // the same body area and the same band is ONE finding, however
  // many markers the reader placed there. The list is already
  // sorted clearest-first, so the first of each kind is the one
  // kept. Plotted points, sign counts, and the body map still
  // reflect every marker — only the written list is deduplicated.
  const markerById = new Map(scan.markers.map((m) => [m.id, m]));
  const seenKinds = new Set<string>();
  const rawFindings = allFindings.filter((f) => {
    const m = markerById.get(f.markerId);
    if (!m) return true;
    const key = `${m.sign}|${bodyRegionFor(scan.eye, m)}|${m.zone}`;
    if (seenKinds.has(key)) return false;
    seenKinds.add(key);
    return true;
  });
  // Free preview: each sign's description is shortened to its first
  // two sentences (where it is + what the sign traditionally means);
  // the zone explanation and reader-confidence note are part of the
  // full reading.
  const findings = locked && !basic
    ? rawFindings.map((f) => ({ ...f, body: shortenBody(f.body), stageNote: undefined, shapeNote: undefined }))
    : rawFindings;
  const zones = zoneSummary(scan);
  const notes = generalNotes(scan);
  // Personalize the reading's framing with the person's name when
  // one is set (Adam, 2026-11-06): headings and intros read
  // "Adam's signs", "Adam's constitution", and so on.
  const poss = personName
    ? personName.trim().endsWith("s")
      ? `${personName.trim()}\u2019`
      : `${personName.trim()}\u2019s`
    : null;
  const diet = locked ? [] : buildDiet(fullScan);
  // A food photo for each diet section, matched to its theme.
  const dietImage = (title: string): string => {
    const t = title.toLowerCase();
    if (t.includes("lymphatic")) return "/diet/citrus.jpg";
    if (t.includes("hematogenic")) return "/diet/berries.jpg";
    if (t.includes("biliary")) return "/diet/spread.jpg";
    if (t.includes("bowel") || t.includes("stomach") || t.includes("liver") || t.includes("spine"))
      return "/diet/greens.jpg";
    if (t.includes("spleen") || t.includes("heart") || t.includes("sign patterns"))
      return "/diet/berries.jpg";
    if (t.includes("kidney") || t.includes("lungs") || t.includes("throat") || t.includes("skin"))
      return "/diet/citrus.jpg";
    return "/diet/spread.jpg";
  };

  const constitution = CONSTITUTIONS[scan.color];

  // Colour-stage enrichment (Williams / Jensen / Liljequist): tones
  // sampled at each sign, whole-iris profile measures, the inherited
  // pattern, and the pattern by body system. Full-reading content —
  // shown once unlocked (the example reading shows it in full).
  const tonedMarkers = fullScan.markers.filter((m) => m.tone);
  const stageCounts: Array<{ tone: ToneId; count: number }> = (
    ["white", "yellow", "orange", "brown", "deep"] as ToneId[]
  )
    .map((tone) => ({ tone, count: tonedMarkers.filter((m) => m.tone === tone).length }))
    .filter((s) => s.count > 0);
  const dominantStage =
    stageCounts.length > 0
      ? stageCounts.reduce((a, b) => (b.count > a.count ? b : a))
      : null;
  const irisNotes = wholeIrisNotes(fullScan);
  const gradeText = fullScan.profile
    ? constitutionGradeText(fullScan.profile.constitutionGrade)
    : null;
  const inherited = inheritedFindings(fullScan);
  const temperament = temperamentLines(fullScan);
  const inheritedCount =
    inherited.lacunae.length + inherited.settlements.length + inherited.deposits.length;
  const systems = systemSummary(fullScan);
  const showEnrichment = !locked && (tonedMarkers.length > 0 || fullScan.profile != null);

  // "At a glance": the whole reading in a few plain-language lines,
  // at the top of the Overview so the detail below is easy to follow.
  const glance: string[] = [];
  {
    const plain: Record<ScanRecord["color"], string> = {
      blue: "the type the tradition links with the lymph system, the skin, and elimination",
      brown: "the type the tradition links with the blood, the liver, and digestion",
      mixed: "a blend of the two — the tradition links it with the liver, the gallbladder, and the lymph together",
    };
    glance.push(
      `Your iris is the ${constitution.label.split(" (")[0].toLowerCase()} — ${plain[scan.color]}.`,
    );
    const top = scan.markers[0];
    if (top) {
      const area = chartAreaFor(scan.eye, top.sector, top.zone);
      glance.push(
        `The clearest sign the reader found is a ${SIGNS[top.sign].label.toLowerCase()} in the ${area.label.toLowerCase()} area${top.tone ? `, reading at the ${TONES[top.tone].stage.toLowerCase()} stage` : ""}.`,
      );
    }
    if (zones.length > 0) {
      const z = zones[0];
      glance.push(
        `Most of your signs (${z.count} of them) sit in the ${ZONES[z.zone].label.toLowerCase()} — ${ZONES[z.zone].traditional}.`,
      );
    }
    const scanTones = scan.markers.filter((m) => m.tone);
    if (scanTones.length > 0) {
      const counts = new Map<ToneId, number>();
      for (const m of scanTones) counts.set(m.tone as ToneId, (counts.get(m.tone as ToneId) ?? 0) + 1);
      const topTone = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const meaning =
        topTone === "white"
          ? "things are active and over-working right now"
          : topTone === "yellow"
            ? "things are settling and running a little under par"
            : topTone === "deep"
              ? "the longest-standing, most settled kind of pattern"
              : "a pattern that has settled in over time, not a recent one";
      glance.push(
        `Taken together, your signs mostly read at the ${TONES[topTone].stage.toLowerCase()} stage — in plain terms, ${meaning}.`,
      );
    }
  }

  // The full purchase section (Adam's wording, from the Findings
  // paywall) — shown at the bottom of every tab while locked.
  // The price shown is the visitor's affiliate price when referred
  // (display-only; checkout charges the server-stored price).
  const purchaseSection = locked ? (
    basic ? (
      <div className="paywall no-print">
        <h2>Your basic reading is unlocked ✓</h2>
        <p>
          You&rsquo;re reading your <b>{PREVIEW_COUNT} most important signs in
          full</b> — complete descriptions, colour stages and shapes, with the
          body map. The <b>full reading</b> adds all {fullScan.markers.length}{" "}
          signs, personalized diet recommendations, your temperament and
          inherited patterns, and the <b>Timeline</b> — rescan anytime, and
          every follow-up scan unlocks for just <b>$1</b>.
        </p>
        <button type="button" className="btn big" onClick={onUnlock} disabled={unlockBusy}>
          {unlockBusy ? "Opening checkout…" : <>Unlock the full reading — <UnlockPrice scanId={scan.id} accessToken={scan.accessToken} followup={followupPrice} /></>}
        </button>
        <p className="muted" style={{ marginBottom: 0 }}>
          One-time payment. Your basic reading stays yours either way.
        </p>
        {unlockNote && <p className="paywall-note">{unlockNote}</p>}
      </div>
    ) : (
<div className="paywall no-print">
            {followupPrice ? (
              <h2>Unlock the full reading — <UnlockPrice scanId={scan.id} accessToken={scan.accessToken} followup={followupPrice} /></h2>
            ) : (
              <h2>Unlock the basic reading — $3</h2>
            )}
            {followupPrice ? (
              <p>
                This free preview shows the <b>{PREVIEW_COUNT} most important signs</b> from your
                scan, with shortened descriptions. The full reading includes{" "}
                <b>all {fullScan.markers.length} signs with their full descriptions</b>, the
                complete body map, and <b>personalized diet recommendations</b> built from your
                constitution and the areas your reading highlights. Unlocking also opens the{" "}
                <b>Timeline</b> for this iris — rescan it anytime and see what changed, and
                every follow-up scan unlocks for just <b>$1</b>.
              </p>
            ) : (
              <p>
                This free preview shows the <b>{PREVIEW_COUNT} most important signs</b> from
                your scan, with shortened descriptions.
              </p>
            )}
            {followupPrice && (
              <p>
                <b>Follow-up price:</b> this scan builds on a reading you already unlocked,
                so the full follow-up — including its Timeline change comparison — is just $1.
              </p>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="diet-banner" src="/diet/spread.jpg" alt="A spread of fresh vegetables, fruits, and herbs" loading="lazy" />
            {!followupPrice && !basic && onUnlockBasic && (
              <>
                <p>
                  <b>Start with the basic reading — $3.</b> It opens {poss ?? "your"}{" "}
                  {PREVIEW_COUNT} most important signs <b>in full</b> — complete
                  descriptions, colour stages and sign shapes — with the{" "}
                  <b>complete body map</b>. One unlock covers <b>both irises</b> of
                  this person, so the other eye&rsquo;s basic reading is included too.
                </p>
                <button type="button" className="btn big" onClick={onUnlockBasic} disabled={unlockBusy}>
                  {unlockBusy ? "Opening checkout…" : "Unlock the basic reading — $3"}
                </button>
                <button type="button" className="btn ghost" onClick={onUnlock} disabled={unlockBusy} style={{ marginTop: 10 }}>
                  {unlockBusy ? "Opening checkout…" : <>Or unlock the full reading — <UnlockPrice scanId={scan.id} accessToken={scan.accessToken} followup={followupPrice} /></>}
                </button>
                <p className="muted" style={{ margin: "8px 0 0" }}>
                  The full reading adds all {fullScan.markers.length} signs,
                  personalized diet recommendations, temperament and inherited
                  patterns, and the Timeline — and a full unlock also includes{" "}
                  <b>10 free basic readings to share</b> with friends and family.
                </p>
              </>
            )}
            {(followupPrice || basic || !onUnlockBasic) && (
              <button type="button" className="btn big" onClick={onUnlock} disabled={unlockBusy}>
                {unlockBusy ? "Opening checkout…" : <>Unlock full reading — <UnlockPrice scanId={scan.id} accessToken={scan.accessToken} followup={followupPrice} /></>}
              </button>
            )}
            {onExample && (
              <div style={{ marginTop: 10 }}>
                <button type="button" className="btn ghost" onClick={onExample}>
                  📖 See an example full reading
                </button>
              </div>
            )}
            {onGift && (
              <div style={{ marginTop: 10 }}>
                <button type="button" className="btn ghost" onClick={onGift}>
                  🎁 Or gift a reading to someone — <AffPrice />
                </button>
              </div>
            )}
            <UnlockRemindButton scanId={scan.id} />
            <p className="muted" style={{ marginBottom: 0 }}>
              One-time payment for this reading. It stays unlocked in your account on any
              device.
            </p>
            {unlockNote && <p className="paywall-note">{unlockNote}</p>}
          </div>
    )
  ) : null;
  const [activeRegion, setActiveRegion] = useState<BodyRegion | null>(null);
  const [internalTab, setInternalTab] = useState<TabId>("overview");
  const tab = controlledTab ?? internalTab;
  const setTab = (t: TabId) => {
    if (onTabChange) onTabChange(t);
    else setInternalTab(t);
  };
  // The Timeline tab is on every report: locked readings get the
  // explainer (unlock to open the timeline + $1 follow-up scans);
  // unlocked readings get the working timeline.
  const showTimeline = true;
  const activeTab: TabId = tab;
  const tabList: Array<readonly [TabId, string]> = [
    ["overview", "Overview"],
    ["findings", "Findings"],
    ["bodymap", "Body Map"],
    ["diet", locked ? "Diet 🔒" : "Diet"],
    ...(showTimeline ? [["timeline", "Timeline"] as const] : []),
    ["notes", "Notes"],
  ];
  const fmtDate = (ts: number) =>
    new Date(ts).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  // Timeline chain + this scan's change comparison vs its predecessor.
  const chainList: ScanRecord[] = chain && chain.length > 0 ? chain : [scan];
  let prevScan: ScanRecord | undefined = scan.prevId
    ? chainList.find((s) => s.id === scan.prevId)
    : undefined;
  if (!prevScan) {
    const myIdx = chainList.findIndex((s) => s.id === scan.id);
    if (myIdx > 0) prevScan = chainList[myIdx - 1];
  }
  const comparison = prevScan ? compareScans(prevScan, scan) : null;
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(shareUrl);
  useEffect(() => {
    if (!shareUrl) return;
    let live = true;
    // The printed link carries the viewer's affiliate attribution,
    // like every other share link: whoever scans it lands with the
    // affiliate cookie set and the affiliate's pricing in effect.
    const url = withReferral(shareUrl);
    setQrUrl(url);
    QRCode.toDataURL(url, { width: 264, margin: 1 })
      .then((u) => {
        if (live) setQrData(u);
      })
      .catch(() => undefined);

  return () => {
      live = false;
    };
  }, [shareUrl]);
  const [modal, setModal] = useState<Modal>(null);
  const [signGuide, setSignGuide] = useState<SignId | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Person state (both irises, one reading): the other eye's
  // representative scan and name editing.
  const sibling: ScanRecord | undefined = personReps?.find((s) => s.eye !== fullScan.eye);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const siblingScan: ScanRecord | null = sibling
    ? locked
      ? previewScan(sibling)
      : sibling
    : null;
  const siblingFindings = siblingScan
    ? buildFindings(siblingScan).map((f) =>
        locked && !basic ? { ...f, body: shortenBody(f.body), stageNote: undefined, shapeNote: undefined } : f,
      )
    : [];
  const markerOf = new Map(scan.markers.map((m) => [m.id, m]));
  const date = new Date(scan.createdAt).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  /** Clicking a body section pops up that area's details. */
  function openRegion(region: BodyRegion) {
    setActiveRegion(region);
    setModal({ kind: "region", region });
  }

  /** Clicking a finding pops up its chart sector's details. */
  function openSector(sector: number) {
    const m = scan.markers.find((mk) => mk.sector === sector);
    if (m) setActiveRegion(bodyRegionFor(scan.eye, m));
    setModal({ kind: "sector", sector });
  }

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [modal]);

  // "Swipe the body to see the back" toast — shown briefly each
  // time the Body Map tab is opened (Adam, 2026-11-02).
  const [bmToast, setBmToast] = useState(false);
  useEffect(() => {
    if (activeTab !== "bodymap") return;
    setBmToast(true);
    const t = window.setTimeout(() => setBmToast(false), 4200);
    return () => window.clearTimeout(t);
  }, [activeTab]);

  // Switching tabs in a reading returns to the top of the page
  // (Adam, 2026-11-05) — tab bar, top-bar next button, and in-report
  // jump buttons all land here.
  const prevTabRef = useRef(activeTab);
  useEffect(() => {
    if (prevTabRef.current === activeTab) return;
    prevTabRef.current = activeTab;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab]);

  const modalFindings =
    modal == null
      ? []
      : modal.kind === "region"
        ? findings.filter((f) => {
            const m = markerOf.get(f.markerId);
            return m ? bodyRegionFor(scan.eye, m) === modal.region : false;
          })
        : findings.filter((f) => markerOf.get(f.markerId)?.sector === modal.sector);
  const modalMarkers =
    modal == null
      ? []
      : modal.kind === "region"
        ? scan.markers.filter((m) => bodyRegionFor(scan.eye, m) === modal.region)
        : scan.markers.filter((m) => m.sector === modal.sector);
  /** Wedges/rings of the iris to highlight in the pop-up: the exact
   *  chart sections behind this area — per marker when there are
   *  findings, otherwise the area's organ-band sections. */
  const highlightPaths: string[] = (() => {
    if (!modal) return [];
    if (modal.kind === "region" && modal.region === "bowel") {
      const [r1, r2] = ZONE_RADII.bowelring;
      return [ringPath(r1, r2)];
    }
    const paths: string[] = [];
    if (modalMarkers.length > 0) {
      const seen = new Set<string>();
      for (const m of modalMarkers) {
        const key = `${m.sector}:${m.zone}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const [r1, r2] = ZONE_RADII[m.zone];
        const c = sectorCenterDeg(m.sector);
        paths.push(wedgePath(r1, r2, c - 15, c + 15));
      }
      return paths;
    }
    const sectors =
      modal.kind === "region" ? sectorsForRegion(scan.eye, modal.region) : [modal.sector];
    const [r1, r2] = ZONE_RADII.organ;
    for (const s of sectors) {
      const c = sectorCenterDeg(s);
      paths.push(wedgePath(r1, r2, c - 15, c + 15));
    }
    return paths;
  })();

  const modalTitle =
    modal == null
      ? ""
      : modal.kind === "region"
        ? BODY_REGION_LABELS[modal.region]
        : chartAreaFor(scan.eye, modal.sector, "middle").label;
  const modalKicker =
    modal == null
      ? ""
      : modal.kind === "region"
        ? `${scan.eye} iris · body area`
        : `${scan.eye} iris · chart section`;

  return (
    <div className="report-wrap" ref={wrapRef}>
      {/* Share row (Adam, 2026-11-05): the buttons live HERE in the
          report, not only in the page footer where nobody finds
          them. The footer row stays as well; shareUrl also drives
          the print QR. */}

      <article className="report-sheet">
        <header className="report-head">
          <p className="report-brand">
            eyeKnow ·{" "}
            {fullScan.markers.length > 0
              ? `${fullScan.markers.length} sign${fullScan.markers.length === 1 ? "" : "s"} detected`
              : "No signs detected"}
          </p>
          <p className="report-sub">{constitution.label}</p>
          {/* Eye switching lives in the badges row (Adam,
              2026-11-02): two eye icons to the left of the date —
              the side being shown is bright, the other dimmed —
              replacing the Left/Right buttons that were in the
              person row. Print keeps a plain text eye badge. */}
          <div className="report-badges">
            <span className="rh-badge rh-eye eye-print-label">
              {scan.eye === "right" ? "Right" : "Left"} iris
            </span>
            <span className="rh-badge rh-date">{date}</span>
            <span className="sr-only">
              {scan.eye === "right" ? "Right" : "Left"} iris — {date}
            </span>
          </div>
          {(personReps || onRenamePerson) && (
            <div className="person-row">
              {editingName ? (
                <span className="person-name-edit no-print">
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    placeholder="Whose reading is this?"
                    maxLength={60}
                    autoFocus
                    aria-label="Name for this reading"
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      onRenamePerson?.(nameDraft);
                      setEditingName(false);
                    }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setEditingName(false)}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <p className="person-name">
                  {personName ? (
                    <b>{personName}</b>
                  ) : (
                    <span className="muted">Unnamed reading</span>
                  )}
                  {onRenamePerson && (
                    <button
                      type="button"
                      className="person-edit no-print"
                      onClick={() => {
                        setNameDraft(personName ?? "");
                        setEditingName(true);
                      }}
                    >
                      {personName ? "✎ Rename" : "＋ Add a name"}
                    </button>
                  )}
                </p>
              )}
              {otherEyeMissing && onScanOtherEye && (
                <button
                  type="button"
                  className="btn ghost person-add-eye no-print"
                  onClick={onScanOtherEye}
                >
                  ＋ Scan the {otherEyeMissing} iris
                </button>
              )}
            </div>
          )}
        </header>

        {shareUrl && (
          <div className="report-share no-print">
            <ShareButtons
              url={shareUrl}
              title="My eyeKnow iridology reading"
              text="My traditional iridology reading from eyeKnow — open it here:"
              label="Share this reading"
            />
          </div>
        )}

        <div className="report-tabs no-print" role="tablist" aria-label="Report sections">
          {tabList.map(([id, label]) => {
            const plain = label.replace(" 🔒", "");
            const isLockedTab = locked && id === "diet";
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                aria-label={isLockedTab ? `${plain} (locked)` : plain}
                title={isLockedTab ? `${plain} (locked)` : plain}
                className={`rtab${activeTab === id ? " on" : ""}`}
                onClick={() => setTab(id)}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {SECTION_ICONS[TAB_ICONS[id]]}
                </svg>
                {isLockedTab && (
                  <span className="rtab-lock" aria-hidden="true">
                    🔒
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className={`tab-page${activeTab === "overview" ? " active" : ""}`}>
        <div className="overview-iris">
          {/* The illustration and the plotted photo sit back to
              back: a rotate button flips between them in 3D
              (Adam, 2026-11-02). The illustration is the front. */}
          <IrisFlip scan={scan} fullScan={fullScan} personReps={personReps} onSelectEye={onOpenScan} />
          {scan.markers.length > 0 && (
            <div className="sign-legend" aria-label="Marker colors by sign">
              {Array.from(new Set(scan.markers.map((m) => m.sign))).map((s) => (
                <button
                  key={s}
                  type="button"
                  className="sign-legend-item as-btn"
                  onClick={() => setSignGuide(s)}
                  title={`What is a ${SIGNS[s].label}?`}
                >
                  <i style={{ background: SIGN_COLORS[s].bg }} />
                  {SIGNS[s].label}
                </button>
              ))}
            </div>
          )}
        </div>
        {glance.length > 0 && (
          <div className="auto-box glance-box">
            <h2 style={{ marginTop: 0 }}>{poss ?? "Your"} reading at a glance</h2>
            <ul className="notes-list">
              {glance.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
            <p style={{ marginBottom: 0 }}>
              <b>How to follow this report:</b> start here, then open the <b>Findings</b>{" "}
              tab — your signs are listed clearest first — and tap any finding, or use the{" "}
              <b>Body Map</b>, to see exactly where each sign sits.
            </p>
          </div>
        )}
        <div className="report-top">
          <div className="report-constitution">
            <h2>{poss ?? "Your"} constitution</h2>
            <p>{constitution.reading}</p>
            {zones.length > 0 && (
              <>
                <h3>Where your signs sit</h3>
                <ul className="zone-list">
                  {zones.map((z) => (
                    <li key={z.zone}>
                      <b>{ZONES[z.zone].label}:</b> {z.count} sign{z.count === 1 ? "" : "s"} —{" "}
                      {ZONES[z.zone].traditional}.
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>

        {showEnrichment && (
          <>
            <h2>Colour &amp; stage</h2>
            <p>
              The classic readers — Jensen and Liljequist, and Williams after them — read a
              sign&apos;s <b>colour</b> as its stage: white is acute and over-active, yellow
              is sub-acute and settling, orange and brown are chronic and settled, and the
              deepest tones are the longest-standing of all. This reader samples the actual
              colour where each of your signs sits:
            </p>
            {stageCounts.length > 0 && (
              <ul className="zone-list">
                {stageCounts.map((s) => (
                  <li key={s.tone}>
                    <b>
                      {TONES[s.tone].stage} ({TONES[s.tone].label.toLowerCase()}):
                    </b>{" "}
                    {s.count} sign{s.count === 1 ? "" : "s"} — {TONES[s.tone].activity}.
                  </li>
                ))}
              </ul>
            )}
            {dominantStage && (
              <p>
                The dominant pattern in this iris is the{" "}
                <b>{TONES[dominantStage.tone].stage.toLowerCase()}</b> stage —{" "}
                {dominantStage.tone === "white"
                  ? "an active, over-working picture overall: the tradition's first move is to calm and decongest rather than to push."
                  : dominantStage.tone === "yellow"
                    ? "a settling, under-functioning picture overall: the tradition supports elimination and the gentle waking-up of sluggish areas."
                    : "a settled, longer-standing picture overall: the tradition works slowly here — liver support, steady elimination, and consistency over weeks, not days."}
              </p>
            )}
            {gradeText && (
              <p>
                <b>Constitution strength — {gradeText.label}.</b> {gradeText.note}
              </p>
            )}
            {fullScan.profile?.texture && (
              <p>
                <b>
                  Fibre texture —{" "}
                  {fullScan.profile.texture.label === "fine"
                    ? "fine and even"
                    : fullScan.profile.texture.label === "mixed"
                      ? "mixed"
                      : "coarse and broken"}
                  .
                </b>{" "}
                {fullScan.profile.texture.label === "fine"
                  ? "Measured across the unwrapped iris strip (neighbouring-tone statistics), the fibres run fine and even — few breaks, little local contrast: the measured texture behind the close-weave picture."
                  : fullScan.profile.texture.label === "mixed"
                    ? "Measured across the unwrapped iris strip (neighbouring-tone statistics), even stretches alternate with coarser, more broken patches — and it is in those patches that the reader concentrated its signs."
                    : "Measured across the unwrapped iris strip (neighbouring-tone statistics), the texture runs coarse — frequent fibre gaps and strong local contrast: the measured texture behind the open-weave picture."}
              </p>
            )}
            {irisNotes.length > 0 && (
              <>
                <h3>Also observed around the iris</h3>
                <ul className="notes-list">
                  {irisNotes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </>
            )}
            {systems.length > 0 && (
              <>
                <h3>The pattern by body system</h3>
                <ul className="zone-list">
                  {systems.map((s) => (
                    <li key={s.label}>
                      <b>{s.label}:</b> {s.count} sign{s.count === 1 ? "" : "s"}
                      {s.dominantStage
                        ? ` — reading mostly ${s.dominantStage.toLowerCase()}`
                        : ""}
                      .
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        {showEnrichment && inheritedCount > 0 && (
          <>
            <h2>Your inherited pattern</h2>
            <p>
              In this tradition, some signs are read as <b>inherited</b> — written into the
              fibres before birth — and some as acquired during your own life. For inherited
              signs the {scan.eye} iris carries {familyLine(scan.eye)}. A sign&apos;s colour
              tells whether an inherited area currently reads <i>active</i> (white or yellow
              tones) or <i>quiet</i> (brown or deep tones).
            </p>
            <ul className="notes-list">
              {inherited.lacunae.map((m) => (
                <li key={m.id}>
                  {markerPlace(fullScan, m)} —{" "}
                  {m.shape
                    ? `a ${LACUNA_FORM_LABEL[m.shape.form]} (${m.shape.opened ? "opened toward the pupil" : "closed in the fibres"})`
                    : "a lacuna"}
                  : split fibres read as an inherited weakness in this area
                  {m.tone
                    ? toneIsActive(m.tone)
                      ? ", and its tone says it is currently active."
                      : ", currently reading quiet."
                    : "."}
                </li>
              ))}
              {inherited.settlements.map((m) => (
                <li key={m.id}>
                  {markerPlace(fullScan, m)} — a heavy dark pigment patch (the psora-type
                  marking): read as an inherited settlement
                  {m.tone
                    ? toneIsActive(m.tone)
                      ? ", currently reading active."
                      : ", currently reading quiet."
                    : "."}
                </li>
              ))}
              {inherited.deposits.map((m) => (
                <li key={m.id}>
                  {markerPlace(fullScan, m)} — a brighter pigment deposit: read as acquired
                  during your own lifetime rather than inherited.
                </li>
              ))}
            </ul>
            {inherited.lacunae.length >= 4 && (
              <p>
                Several lacunae together loosen the whole fibre picture — the
                &ldquo;loopy&rdquo; iris Williams describes, traditionally paired with a
                glandular-weakness theme running through the reading.
              </p>
            )}
          </>
        )}

        {showEnrichment && temperament.length >= 2 && (
          <>
            <h2>Your temperament in the traditional reading</h2>
            <p>
              Dorothy Hall titled her 1981 book <i>how the eyes reveal your health and
              your personality</i> — the classic reading has always had this second
              half. Yours is sketched from the same measures as the body reading —
              your fibres, nerve rings, pupil and colour — in the tradition&apos;s
              spirit: a temperament sketch for reflection, not a psychological
              verdict.
            </p>
            <ul className="notes-list">
              {temperament.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </>
        )}

        {scan.auto && (
          <>
            <h2>How this reading was made</h2>
            <div className="auto-box">
              <p>
                This scan was <b>read automatically</b> against the traditional iridology chart:
                the app located your iris and pupil, unrolled the iris into a chart strip, and
                measured the classic signs — white and dark markings, deposits, radii solaris,
                nerve rings, cloudiness, and fiber texture — area by area. Overall reading
                confidence:{" "}
                <b>
                  {scan.auto.overallConfidence === "high"
                    ? "high"
                    : scan.auto.overallConfidence === "moderate"
                      ? "moderate"
                      : "low"}
                </b>
                . Each finding below says how clearly its sign was defined.
              </p>
              {(scan.auto.notes.length > 0 || scan.auto.qualityNotes.length > 0) && (
                <ul className="notes-list">
                  {scan.auto.notes.map((n, i) => (
                    <li key={`n${i}`}>{n}</li>
                  ))}
                  {scan.auto.qualityNotes.map((n, i) => (
                    <li key={`q${i}`}>{n}</li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        <div className="no-print" style={{ marginTop: 20, textAlign: "center" }}>
          <button
            type="button"
            className="btn big"
            onClick={() => setTab("findings")}
          >
            Findings
          </button>
        </div>

        {purchaseSection}

        {shareUrl && (
          <div className="report-qr print-only">
            {qrData ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrData} alt="QR code that opens this reading" />
            ) : (
              <div className="report-qr-ph" aria-hidden="true" />
            )}
            <div>
              <h3>
                {locked ? (
                  <>Unlock the full version of this reading — <UnlockPrice scanId={scan.id} accessToken={scan.accessToken} followup={followupPrice} /></>
                ) : (
                  "Reopen this reading on any device"
                )}
              </h3>
              <p>
                {locked
                  ? "Scan the code — or use the link — to open this exact reading and unlock the complete report: every sign with its full description, the complete body map, your personalized diet recommendations, and the Timeline — follow-up scans of this iris are just $1. No account needed — after unlocking, you can save the reading into an account."
                  : "Scan the code — or use the link — to open this exact reading on another phone or computer — the link opens it directly."}
              </p>
              <p className="report-qr-link">{(qrUrl ?? shareUrl).replace(/^https?:\/\//, "")}</p>
            </div>
          </div>
        )}
        </div>

        <div className={`tab-page${activeTab === "bodymap" ? " active" : ""}`}>
        {/* One body map only (Adam, 2026-11-02) — for whichever
            iris is being viewed. */}
        <BodyMap scan={scan} activeRegion={activeRegion} onSelect={openRegion} />
        {bmToast && (
          <div className="bm-toast no-print" role="status">
            👆 Swipe the body to see the back
          </div>
        )}
        {/* Heading + description sit BELOW the illustration
            (Adam's direction, 2026-11-01). */}
        <h2>Body map</h2>
        <p className="muted" style={{ marginTop: -4 }}>
          {poss ?? "Your"} findings on the body, the way the chart lays them out. Only the lit areas are
          marked in {poss ?? "your"} iris — tap one and its details pop up.
          {locked &&
            ` This free preview shows the ${PREVIEW_COUNT} most important signs with shortened descriptions — the full reading lights up every area found, in full.`}
        </p>

        {purchaseSection}
        </div>

        <div className={`tab-page${activeTab === "findings" ? " active" : ""}`}>
        <h2>Findings</h2>
        {findings.length > 0 && (
          <p className="muted" style={{ marginTop: -4 }}>
            {poss ?? "Your"} signs, <b>clearest first</b> — the ones the reader saw most sharply are at
            the top. Under each sign you&apos;ll see where it sits on the body, which band
            of the iris it&apos;s in, its colour stage (how active the tradition reads it),
            and how clearly it was seen. New to the words? <b>Tap a sign&apos;s name</b> at
            the top of any finding for a picture and a plain-language explanation.
          </p>
        )}
        {findings.length === 0 ? (
          <p className="muted">
            No signs stood out on this scan, so there are no area findings — this reading is the
            constitution overview on the Overview tab.
          </p>
        ) : (
          <ol className="findings">
            {findings.map((f, i) => {
              const m = markerOf.get(f.markerId);
              const region = m ? bodyRegionFor(scan.eye, m) : null;
              const isActive = region != null && region === activeRegion;
              const label = m ? SIGNS[m.sign].label : f.title;
              return (
                <li key={f.markerId} className={isActive ? "finding-active" : ""}>
                  {/* Layout (Adam, 2026-11-03): the body part's name
                      sits centered above its big icon, and the type
                      of marking sits in the badge row beneath,
                      together with the band (zone) it falls in. A
                      finding with no mapped area keeps its marking
                      badge on top instead. */}
                  {!(m && region) && (
                    <div className="finding-toprow">
                    {m ? (
                      <button
                        type="button"
                        className="kind-badge as-btn"
                        onClick={() => setSignGuide(m.sign)}
                        title={`What is a ${label}?`}
                      >
                        <span
                          className="sign-dot"
                          style={{ background: SIGN_COLORS[m.sign].bg }}
                          aria-hidden="true"
                        />
                        {label}
                        <span className="kb-q" aria-hidden="true">?</span>
                      </button>
                      ) : (
                        <span className="kind-badge">{label}</span>
                      )}
                    </div>
                  )}
                  {m && region && (
                    <>
                      <button
                        type="button"
                        className="finding-hero no-print"
                        onClick={() => openSector(m.sector)}
                        title="Open this area's details"
                      >
                        <RegionHero region={region} />
                      </button>
                      <span className="finding-hero-print" aria-hidden="true">
                        <RegionHero region={region} />
                      </span>
                    </>
                  )}
                  {m && region && (
                    <SignBadges
                      hideRegion
                      region={region}
                      zone={m.zone}
                      confidence={m.confidence}
                      tone={m.tone}
                      sign={m.sign}
                      onSignGuide={() => setSignGuide(m.sign)}
                    />
                  )}
                  <p>
                    {cleanBody(f.body)}
                    {f.stageNote && <span className="stage-line"> {f.stageNote}</span>}{f.shapeNote && <span className="stage-line"> {f.shapeNote}</span>}
                  </p>
                </li>
              );
            })}
          </ol>
        )}

        {purchaseSection}
        </div>

        <div className={`tab-page${activeTab === "diet" ? " active" : ""}${locked ? " no-print" : ""}`}>
        {locked ? (
          <div className="paywall-lite">
            <h2>{poss ?? "Your"} personalized diet recommendations</h2>
            <p>
              The full reading builds <b>personalized diet recommendations</b> from your
              constitution, the areas your reading highlights, and the sign patterns
              themselves — traditional food themes for the bowel, liver, circulation, and
              more, matched to what your iris shows. Unlocking also opens the{" "}
              <b>Timeline</b> for this iris — follow-up scans are just <b>$1</b> each.
            </p>
            {!followupPrice && !basic && onUnlockBasic && (
              <>
                <p>
                  <b>Start with the basic reading — $3.</b> It opens {poss ?? "your"}{" "}
                  {PREVIEW_COUNT} most important signs <b>in full</b> — complete
                  descriptions, colour stages and sign shapes — with the{" "}
                  <b>complete body map</b>. One unlock covers <b>both irises</b> of
                  this person, so the other eye&rsquo;s basic reading is included too.
                </p>
                <button type="button" className="btn big" onClick={onUnlockBasic} disabled={unlockBusy}>
                  {unlockBusy ? "Opening checkout…" : "Unlock the basic reading — $3"}
                </button>
                <button type="button" className="btn ghost" onClick={onUnlock} disabled={unlockBusy} style={{ marginTop: 10 }}>
                  {unlockBusy ? "Opening checkout…" : <>Or unlock the full reading — <UnlockPrice scanId={scan.id} accessToken={scan.accessToken} followup={followupPrice} /></>}
                </button>
                <p className="muted" style={{ margin: "8px 0 0" }}>
                  The full reading adds all {fullScan.markers.length} signs,
                  personalized diet recommendations, temperament and inherited
                  patterns, and the Timeline — and a full unlock also includes{" "}
                  <b>10 free basic readings to share</b> with friends and family.
                </p>
              </>
            )}
            {(followupPrice || basic || !onUnlockBasic) && (
              <button type="button" className="btn big" onClick={onUnlock} disabled={unlockBusy}>
                {unlockBusy ? "Opening checkout…" : <>Unlock full reading — <UnlockPrice scanId={scan.id} accessToken={scan.accessToken} followup={followupPrice} /></>}
              </button>
            )}
            {onExample && (
              <div style={{ marginTop: 10 }}>
                <button type="button" className="btn ghost" onClick={onExample}>
                  📖 See an example full reading
                </button>
              </div>
            )}
            {onGift && (
              <div style={{ marginTop: 10 }}>
                <button type="button" className="btn ghost" onClick={onGift}>
                  🎁 Or gift a reading to someone — <AffPrice />
                </button>
              </div>
            )}
          </div>
        ) : diet.length > 0 ? (
          <>
            <h2>{poss ?? "Your"} personalized diet recommendations</h2>
            <p className="muted" style={{ marginTop: -4 }}>
              Built from this reading — your constitution, the areas with signs, and the sign
              patterns themselves. Traditional themes for everyday eating, not medical
              nutrition advice.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="diet-banner" src="/diet/spread.jpg" alt="A spread of fresh vegetables, fruits, and herbs" loading="lazy" />
            {diet.map((section) => (
              <div key={section.title} className="diet-section">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="diet-thumb" src={dietImage(section.title)} alt="" aria-hidden="true" loading="lazy" />
                <div className="diet-section-body">
                  <h3>{section.title}</h3>
                  <ul className="notes-list">
                    {section.points.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </>
        ) : (
          <p className="muted">No diet themes stood out on this scan.</p>
        )}
        </div>

        {showTimeline && (
          <div className={`tab-page${activeTab === "timeline" ? " active" : ""}${locked ? " no-print" : ""}`}>
            <h2>Timeline</h2>
            <SubscriptionOffer />
            {locked ? (
              <>
                <p>
                  The <b>Timeline</b> tracks this iris over time. Unlock the full report and
                  this tab becomes {poss ?? "your"} timeline: come back days, weeks, or months later,
                  rescan the <b>same iris</b>, and eyeKnow compares the new scan with this
                  one automatically.
                </p>
                <ul className="notes-list">
                  <li>
                    <b>Automatic change detection</b> — see which traditional signs are new,
                    which have faded, and which read stronger or weaker than last time.
                  </li>
                  <li>
                    <b>Follow-up scans cost $1</b> — once this reading is unlocked, every
                    additional scan of the same iris unlocks for $1 instead of $19.99,
                    comparison included.
                  </li>
                  <li>
                    <b>A chain that keeps growing</b> — each follow-up joins the timeline and
                    is compared with the scan before it, building a picture of how the
                    traditional pattern shifts over time.
                  </li>
                </ul>
                <p>
                  {scan.baseId ? (
                    <>This scan is a follow-up in an existing timeline — unlock it for <UnlockPrice scanId={scan.id} accessToken={scan.accessToken} followup={followupPrice} /> and it joins the chain with its full change comparison.</>
                  ) : (
                    <>Unlock the full report (<UnlockPrice scanId={scan.id} accessToken={scan.accessToken} followup={followupPrice} />) and the Timeline opens with this reading as its first entry.</>
                  )}
                </p>
                {purchaseSection}
              </>
            ) : (
              <>
            <p className="muted">
              Every scan of this iris, in order. Each new scan is compared automatically
              with the one before it — which traditional signs appeared, which faded, and
              which read stronger or weaker.
            </p>
            {comparison && prevScan && (
              <div className="timeline-changes">
                <h3>Changes since {fmtDate(prevScan.createdAt)}</h3>
                <p className="timeline-summary">{comparison.summary}</p>
                {comparison.toneShift === "lighter" && (
                  <p>
                    <b>Whole-iris shift:</b> this iris photographed <b>lighter</b> overall
                    than last time. The classic texts track exactly this — Liljequist
                    compared photographs across years — and read a lightening eye, alongside
                    lightening signs, as the healing direction.
                  </p>
                )}
                {comparison.toneShift === "darker" && (
                  <p>
                    <b>Whole-iris shift:</b> this iris photographed <b>darker</b> overall
                    than last time — the direction the tradition reads as accumulation
                    settling in. Photo lighting shifts this too, so compare like with like.
                  </p>
                )}
                {comparison.added.length > 0 && (
                  <>
                    <h4>New signs</h4>
                    <ul className="change-list">
                      {comparison.added.map((m) => (
                        <li key={m.id}>
                          <i className="rp-dot" style={{ background: SIGN_COLORS[m.sign].bg }} />
                          {markerPlace(scan, m)}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {comparison.faded.length > 0 && (
                  <>
                    <h4>Faded signs — there last time, not seen now</h4>
                    <ul className="change-list">
                      {comparison.faded.map((m) => (
                        <li key={m.id}>
                          <i className="rp-dot" style={{ background: SIGN_COLORS[m.sign].bg }} />
                          {markerPlace(scan, m)}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {comparison.stronger.length > 0 && (
                  <>
                    <h4>Reading stronger</h4>
                    <ul className="change-list">
                      {comparison.stronger.map((c) => (
                        <li key={c.marker.id}>
                          <i className="rp-dot" style={{ background: SIGN_COLORS[c.marker.sign].bg }} />
                          {markerPlace(scan, c.marker)} — was {c.before.confidence ?? "moderate"},
                          now {c.marker.confidence ?? "moderate"}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {comparison.weaker.length > 0 && (
                  <>
                    <h4>Reading weaker</h4>
                    <ul className="change-list">
                      {comparison.weaker.map((c) => (
                        <li key={c.marker.id}>
                          <i className="rp-dot" style={{ background: SIGN_COLORS[c.marker.sign].bg }} />
                          {markerPlace(scan, c.marker)} — was {c.before.confidence ?? "moderate"},
                          now {c.marker.confidence ?? "moderate"}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {comparison.lightened.length > 0 && (
                  <>
                    <h4>Lightened a stage — the healing signs</h4>
                    <ul className="change-list">
                      {comparison.lightened.map((c) => (
                        <li key={c.marker.id}>
                          <i className="rp-dot" style={{ background: SIGN_COLORS[c.marker.sign].bg }} />
                          {markerPlace(scan, c.marker)} — was{" "}
                          {c.before.tone ? TONES[c.before.tone].stage.toLowerCase() : "—"}, now{" "}
                          {c.marker.tone ? TONES[c.marker.tone].stage.toLowerCase() : "—"}
                        </li>
                      ))}
                    </ul>
                    <p className="hint">
                      In the classic reading, a dark area that lightens a stage is knitting
                      back — fine new fibres (the healing lines) crossing it as it closes.
                      This is the change the tradition most wants to see.
                    </p>
                  </>
                )}
                {comparison.deepened.length > 0 && (
                  <>
                    <h4>Deepened a stage</h4>
                    <ul className="change-list">
                      {comparison.deepened.map((c) => (
                        <li key={c.marker.id}>
                          <i className="rp-dot" style={{ background: SIGN_COLORS[c.marker.sign].bg }} />
                          {markerPlace(scan, c.marker)} — was{" "}
                          {c.before.tone ? TONES[c.before.tone].stage.toLowerCase() : "—"}, now{" "}
                          {c.marker.tone ? TONES[c.marker.tone].stage.toLowerCase() : "—"}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="hint">
                  Signs are matched by type and chart area between the two photos. Light,
                  angle and focus differ from photo to photo, so small changes can be
                  photographic — read them as the traditional pattern shifting, not as a
                  medical measurement.
                </p>
              </div>
            )}
            <h3>Scans in this timeline</h3>
            <ol className="timeline-list">
              {chainList.map((s, i) => {
                const prev = i > 0 ? chainList[i - 1] : undefined;
                const sum = prev ? compareScans(prev, s).summary : null;
                return (
                  <li key={s.id} className="timeline-item">
                    <div>
                      <b>{fmtDate(s.createdAt)}</b> · {s.markers.length} signs
                      {s.id === scan.id && <span className="timeline-here"> · this reading</span>}
                      {sum && <div className="muted">{sum}</div>}
                    </div>
                    {s.id !== scan.id && onOpenScan && (
                      <button type="button" className="btn ghost small" onClick={() => onOpenScan(s)}>
                        Open
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
            {onRescan && (
              <>
                <button type="button" className="btn big" onClick={onRescan}>
                  ＋ Rescan this iris — $1
                </button>
                <p className="hint">
                  Follow-up scans unlock for $1 because the original reading in this
                  timeline is already yours.
                </p>
              </>
            )}
              </>
            )}
          </div>
        )}

        <div className={`tab-page${activeTab === "notes" ? " active" : ""}`}>
        <h2>Notes from the traditional reading</h2>
        <ul className="notes-list">
          {notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>

        <footer className="report-disclaimer">
          <b>Please read:</b> Iridology is a traditional practice, and this report presents what
          the traditional iridology chart associates with the features measured on your iris
          photo. It is not a medical diagnosis, has not been evaluated as one, and is not a
          substitute for professional medical advice, diagnosis, or treatment. If you have a
          health concern, see a qualified medical professional.
        </footer>

        {purchaseSection}
        </div>
      </article>

        {sibling && (
          <section className="print-only pair-print">
            <h2>
              {personName ? `${personName} — ` : ""}the other iris:{" "}
              {sibling.eye === "right" ? "Right" : "Left"}
            </h2>
            <IrisIllustration scan={sibling} />
            {siblingFindings.length > 0 && (
              <ul className="pair-findings">
                {siblingFindings.map((f) => (
                  <li key={f.markerId}>
                    <b>{f.title}.</b> {f.body}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

      <div className="report-actions no-print">
        {onBack && (
          <button type="button" className="btn ghost" onClick={onBack}>
            ← Back
          </button>
        )}
        {/* Print is earned with the basic unlock (Adam, 2026-11-06):
            a free preview cannot be printed. */}
        {!example && (!locked || basic) && (
          <button type="button" className="btn" onClick={() => window.print()}>
            Print / save PDF
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            className="btn danger-ghost"
            onClick={() => {
              if (window.confirm("Delete this saved reading?")) onDelete(scan.id);
            }}
          >
            Delete
          </button>
        )}
      </div>

      {signGuide && (
        <SignGuideModal sign={signGuide} onClose={() => setSignGuide(null)} />
      )}

      {modal && (
        <div
          className="modal-backdrop no-print"
          role="dialog"
          aria-modal="true"
          aria-label={`Details for ${modalTitle}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div className="modal-card">
            <button
              type="button"
              className="modal-close"
              aria-label="Close details"
              onClick={() => setModal(null)}
            >
              ×
            </button>
            <p className="report-brand">{modalKicker}</p>
            <h2 className="modal-title">{modalTitle}</h2>
            {modal.kind === "region" && (
              <div style={{ margin: "2px 0 10px" }}>
                <RegionBadge region={modal.region} />
              </div>
            )}

            {modal.kind === "region" && modal.region !== "bowel" && (
              <p className="muted">
                {sectorsForRegion(scan.eye, modal.region).length > 0 ? (
                  <>
                    On the chart ({scan.eye} iris) this area covers{" "}
                    {Array.from(
                      new Set(
                        sectorsForRegion(scan.eye, modal.region).map(
                          (s) => chartAreaFor(scan.eye, s, "middle").label,
                        ),
                      ),
                    ).join("; ")}
                    .
                  </>
                ) : (
                  <>
                    The chart reads this area from the {scan.eye === "right" ? "left" : "right"}{" "}
                    iris — it doesn't appear on the {scan.eye} iris chart.
                  </>
                )}
              </p>
            )}
            {modal.kind === "region" && modal.region === "bowel" && (
              <p className="muted">
                The bowel ring circles the pupil — the chart's stomach lining and colon sections
                (transverse colon across the top, ascending colon and small intestine down the
                sides, descending and sigmoid colon along the bottom).
              </p>
            )}

            <PlotPhoto
              image={scan.image}
              alt="Your iris scan"
              frameClass="modal-iris"
              dots={modalMarkers.map((m) => ({
                key: m.id,
                x: m.x,
                y: m.y,
                className: "report-dot",
                style: {
                  background: SIGN_COLORS[m.sign].bg,
                  color: SIGN_COLORS[m.sign].fg,
                },
                children: scan.markers.indexOf(m) + 1,
                sizePx: 24,
              }))}
              overlay={
                <svg
                  className="modal-iris-overlay"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <circle cx="50" cy="50" r={IRIS_R} className="iris-dim" />
                  {highlightPaths.map((d, i) => (
                    <path key={i} d={d} className="iris-highlight" fillRule="evenodd" />
                  ))}
                </svg>
              }
            />
            {modalMarkers.length > 0 && (
              <div className="sign-legend" aria-label="Marker colors by sign">
                {Array.from(new Set(modalMarkers.map((m) => m.sign))).map((s) => (
                  <span key={s} className="sign-legend-item">
                    <i style={{ background: SIGN_COLORS[s].bg }} />
                    {SIGNS[s].label}
                  </span>
                ))}
              </div>
            )}

            {modalFindings.length === 0 ? (
              <p className="muted">
                No signs were found in this area in this reading — a clear area here is simply a
                quiet part of the picture.
              </p>
            ) : (
              <ol className="findings modal-findings">
                {modalFindings.map((f) => {
                  const fm = markerOf.get(f.markerId);
                  if (!fm) {
                    return (
                      <li key={f.markerId}>
                        <h3>{f.title}</h3>
                        <p>{f.body}</p>
                      </li>
                    );
                  }
                  const body = cleanBody(f.body);
                  return (
                    <li key={f.markerId}>
                      <h3>
                        <span
                          className="sign-dot"
                          style={{ background: SIGN_COLORS[fm.sign].bg }}
                          aria-hidden="true"
                        />
                        {SIGNS[fm.sign].label}
                      </h3>
                      <SignBadges
                        region={bodyRegionFor(scan.eye, fm)}
                        zone={fm.zone}
                        confidence={fm.confidence}
                        tone={fm.tone}
                      />
                      <button
                        type="button"
                        className="sign-what no-print"
                        onClick={() => setSignGuide(fm.sign)}
                      >
                        ⓘ What is this sign?
                      </button>
                      <p>
                        {body}
                        {f.stageNote && <span className="stage-line"> {f.stageNote}</span>}{f.shapeNote && <span className="stage-line"> {f.shapeNote}</span>}
                      </p>
                    </li>
                  );
                })}
              </ol>
            )}
            <button type="button" className="btn" onClick={() => setModal(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
