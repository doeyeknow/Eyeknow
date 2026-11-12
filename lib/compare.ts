// Timeline change detection: compare two scans of the SAME iris and
// describe what changed in traditional-sign terms. Signs are matched
// one-to-one by sign type + radial zone + clock sector (±1 sector,
// since a photo never lands at exactly the same angle twice); among
// candidates the nearest position wins. A matched pair whose reader
// confidence moved (light < moderate < strong) reads as stronger or
// weaker; unmatched signs are new (in the later scan) or faded (only
// in the earlier one).
//
// FRAMING: this compares the signs the automatic reader measured on
// two photos — lighting, angle and focus shift results, so the UI
// presents these as changes in the traditional pattern, never as a
// medical measurement.

import {
  chartAreaFor,
  SIGNS,
  toneDepth,
  type Marker,
  type ScanRecord,
} from "./chart";

const RANK: Record<NonNullable<Marker["confidence"]>, number> = {
  light: 0,
  moderate: 1,
  strong: 2,
};

function rank(m: Marker): number {
  return RANK[m.confidence ?? "moderate"];
}

function sectorDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 12;
  return Math.min(d, 12 - d);
}

export interface ChangedSign {
  marker: Marker; // the sign in the newer scan
  before: Marker; // the matched sign in the older scan
}

export interface ScanComparison {
  added: Marker[];
  faded: Marker[];
  stronger: ChangedSign[];
  weaker: ChangedSign[];
  /** Matched signs whose sampled tone lightened a stage — the
   *  movement the classic texts describe with healing lines. */
  lightened: ChangedSign[];
  /** Matched signs whose sampled tone deepened a stage. */
  deepened: ChangedSign[];
  unchanged: number;
  oldCount: number;
  newCount: number;
  /** Whole-iris brightness movement between the two photos. */
  toneShift?: "lighter" | "darker";
  /** One-line summary, e.g. "2 new · 1 faded · 1 stronger · 9 unchanged". */
  summary: string;
}

export function compareScans(older: ScanRecord, newer: ScanRecord): ScanComparison {
  const usedOld = new Set<string>();
  const pairs: Array<{ o: Marker; n: Marker }> = [];
  const added: Marker[] = [];

  for (const n of newer.markers) {
    let best: Marker | null = null;
    let bestScore = Infinity;
    for (const o of older.markers) {
      if (usedOld.has(o.id) || o.sign !== n.sign || o.zone !== n.zone) continue;
      const sd = sectorDist(o.sector, n.sector);
      if (sd > 1) continue;
      const score = sd * 2 + Math.hypot(o.x - n.x, o.y - n.y);
      if (score < bestScore) {
        bestScore = score;
        best = o;
      }
    }
    if (best) {
      usedOld.add(best.id);
      pairs.push({ o: best, n });
    } else {
      added.push(n);
    }
  }

  const faded = older.markers.filter((o) => !usedOld.has(o.id));
  const stronger: ChangedSign[] = [];
  const weaker: ChangedSign[] = [];
  const lightened: ChangedSign[] = [];
  const deepened: ChangedSign[] = [];
  let unchanged = 0;
  for (const { o, n } of pairs) {
    const d = rank(n) - rank(o);
    if (d > 0) stronger.push({ marker: n, before: o });
    else if (d < 0) weaker.push({ marker: n, before: o });
    let toneMoved = false;
    if (o.tone && n.tone) {
      const td = toneDepth(n.tone) - toneDepth(o.tone);
      if (td < 0) {
        lightened.push({ marker: n, before: o });
        toneMoved = true;
      } else if (td > 0) {
        deepened.push({ marker: n, before: o });
        toneMoved = true;
      }
    }
    if (d === 0 && !toneMoved) unchanged++;
  }

  const parts: string[] = [];
  if (added.length) parts.push(`${added.length} new`);
  if (faded.length) parts.push(`${faded.length} faded`);
  if (stronger.length) parts.push(`${stronger.length} stronger`);
  if (weaker.length) parts.push(`${weaker.length} weaker`);
  if (lightened.length) parts.push(`${lightened.length} lightened`);
  if (deepened.length) parts.push(`${deepened.length} deepened`);
  parts.push(`${unchanged} unchanged`);

  let toneShift: ScanComparison["toneShift"];
  if (older.profile && newer.profile) {
    const dl = newer.profile.meanLum - older.profile.meanLum;
    if (dl > 7) toneShift = "lighter";
    else if (dl < -7) toneShift = "darker";
  }

  return {
    added,
    faded,
    stronger,
    weaker,
    lightened,
    deepened,
    unchanged,
    oldCount: older.markers.length,
    newCount: newer.markers.length,
    ...(toneShift ? { toneShift } : {}),
    summary: parts.join(" · "),
  };
}

/** "Lacuna — 2 o'clock · Liver & gall bladder area" for one marker. */
export function markerPlace(scan: Pick<ScanRecord, "eye">, m: Marker): string {
  const area = chartAreaFor(scan.eye, m.sector, m.zone);
  return `${SIGNS[m.sign].label} — ${m.sector} o'clock · ${area.label}`;
}
