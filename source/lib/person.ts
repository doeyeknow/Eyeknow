import type { ScanRecord } from "./chart";

/** Person grouping for readings (Adam, 2026-11-01): one item in
 *  My readings = one PERSON. Both irises and all follow-up scans
 *  belong to the person; one full unlock covers the whole person.
 *  These helpers are pure and client-safe — the server applies the
 *  same rules when it serves scans (see app/api/scans/route.ts and
 *  lib/shared.ts). */

export function personIdOf(scan: ScanRecord): string {
  return scan.personId ?? scan.id;
}

export interface PersonGroup {
  personId: string;
  /** The person's name, if one was added to any of their scans. */
  name: string | null;
  /** Every scan belonging to the person, newest first. */
  scans: ScanRecord[];
  /** The representative scan per eye — the newest scan of that
   *  eye (follow-ups collapse into their eye's slot). */
  right: ScanRecord | null;
  left: ScanRecord | null;
  /** True when ANY of the person's scans is unlocked — one
   *  unlock covers the whole person. */
  unlocked: boolean;
  /** Newest activity in the group (for sorting the list). */
  latestAt: number;
  /** Total signs across the representative scans. */
  signCount: number;
}

export function groupPersons(scans: ScanRecord[]): PersonGroup[] {
  const byId = new Map<string, ScanRecord[]>();
  for (const s of scans) {
    const pid = personIdOf(s);
    const arr = byId.get(pid) ?? [];
    arr.push(s);
    byId.set(pid, arr);
  }
  const groups: PersonGroup[] = [];
  for (const [personId, arr] of byId) {
    const sorted = [...arr].sort((a, b) => b.createdAt - a.createdAt);
    const rep = (eye: "right" | "left") => sorted.find((s) => s.eye === eye) ?? null;
    const right = rep("right");
    const left = rep("left");
    groups.push({
      personId,
      name:
        sorted.find((s) => s.personName && s.personName.trim().length > 0)
          ?.personName?.trim() ?? null,
      scans: sorted,
      right,
      left,
      unlocked: sorted.some((s) => s.unlocked),
      latestAt: sorted[0]?.createdAt ?? 0,
      signCount: (right?.markers.length ?? 0) + (left?.markers.length ?? 0),
    });
  }
  return groups.sort((a, b) => b.latestAt - a.latestAt);
}

/** The person's other-eye representative, if exactly one eye is
 *  present; null when both eyes are scanned (or none). */
export function missingEye(group: PersonGroup): "right" | "left" | null {
  if (group.right && !group.left) return "left";
  if (group.left && !group.right) return "right";
  return null;
}

/** Apply the person unlock rule to a scan in the context of the
 *  full local list: unlocked when any scan of the same person is
 *  unlocked. Returns the scan unchanged when nothing changes. */
export function withPersonUnlock(scan: ScanRecord, all: ScanRecord[]): ScanRecord {
  if (scan.unlocked) return scan;
  const pid = personIdOf(scan);
  return all.some((s) => personIdOf(s) === pid && s.unlocked)
    ? { ...scan, unlocked: true }
    : scan;
}
