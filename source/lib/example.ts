import type { IrisProfile, Marker, ScanRecord, SignId, ToneId, ZoneId } from "./chart";

/** A built-in example of a FULL (unlocked) reading, shown from the
 *  purchase panel so people can see exactly what the full reading buys before
 *  paying. Fixed sample data on the demo iris — not a real user.
 *  Markers carry sampled tones and each scan a whole-iris profile so
 *  the example also demonstrates the colour-stage reading, the
 *  inherited-pattern section, and the Timeline's stage changes. */

const ZONE_R: Record<ZoneId, number> = { inner: 0.116, middle: 0.21, outer: 0.324 };

function marker(
  id: string,
  sign: SignId,
  sector: number,
  zone: ZoneId,
  confidence: NonNullable<Marker["confidence"]>,
  tone?: ToneId,
): Marker {
  const theta = ((sector % 12) * 30 * Math.PI) / 180; // clockwise from 12
  const r = ZONE_R[zone];
  return {
    id,
    sign,
    sector,
    zone,
    x: 0.5 + r * Math.sin(theta),
    y: 0.5 - r * Math.cos(theta),
    auto: true,
    confidence,
    ...(tone ? { tone } : {}),
  };
}

const PROFILE_1: IrisProfile = {
  constitutionGrade: 6,
  pupilRatio: 0.33,
  meanLum: 96,
  scurf: "medium",
  outerRing: "white",
  ringHeadNote: true,
  stomachTone: "halo",
  texture: { contrast: 23.6, energy: 0.082, homogeneity: 0.47, label: "mixed" },
};

export const EXAMPLE_SCAN: ScanRecord = {
  id: "example-full-reading",
  createdAt: new Date("2026-10-15T15:30:00Z").getTime(),
  eye: "right",
  color: "brown",
  image: "/demo-iris.jpg",
  markers: [
    marker("ex01", "ring", 8, "middle", "strong", "white"),
    marker("ex02", "lacuna", 8, "middle", "moderate", "brown"),
    marker("ex03", "cloudy", 9, "middle", "moderate", "white"),
    marker("ex04", "radial", 5, "inner", "strong", "yellow"),
    marker("ex05", "lacuna", 12, "outer", "light", "deep"),
    marker("ex06", "ring", 12, "middle", "moderate", "yellow"),
    marker("ex07", "pigment", 2, "middle", "moderate", "orange"),
    marker("ex08", "fiber", 10, "middle", "light", "yellow"),
    marker("ex09", "cloudy", 6, "inner", "moderate", "white"),
    marker("ex10", "lacuna", 4, "middle", "moderate", "brown"),
    marker("ex11", "ring", 4, "outer", "light", "orange"),
    marker("ex12", "pigment", 11, "outer", "light", "deep"),
    marker("ex13", "radial", 7, "middle", "moderate", "brown"),
    marker("ex14", "fiber", 1, "inner", "light", "white"),
    marker("ex15", "cloudy", 3, "outer", "light", "yellow"),
  ],
  profile: PROFILE_1,
  auto: {
    overallConfidence: "moderate",
    notes: [
      "Pupil and iris edge located automatically; the iris was unrolled onto the chart and read sector by sector.",
      "Contrast was enhanced before detection (gamma lift + local stretch), which suits this darker iris tone.",
    ],
    qualityNotes: [],
  },
  unlocked: true,
};

/** Follow-up example scans: the same iris three and six weeks later,
 *  with deliberate changes (some signs faded, a few new, one stronger,
 *  one weaker — and the liver-area lacuna lightening a stage each
 *  time, brown → yellow → white) so the example's Timeline tab shows
 *  a real comparison including the healing-direction change.
 *  Scan 2 vs scan 1: 2 new · 2 faded · 1 stronger · 1 weaker · 1 lightened · 10 unchanged.
 *  Scan 3 vs scan 2: 2 new · 1 faded · 1 stronger · 1 weaker · 1 lightened · 12 unchanged. */
export const EXAMPLE_SCAN_2: ScanRecord = {
  id: "example-full-reading-2",
  createdAt: new Date("2026-11-05T15:30:00Z").getTime(),
  eye: "right",
  color: "brown",
  image: "/demo-iris.jpg",
  baseId: "example-full-reading",
  prevId: "example-full-reading",
  markers: [
    marker("ex01", "ring", 8, "middle", "strong", "white"),
    marker("ex02", "lacuna", 8, "middle", "moderate", "yellow"), // lightened a stage
    marker("ex03", "cloudy", 9, "middle", "light", "white"), // weaker than scan 1
    marker("ex04", "radial", 5, "inner", "strong", "yellow"),
    marker("ex05", "lacuna", 12, "outer", "light", "deep"),
    marker("ex06", "ring", 12, "middle", "moderate", "yellow"),
    marker("ex07", "pigment", 2, "middle", "strong", "orange"), // stronger than scan 1
    // ex08 fiber 10 middle — faded
    marker("ex09", "cloudy", 6, "inner", "moderate", "white"),
    marker("ex10", "lacuna", 4, "middle", "moderate", "brown"),
    marker("ex11", "ring", 4, "outer", "light", "orange"),
    marker("ex12", "pigment", 11, "outer", "light", "deep"),
    marker("ex13", "radial", 7, "middle", "moderate", "brown"),
    marker("ex14", "fiber", 1, "inner", "light", "white"),
    // ex15 cloudy 3 outer — faded
    marker("ex2a", "lacuna", 6, "middle", "moderate", "brown"), // new
    marker("ex2b", "ring", 10, "outer", "light", "yellow"), // new
  ],
  profile: { ...PROFILE_1, meanLum: 105, scurf: "faint" },
  auto: {
    overallConfidence: "moderate",
    notes: [
      "Follow-up scan — the Timeline compares it with the October 15 scan automatically.",
      "Pupil and iris edge located automatically; the iris was unrolled onto the chart and read sector by sector.",
      "Contrast was enhanced before detection (gamma lift + local stretch), which suits this darker iris tone.",
    ],
    qualityNotes: [],
  },
  unlocked: true,
};

export const EXAMPLE_SCAN_3: ScanRecord = {
  id: "example-full-reading-3",
  createdAt: new Date("2026-11-26T15:30:00Z").getTime(),
  eye: "right",
  color: "brown",
  image: "/demo-iris.jpg",
  baseId: "example-full-reading",
  prevId: "example-full-reading-2",
  markers: [
    marker("ex01", "ring", 8, "middle", "strong", "white"),
    marker("ex02", "lacuna", 8, "middle", "strong", "white"), // stronger + lightened again
    marker("ex03", "cloudy", 9, "middle", "light", "white"),
    marker("ex04", "radial", 5, "inner", "strong", "yellow"),
    marker("ex05", "lacuna", 12, "outer", "light", "deep"),
    marker("ex06", "ring", 12, "middle", "moderate", "yellow"),
    marker("ex07", "pigment", 2, "middle", "strong", "orange"),
    marker("ex09", "cloudy", 6, "inner", "moderate", "white"),
    marker("ex10", "lacuna", 4, "middle", "moderate", "brown"),
    marker("ex11", "ring", 4, "outer", "light", "orange"),
    // ex12 pigment 11 outer — faded
    marker("ex13", "radial", 7, "middle", "moderate", "brown"),
    marker("ex14", "fiber", 1, "inner", "light", "white"),
    marker("ex2a", "lacuna", 6, "middle", "light", "brown"), // weaker than scan 2
    marker("ex2b", "ring", 10, "outer", "light", "yellow"),
    marker("ex3a", "fiber", 3, "middle", "moderate", "yellow"), // new
    marker("ex3b", "cloudy", 8, "outer", "light", "white"), // new
  ],
  profile: { ...PROFILE_1, meanLum: 114, scurf: "faint" },
  auto: {
    overallConfidence: "moderate",
    notes: [
      "Follow-up scan — the Timeline compares it with the November 5 scan automatically.",
      "Pupil and iris edge located automatically; the iris was unrolled onto the chart and read sector by sector.",
      "Contrast was enhanced before detection (gamma lift + local stretch), which suits this darker iris tone.",
    ],
    qualityNotes: [],
  },
  unlocked: true,
};

/** The example's full Timeline chain, oldest → newest. */
export const EXAMPLE_CHAIN: ScanRecord[] = [EXAMPLE_SCAN, EXAMPLE_SCAN_2, EXAMPLE_SCAN_3];
