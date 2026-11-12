// Traditional iridology chart data + report builder — integrated from
// the chart Adam supplied (2026-10-17, classic Jensen-style wall
// chart): left iris and right iris drawn as the practitioner sees
// them, with named areas by clock position and radial band. The app
// now reads findings against THIS chart's labels instead of a generic
// 12-sector map.
//
// IMPORTANT FRAMING: iridology is a traditional practice. Nothing here
// is a medical diagnosis — the report presents what the traditional
// chart associates with each iris area and sign, and the UI carries a
// not-medical-advice disclaimer wherever a report is shown.
//
// Angles are measured as seen in the photo: 0° at 12 o'clock,
// increasing clockwise. Radial bands follow the chart: the inner
// ring around the pupil is the stomach lining / bowel (colon) ring;
// the wide middle band holds the named organs; the outer ring is the
// skin, lymph & circulation (sclerotic coat) area — most named organ
// areas extend into it.

export type EyeSide = "right" | "left";
export type IrisColor = "blue" | "brown" | "mixed";
export type ZoneId = "inner" | "middle" | "outer";
export type SignId = "lacuna" | "pigment" | "radial" | "ring" | "cloudy" | "fiber";

/** The colour tone sampled at a sign, read on the traditional
 *  colour-stage ladder (Williams / Jensen / Liljequist): white is the
 *  acute, over-active end; yellow sub-acute; orange and brown the
 *  chronic, settled end; deep/black the deepest stage. */
export type ToneId = "white" | "yellow" | "orange" | "brown" | "deep";

export interface Marker {
  id: string;
  sign: SignId;
  sector: number; // clock position 1..12
  zone: ZoneId;
  x: number; // 0..1 across the square image
  y: number; // 0..1 down the square image
  /** Set when the automatic reader placed this marker. */
  auto?: boolean;
  /** Detection confidence for auto-placed markers. */
  confidence?: "strong" | "moderate" | "light";
  /** Colour tone sampled at the sign (auto-read scans). */
  tone?: ToneId;
  /** Lacuna silhouette classification (auto-read scans), in the old
   *  chart dictionaries' vocabulary — set only when the blob's shape
   *  reads clearly; absent means the shape was not classified. */
  shape?: LacunaShape;
}

/** Whole-iris measures taken by the automatic reader: constitution
 *  grade from fibre density, pupil proportion, outer-rim and
 *  stomach-ring readings, and the mean iris brightness the Timeline
 *  uses to track whole-eye lightening/darkening over time. */
export interface IrisProfile {
  /** Jensen-style density grade: 1 = finest, strongest weave; 10 = most open. */
  constitutionGrade: number;
  /** Pupil radius as a fraction of iris radius. */
  pupilRatio: number;
  /** Mean annulus luminance (0..255) on the raw photo. */
  meanLum: number;
  /** Dark rim at the outer edge (under-active skin elimination), by breadth. */
  scurf: "none" | "faint" | "medium" | "broad";
  /** Opaque white ring at the outer border, or a grey arc across the top. */
  outerRing: "none" | "white" | "grey-arc";
  /** The white outer ring reads thickest across the top (head area). */
  ringHeadNote?: boolean;
  /** Stomach-ring tone just outside the pupil. */
  stomachTone: "bright" | "halo" | "brown" | null;
  /** Measured fibre texture (GLCM statistics on the unwrapped
   *  strip): a number behind the fine-silk vs open-weave claim. */
  texture?: {
    contrast: number;
    energy: number;
    homogeneity: number;
    label: "fine" | "mixed" | "coarse";
  };
  /** Pupil shape classification (oval/flat spot), from the pupil
   *  blob's boundary radii — the pupil-abnormality measures. */
  pupilShape?: PupilShape;
}

export interface ScanRecord {
  id: string;
  createdAt: number;
  eye: EyeSide;
  color: IrisColor;
  image: string; // aligned iris photo (data URL)
  markers: Marker[];
  /** Secret link token: the printed report's QR code points at
   *  /?scan=<id>&t=<token>; whoever holds it can view this reading
   *  and buy the full version without an account. */
  accessToken?: string;
  /** Timeline: id of the ORIGINAL reading this scan follows up
   *  (the chain root). Absent on a first scan. */
  baseId?: string;
  /** Timeline: id of the scan this one was taken as a follow-up to
   *  (its immediate predecessor in the chain). */
  prevId?: string;
  /** Person grouping (Adam, 2026-11-01): a "reading" in My
   *  readings is ONE PERSON — both irises and every follow-up
   *  belong to that person. personId is the id of the person's
   *  first scan; absent means the scan is its own person. One
   *  full unlock covers the whole person, both irises included. */
  personId?: string;
  /** The person's name, added by the user to the reading. Stored
   *  on every scan of the person so any copy carries it. */
  personName?: string;
  /** Full-report unlock (paid). Set ONLY from server responses —
   *  the server keeps the authoritative flag in its own column and
   *  never accepts it from a client payload. */
  unlocked?: boolean;
  /** The $3 basic tier (Adam, 2026-11-05): the top signs in full
   *  with the body map; the rest of the full reading stays locked.
   *  Server-authoritative (a column merged at read), like unlocked. */
  basic?: boolean;
  /** Whole-iris measures from the automatic reader (newer scans). */
  profile?: IrisProfile;
  /** Automatic-reading summary (present on auto-read scans). */
  auto?: {
    overallConfidence: "high" | "moderate" | "low";
    notes: string[];
    qualityNotes: string[];
  };
}

/** Body-map region ids — the areas of the interactive body figure. */
export type BodyRegion =
  | "head" | "face" | "throat" | "neck" | "chest" | "heart"
  | "liver" | "spleen" | "bowel" | "kidneys" | "pelvis"
  | "arms" | "legs" | "spine" | "upperback";

export const BODY_REGION_LABELS: Record<BodyRegion, string> = {
  head: "Head & brain",
  face: "Face, eye & ear",
  throat: "Throat, thyroid & voice box",
  neck: "Neck & lymph glands",
  chest: "Lungs, breast & ribs",
  heart: "Heart & aorta",
  liver: "Liver & gall bladder",
  spleen: "Spleen",
  bowel: "Stomach & bowel (colon)",
  kidneys: "Kidneys & lower back",
  pelvis: "Pelvis, groin & reproductive",
  arms: "Arm & hand",
  legs: "Leg, knee & foot",
  spine: "Spine",
  upperback: "Upper back, scapula & esophagus",
};

interface ChartArea {
  label: string;
  region: BodyRegion;
}

/** Named organ-band areas by clock sector, transcribed from Adam's
 *  chart for each iris (organ band = the chart's wide middle band). */
const ORGAN_AREAS: Record<EyeSide, Record<number, ChartArea>> = {
  right: {
    12: { label: "Brain (physiological / psychological) & hair/scalp", region: "head" },
    1: { label: "Face, eye & ear", region: "face" },
    2: { label: "Tonsils, larynx & thyroid", region: "throat" },
    3: { label: "Voice box & esophagus; scapula", region: "throat" },
    4: { label: "Spine (upper & middle)", region: "spine" },
    5: { label: "Kidney & lower back", region: "kidneys" },
    6: { label: "Pelvis, groin & ureter", region: "pelvis" },
    7: { label: "Hand & arm; gall bladder", region: "arms" },
    8: { label: "Liver & diaphragm", region: "liver" },
    9: { label: "Lungs (upper & lower), breast & ribs", region: "chest" },
    10: { label: "Shoulder & bronchials", region: "chest" },
    11: { label: "Neck & thyroid", region: "neck" },
  },
  left: {
    12: { label: "Brain (psychological / physiological) & hair/scalp", region: "head" },
    1: { label: "Neck & lymph glands", region: "neck" },
    2: { label: "Heart & aorta; shoulder & bronchials", region: "heart" },
    3: { label: "Lungs (upper & lower), breast & ribs", region: "chest" },
    4: { label: "Spleen & diaphragm; arm & hand", region: "spleen" },
    5: { label: "Ureter, groin & reproductive (testes/ovary)", region: "pelvis" },
    6: { label: "Kidney; leg, knee & foot; pelvis", region: "kidneys" },
    7: { label: "Bladder & uterus/prostate; spine (lower)", region: "pelvis" },
    8: { label: "Spine (middle & lower) & sacrum", region: "spine" },
    9: { label: "Esophagus, scapula & clavicle", region: "upperback" },
    10: { label: "Thyroid, larynx & tonsils", region: "throat" },
    11: { label: "Face, eye & ear; jaw & mouth", region: "face" },
  },
};

/** Bowel-ring sections by sector (inner band), from the chart:
 *  transverse colon across the top; ascending colon and the small
 *  intestine down the sides (mirrored between the irises); descending
 *  & sigmoid colon along the bottom. */
const BOWEL_AREAS: Record<EyeSide, Record<number, string>> = {
  right: {
    12: "Transverse colon", 1: "Transverse colon", 11: "Transverse colon",
    8: "Ascending colon", 9: "Ascending colon", 10: "Ascending colon",
    2: "Small intestine", 3: "Small intestine", 4: "Small intestine",
    5: "Descending & sigmoid colon", 6: "Descending & sigmoid colon", 7: "Descending & sigmoid colon",
  },
  left: {
    12: "Transverse colon", 1: "Transverse colon", 11: "Transverse colon",
    3: "Ascending colon", 4: "Ascending colon", 5: "Ascending colon",
    8: "Small intestine", 9: "Small intestine", 10: "Small intestine",
    6: "Descending & sigmoid colon", 7: "Descending & sigmoid colon", 2: "Descending & sigmoid colon",
  },
};

/** The chart area a marker falls in, by eye + clock sector + band. */
export function chartAreaFor(eye: EyeSide, sector: number, zone: ZoneId): ChartArea {
  if (zone === "inner") {
    return { label: `Stomach lining & bowel ring — ${BOWEL_AREAS[eye][sector] ?? "colon"}`, region: "bowel" };
  }
  return ORGAN_AREAS[eye][sector] ?? ORGAN_AREAS[eye][12];
}

/** Body-map region for a marker. */
export function bodyRegionFor(eye: EyeSide, m: Pick<Marker, "sector" | "zone">): BodyRegion {
  return chartAreaFor(eye, m.sector, m.zone).region;
}

/** Which clock sectors feed a body region on a given eye (for the
 *  body map's captions and the region details pop-up). Inner-ring
 *  (bowel) markers belong to every sector, so "bowel" is special. */
export function sectorsForRegion(eye: EyeSide, region: BodyRegion): number[] {
  const out: number[] = [];
  for (let s = 1; s <= 12; s++) {
    if (ORGAN_AREAS[eye][s].region === region) out.push(s);
  }
  return out;
}

export const ZONES: Record<ZoneId, { label: string; traditional: string }> = {
  inner: {
    label: "Inner ring (stomach & bowel)",
    traditional:
      "the ring the chart draws around the pupil — the stomach lining and the bowel/colon",
  },
  middle: {
    label: "Middle band (organ areas)",
    traditional:
      "the chart's wide organ band, where each named organ and system has its place",
  },
  outer: {
    label: "Outer ring (skin, lymph & circulation)",
    traditional:
      "the chart's outer ring — skin, lymph and circulation (the sclerotic coat area), where the chart reads how well the body clears and circulates",
  },
};

/** Sign glossary — terminology and readings paraphrased from the
 *  notes printed on Adam's chart (white / dark / black markings,
 *  rings & rosaries, sodium ring, radii solaris, fiber density). */
export const SIGNS: Record<SignId, { label: string; hint: string; traditional: string }> = {
  cloudy: {
    label: "White marking (cloudiness)",
    hint: "A hazy, whitish area or pale lines/dots over the fibers",
    traditional:
      "what the chart calls a white marking — in the form of lines or small dots it is traditionally read as overactivity: congestion, sluggishness, inflammation, or irritation in that area, with the chart's classic themes being to decongest and relax the area (movement, yoga, fasting themes, an alkaline-leaning diet)",
  },
  lacuna: {
    label: "Dark marking (lacuna)",
    hint: "A dark, closed-off patch in the fibers",
    traditional:
      "what the chart calls a dark marking — traditionally read as underactivity, stagnation, or chronic inflammation in that area, an inherited-weakness picture in the traditional reading",
  },
  pigment: {
    label: "Pigment deposit (dark-to-black marking)",
    hint: "A brown/rust or dark spot on the surface",
    traditional:
      "a deposit-type marking — the chart's darkest (black) markings are traditionally read as the deepest picture, including structural shock or deposits the body has stored rather than eliminated",
  },
  radial: {
    label: "Radii solaris (radial furrow)",
    hint: "A dark line radiating outward like a spoke",
    traditional:
      "one of the radial lines the chart names radii solaris — dense, parallel radial fibers are the chart's picture of an inherently strong constitution, while a deep furrow breaks that pattern in its area",
  },
  ring: {
    label: "Nerve ring (contraction ring)",
    hint: "A circular groove ring around the iris",
    traditional:
      "one of the chart's rings — nerve rings look as though pressed into the fibers, and the chart reads them as a person holding a lot of tension in that area, with learning to relax as the classic theme",
  },
  fiber: {
    label: "Fiber separation (honeycomb)",
    hint: "Loose, wavy, separated or honeycomb fibers",
    traditional:
      "separated or honeycomb fibers in the chart's terms — where dense parallel fibers show strength, separation is traditionally read as a weakening of that area of the body",
  },
};

/** Marker colors — every sign gets its own color wherever markers
 *  are drawn on an iris photo (report header, details pop-up). */
export const SIGN_COLORS: Record<SignId, { bg: string; fg: string }> = {
  lacuna: { bg: "#6d28a8", fg: "#ffffff" }, // dark marking — purple
  pigment: { bg: "#b3541e", fg: "#ffffff" }, // pigment deposit — rust brown
  radial: { bg: "#1f6fb2", fg: "#ffffff" }, // radii solaris — blue
  ring: { bg: "#b91c1c", fg: "#ffffff" }, // nerve ring — red
  cloudy: { bg: "#f2f2f2", fg: "#222222" }, // white marking — white
  fiber: { bg: "#1e8a6e", fg: "#ffffff" }, // fiber separation — teal green
};

export const CONSTITUTIONS: Record<IrisColor, { label: string; reading: string }> = {
  blue: {
    label: "Lymphatic constitution (blue / grey iris)",
    reading:
      "In traditional iridology, a blue or grey iris is the lymphatic type: the chart emphasizes the lymph system, the mucous membranes, and elimination through the skin and kidneys. Readings for this type traditionally focus on keeping the lymph moving — hydration, movement, and not overloading the system.",
  },
  brown: {
    label: "Hematogenic constitution (brown iris)",
    reading:
      "In traditional iridology, a brown iris is the hematogenic (blood) type: the chart emphasizes the blood, the liver, and the digestive organs. Readings for this type traditionally focus on the liver's workload and the quality of digestion and elimination.",
  },
  mixed: {
    label: "Biliary constitution (mixed / hazel-green iris)",
    reading:
      "In traditional iridology, a mixed hazel or green-brown iris is the biliary type — a blend of the lymphatic and blood pictures, with traditional emphasis on the liver and gallbladder together with the lymph system and digestion.",
  },
};

/** The traditional colour-stage ladder. A sign's sampled colour says
 *  what STAGE the tradition reads it at: white/bright is acute and
 *  over-active; yellow is sub-acute and settling; orange and brown are
 *  the chronic, settled end; deep/black is the deepest stage. */
export const TONES: Record<
  ToneId,
  { label: string; stage: string; activity: string; swatch: string }
> = {
  white: { label: "White", stage: "Acute", activity: "over-active", swatch: "#f5f1e3" },
  yellow: { label: "Yellow", stage: "Sub-acute", activity: "under-active, settling", swatch: "#e6c93c" },
  orange: { label: "Orange", stage: "Chronic", activity: "under-active, deeper-settling", swatch: "#dd7f22" },
  brown: { label: "Brown", stage: "Chronic", activity: "under-active, well settled", swatch: "#8a5a24" },
  deep: { label: "Deep", stage: "Deepest", activity: "the deepest traditional stage", swatch: "#2a251f" },
};

/** Depth on the stage ladder (white 0 → deep 3); orange and brown are
 *  both the chronic stage. Used by the Timeline: a matched sign whose
 *  depth drops has lightened a stage. */
export function toneDepth(t: ToneId): number {
  return t === "white" ? 0 : t === "yellow" ? 1 : t === "deep" ? 3 : 2;
}

function rgbHue(r: number, g: number, b: number): number {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  if (d === 0) return 0;
  let h: number;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

function rgbLum(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Classify a sampled colour into the traditional tone ladder,
 *  relative to the iris's own base colour (a darkening in a blue iris
 *  reads on the same ladder as a darkening in a brown one). */
export function classifyTone(
  r: number,
  g: number,
  b: number,
  base: { r: number; g: number; b: number },
): ToneId {
  const y = rgbLum(r, g, b) / 255;
  const rel = y - rgbLum(base.r, base.g, base.b) / 255;
  const mx = Math.max(r, g, b);
  const sat = mx === 0 ? 0 : (mx - Math.min(r, g, b)) / mx;
  const hue = rgbHue(r, g, b);
  const warm = hue >= 12 && hue <= 78;
  if (y < 0.13 || (rel < -0.3 && y < 0.3)) return "deep";
  if (rel > 0.15 && sat < 0.42) return "white";
  if (warm) {
    if (y >= 0.5) return "yellow";
    if (y >= 0.33) return "orange";
    return "brown";
  }
  if (rel > 0.05) return sat < 0.3 ? "white" : "yellow";
  if (rel < -0.12) return "brown";
  return rel >= 0 ? "yellow" : "brown";
}

/** One traditional stage sentence for a finding, from its tone. */
export function stageSentence(tone: ToneId): string {
  switch (tone) {
    case "white":
      return "The tone sampled here reads white — the acute end of the traditional colour scale: the active, over-working stage, the one the classic texts expect to settle first as an area calms.";
    case "yellow":
      return "The tone sampled here reads yellow — the sub-acute stage on the traditional colour scale: past the first flare and settling, traditionally read as under-functioning in this area, with the elimination organs (kidneys especially) carrying the theme.";
    case "orange":
      return "The tone sampled here reads orange — the chronic stage on the traditional colour scale: a pattern the tradition reads as settled in over time rather than recent.";
    case "brown":
      return "The tone sampled here reads brown — the chronic, well-settled end of the traditional colour scale, carrying the liver-support theme the classic texts pair with brown tones.";
    case "deep":
      return "The tone sampled here reads deep — the darkest end of the traditional colour scale, read as the most settled, longest-standing stage of all.";
  }
}

/** In Williams' teaching the left iris carries the maternal line and
 *  the right iris the paternal line for inherited signs. */
export function familyLine(eye: EyeSide): string {
  return eye === "left" ? "your mother's (maternal) line" : "your father's (paternal) line";
}

/** The inherited side of a reading: lacunae (split fibres = inherited
 *  weakness in this teaching) plus pigment split the Liljequist way —
 *  heavy dark patches read as inherited settlements, smaller bright
 *  deposits as acquired in one's own lifetime. */
export function inheritedFindings(scan: Pick<ScanRecord, "markers">): {
  lacunae: Marker[];
  settlements: Marker[];
  deposits: Marker[];
} {
  return {
    lacunae: scan.markers.filter((m) => m.sign === "lacuna"),
    settlements: scan.markers.filter(
      (m) => m.sign === "pigment" && (m.tone === "brown" || m.tone === "deep"),
    ),
    deposits: scan.markers.filter(
      (m) => m.sign === "pigment" && m.tone != null && m.tone !== "brown" && m.tone !== "deep",
    ),
  };
}

/** Whether an inherited-area sign currently reads ACTIVE (acute or
 *  settling tones) versus quiet (the chronic/deep tones). */
export function toneIsActive(tone?: ToneId): boolean {
  return tone === "white" || tone === "yellow";
}


/** The temperament half of the traditional reading — the pairing in
 *  the title of Dorothy Hall's 1981 book (health AND personality),
 *  and one of the uses Williams names for iridology. Sketched only
 *  from measures the reader already takes: constitution colour,
 *  Jensen's fibre grade (1 = finest, strongest weave; 10 = most
 *  open), fibre texture, nerve-ring count, pupil pattern, and the
 *  dominant colour stage. Each line balances a gift with its
 *  watch-side, in traditional temperament language — a sketch for
 *  reflection, never a psychological verdict. */
export function temperamentLines(
  scan: Pick<ScanRecord, "color" | "markers" | "profile">,
): string[] {
  const out: string[] = [];
  const p = scan.profile;
  if (scan.color === "blue") {
    out.push(
      "Yours is the lymphatic (blue) type — in the tradition's shorthand, the feeling-led temperament: responsive and intuitive, taking the temperature of a room before deciding anything.",
    );
  } else if (scan.color === "brown") {
    out.push(
      "Yours is the hematogenic (brown) type — in the tradition's shorthand, the doing-led temperament: practical, grounded and physical, thinking by moving and making.",
    );
  } else {
    out.push(
      "Yours is the mixed (biliary) type — in the tradition's shorthand, a blend: part feeling-led, part doing-led, shifting with what the moment asks.",
    );
  }
  const grade = p?.constitutionGrade;
  if (typeof grade === "number") {
    if (grade <= 3) {
      out.push(
        `Your fibres run fine and close — grade ${grade} on Jensen's 1–10 density scale — the build the tradition pairs with a sturdy, enduring temperament: steady under load, slow to rattle, with deep reserves. Its watch-side is a habit of pushing through when rest would serve better.`,
      );
    } else if (grade <= 5) {
      out.push(
        `Your fibre weave sits near the traditional average — grade ${grade} on Jensen's 1–10 density scale — read as a balanced temperament: adaptable, neither brittle nor blunt, recovering at a natural pace when life is steady.`,
      );
    } else if (grade <= 7) {
      out.push(
        `Your fibres run more openly — grade ${grade} on Jensen's 1–10 density scale — the weave the tradition pairs with a sensitive, responsive temperament: you register what is happening around you early and feel it fully. Its watch-side is pacing: intensity in bursts, with real recovery in between.`,
      );
    } else {
      out.push(
        `Your fibres run very openly — grade ${grade} on Jensen's 1–10 density scale, the delicate end of it — and the temperament the tradition pairs with it is the finely tuned one: perceptive and reactive, easily over-stimulated. Gentle consistency suits this build far better than force.`,
      );
    }
  }
  const tex = p?.texture?.label;
  if (tex === "fine") {
    out.push(
      "The fibre texture itself measures fine — in the traditional shorthand, a quick, precise, detail-first way of working.",
    );
  } else if (tex === "coarse") {
    out.push(
      "The fibre texture itself measures coarse — in the traditional shorthand, a broad-stroke way of working: big energy, and less patience for fine detail.",
    );
  }
  const rings = scan.markers.filter((m) => m.sign === "ring").length;
  if (rings === 1 || rings === 2) {
    out.push(
      `${rings === 1 ? "A nerve ring crosses" : "Two nerve rings cross"} your iris — the classic picture of someone who holds tension rather than showing it: driven and contained, keeping it together. The tradition's standing advice for this pattern is deliberate unwinding, before the body asks louder.`,
    );
  } else if (rings >= 3) {
    out.push(
      `${rings} nerve rings circle your iris — Jensen reads ring upon ring as a high stress load carried in the system, a wired, high-revving temperament. In this picture rest is not a reward; it is the maintenance the machine runs on.`,
    );
  }
  const pr = p?.pupilRatio;
  if (typeof pr === "number" && pr > 0) {
    if (pr < 0.27) {
      out.push(
        "Your pupil reads small and tight — the nervous-tension pattern: intense focus, a mind that stays switched on. For this temperament, switching off is a skill to practise on purpose.",
      );
    } else if (pr > 0.44) {
      out.push(
        "Your pupil reads wide — the nerve-depletion pattern in this tradition: a system that has been giving out more than it takes in. The temperament note is recovery first, stimulation later.",
      );
    }
  }
  const tones = scan.markers
    .map((m) => m.tone)
    .filter((t): t is ToneId => Boolean(t));
  if (tones.length > 0) {
    const counts = new Map<ToneId, number>();
    for (const t of tones) counts.set(t, (counts.get(t) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    if (top === "white") {
      out.push(
        "Most of your signs read at the bright, acute stage — a reactive, quick-firing pattern: things flare fast and, in this tradition, settle fast too.",
      );
    } else if (top === "yellow") {
      out.push(
        "Most of your signs sit at the yellow, settling stage — a slower gear at the moment: not flaring, but running a little under par.",
      );
    } else if (top === "deep") {
      out.push(
        "Most of your signs read at the deepest stage — the longest-settled pattern of all: unhurried and entrenched, changing at its own pace and no one else's.",
      );
    } else {
      out.push(
        "Most of your signs read at the settled, chronic stages — a slow-burn pattern: nothing here is new or sudden; this is the long-haul version of the picture.",
      );
    }
  }
  return out;
}

/** ── Shape classification (Adam, 2026-11-04) ─────────────────────
 *  The old chart dictionaries name lacuna silhouettes (the WEAKNESS
 *  SIGNS page: leaf, lance, diamond, butterfly, medusa, closed vs
 *  opened lesions) and list pupil abnormalities (oval pupils, flat
 *  spots). These pure classifiers turn measured blob geometry into
 *  that vocabulary. Both abstain — returning undefined / "round" —
 *  unless the geometry reads clearly, so a noisy phone photo never
 *  earns a confident shape it does not have. */

export type LacunaForm = "leaf" | "lance" | "diamond" | "butterfly" | "round";

export interface LacunaShape {
  form: LacunaForm;
  /** True when the hollow reaches toward the pupil instead of
   *  sitting closed within the fibres (the dictionaries' opened
   *  lesion). */
  opened: boolean;
}

export const LACUNA_FORM_LABEL: Record<LacunaForm, string> = {
  leaf: "leaf lacuna",
  lance: "lance lacuna",
  diamond: "diamond lacuna",
  butterfly: "butterfly lacuna",
  round: "round lacuna",
};

export function lacunaShapeSentence(shape: LacunaShape): string {
  const base: Record<LacunaForm, string> = {
    leaf: "Its silhouette is the one the old chart dictionaries call a leaf lacuna — pointed at both ends like a leaf, the classic lesion shape.",
    lance: "Its silhouette is the one the old chart dictionaries call a lance lacuna — long and slender like a lance head (the torpedo lesion of the older charts).",
    diamond: "Its silhouette is the one the old chart dictionaries call a diamond lacuna — widest at its middle and pointed at both ends.",
    butterfly: "Its silhouette is the one the old chart dictionaries call a butterfly lacuna — two lobes pinched together at the middle, like wings.",
    round: "Its silhouette is the plain round lacuna of the old chart dictionaries — a simple oval hollow in the fibres.",
  };
  return (
    base[shape.form] +
    (shape.opened
      ? " It opens toward the pupil rather than sitting closed in the fibres — the dictionaries' opened lesion."
      : " It sits closed within the fibres — the dictionaries' closed lesion.")
  );
}

/** Classify a lacuna from its blob geometry in the unwrapped strip:
 *  `elong` is the physical radial/angular span ratio, `rowWidths`
 *  the angular cell count per radial row (inner → outer), and
 *  `innerFrac` how close the blob starts to the pupil edge (0..1). */
export function classifyLacunaShape(input: {
  elong: number;
  rowWidths: number[];
  innerFrac: number;
}): LacunaShape | undefined {
  const w = input.rowWidths;
  if (w.length < 4) return undefined;
  const max = Math.max(...w);
  if (!(max > 0)) return undefined;
  const at = (f: number) =>
    w[Math.min(w.length - 1, Math.max(0, Math.round(f * (w.length - 1))))] / max;
  const w10 = at(0.08);
  const w20 = at(0.18);
  const w50 = at(0.5);
  const w80 = at(0.82);
  const w90 = at(0.92);
  const fullness = w.reduce((a, b) => a + b, 0) / w.length / max;
  const opened = input.innerFrac <= 0.1;
  // Butterfly: two full shoulders pinched at the middle.
  if (w50 <= 0.55 && w20 >= 0.75 && w80 >= 0.75) return { form: "butterfly", opened };
  const endTaper = Math.max(w10, w90);
  if (endTaper <= 0.5) {
    // Pointed at both ends: a sharp straight taper reads diamond;
    // a longer body reads lance, then leaf.
    if (fullness <= 0.58 && input.elong < 1.7) return { form: "diamond", opened };
    if (input.elong >= 2.3) return { form: "lance", opened };
    if (input.elong >= 1.3) return { form: "leaf", opened };
  }
  if (
    input.elong >= 0.65 &&
    input.elong <= 1.55 &&
    fullness >= 0.68 &&
    Math.min(...w) / max >= 0.4
  )
    return { form: "round", opened };
  if (input.elong >= 1.3 && endTaper <= 0.72) return { form: "leaf", opened };
  return undefined;
}

export interface PupilShape {
  form: "round" | "oval";
  /** Long-axis family when oval. */
  axis?: "tall" | "wide" | "tilted";
  /** Long-axis direction, degrees clockwise from 12 o'clock (0..180). */
  axisDeg?: number;
  /** Boundary-radius ratio (p90/p10) behind the oval call. */
  aspect?: number;
  /** Clock hour the pupil's edge flattens toward, when a clear flat
   *  spot is measured. */
  flatHour?: number;
}

/** Classify the pupil from its boundary radii in equal clock bins
 *  (bin 0 = 12 o'clock, clockwise). Conservative by design: an oval
 *  needs a second-harmonic ellipticity of 0.07+ (a boundary-radius
 *  ratio of about 1.16), and a flat spot needs a contiguous ~45°+
 *  arc sitting well inside the median radius. */
export function classifyPupilShape(radii: number[]): PupilShape {
  const n = radii.length;
  if (n < 12) return { form: "round" };
  const sorted = [...radii].sort((a, b) => a - b);
  const median = sorted[Math.floor(n / 2)] || 1;
  const thresh = median * 0.86;
  let bestStart = -1;
  let bestLen = 0;
  let runStart = -1;
  let runLen = 0;
  for (let i = 0; i < n * 2; i++) {
    if (radii[i % n] < thresh) {
      if (runStart < 0) {
        runStart = i;
        runLen = 1;
      } else runLen++;
      if (runLen > bestLen) {
        bestLen = runLen;
        bestStart = runStart;
      }
    } else {
      runStart = -1;
      runLen = 0;
    }
  }
  let flatHour: number | undefined;
  if (bestLen >= Math.ceil(n / 8) && bestLen < n / 2) {
    const mid = (bestStart + bestLen / 2) % n;
    const hour = Math.round((mid / n) * 12) % 12;
    flatHour = hour === 0 ? 12 : hour;
  }
  // Ellipticity from the second harmonic of the radius profile —
  // a true oval is a clean cos-2 wave, while a single flat dent is
  // broad-spectrum and barely moves it, so a dent alone never
  // earns an "oval" call.
  let sc = 0;
  let ss = 0;
  let sr = 0;
  for (let i = 0; i < n; i++) {
    const th = ((i + 0.5) / n) * Math.PI * 2;
    sc += radii[i] * Math.cos(2 * th);
    ss += radii[i] * Math.sin(2 * th);
    sr += radii[i];
  }
  const e = sr > 0 ? (2 * Math.hypot(sc, ss)) / sr : 0;
  if (e >= 0.07) {
    const axisDegRaw = (0.5 * Math.atan2(ss, sc) * 180) / Math.PI;
    const axisDeg = ((axisDegRaw % 180) + 180) % 180;
    const axis = axisDeg <= 30 || axisDeg >= 150 ? "tall" : axisDeg >= 60 && axisDeg <= 120 ? "wide" : "tilted";
    const aspect = (1 + e) / (1 - e);
    return {
      form: "oval",
      axis,
      axisDeg: Math.round(axisDeg),
      aspect: Math.round(aspect * 100) / 100,
      ...(flatHour ? { flatHour } : {}),
    };
  }
  return { form: "round", ...(flatHour ? { flatHour } : {}) };
}

/** Constitution grade wording (Jensen's 1–10 density scale). */
export function constitutionGradeText(grade: number): { label: string; note: string } {
  if (grade <= 3) {
    return {
      label: "Strong — a fine, close fibre weave",
      note: "On Jensen's 1–10 density scale this iris reads at the strong end (grade " +
        grade +
        "): the classic picture of a constitution that holds nutrients well, clears waste readily, and recovers quickly.",
    };
  }
  if (grade <= 5) {
    return {
      label: "Sound — an average-to-good weave",
      note: "On Jensen's 1–10 density scale this iris reads grade " + grade +
        " — around the traditional average (the texts put the average iris at 5): a workable constitution that responds well to steady habits.",
    };
  }
  if (grade <= 7) {
    return {
      label: "Open weave — a more delicate constitution",
      note: "On Jensen's 1–10 density scale this iris reads grade " + grade +
        ": the fibres sit more openly, which the tradition reads as a more delicate constitution — slower to recover, and better served by steady support than by intensity.",
    };
  }
  return {
    label: "Very open weave — the most delicate reading",
    note: "On Jensen's 1–10 density scale this iris reads grade " + grade +
      ": a coarse, open weave, the end of the scale the traditional texts read as the most delicate constitution of all — pacing, rest, and gentle consistency matter most here.",
  };
}

/** Whole-iris observations from the reader's profile measures, in
 *  traditional language (scurf rim, outer ring/arc, stomach ring,
 *  pupil size), plus the lymphatic rosary read from the markers. */
export function wholeIrisNotes(scan: Pick<ScanRecord, "profile" | "markers">): string[] {
  const p = scan.profile;
  const out: string[] = [];
  if (!p) {
    // No profile (older scan): the rosary can still be read from the
    // markers alone, below.
  } else {
  if (p.scurf !== "none") {
    out.push(
      `Scurf rim: a ${p.scurf === "broad" ? "broad" : p.scurf} dark rim runs around the outer edge of the iris — the classic sign of under-active elimination through the skin. The traditional answers are the skin's own: sweating through exercise or sauna, dry brushing, and not overloading the skin with heavy products. (Liljequist grades this rim by its breadth — ${p.scurf} here.)`,
    );
  }
  if (p.outerRing === "white") {
    out.push(
      "An opaque white ring sits at the very border of the iris — the ring the tradition calls the sodium or cholesterol ring, read as a mineral-balance theme that is considered diet-changeable: less added salt and fewer heavy, processed fats, more whole foods.",
    );
    if (p.ringHeadNote) {
      out.push(
        "That ring reads thickest across the top of the iris — the head area — where the chart adds a memory theme: in the traditional reading, a heavy sodium ring over the head area is paired with foggy memory and mental tiredness, and answers to the same salt-and-hydration changes, plus sleep.",
      );
    }
  } else if (p.outerRing === "grey-arc") {
    out.push(
      "A grey, slightly metallic arc crosses the top of the iris rather than a full white ring — the tradition distinguishes this arcus from the cloudy white ring of age and reads it with the brain-area circulation theme: movement, circulation, and not smoking are its classic supports.",
    );
  }
  if (p.stomachTone === "bright") {
    out.push(
      "The stomach ring just outside the pupil reads very bright — the classic over-acid stomach pattern in this tradition: smaller meals, thorough chewing, and easing back on very acidic, spicy, or rushed eating.",
    );
  } else if (p.stomachTone === "halo") {
    out.push(
      "A light halo tones the stomach ring just outside the pupil — the classic under-acid pattern in this tradition: the digestive-fire theme, answered traditionally with unhurried meals, bitter tastes before eating, and not diluting meals with large drinks.",
    );
  } else if (p.stomachTone === "brown") {
    out.push(
      "The stomach ring carries a brown, settled tone — read traditionally as a longer-standing digestive pattern rather than a passing one, with the liver-support theme alongside it.",
    );
  }
  if (p.pupilRatio > 0 && p.pupilRatio < 0.27) {
    out.push(
      "The pupil reads small and tight relative to the iris — the nervous-tension pattern in this tradition, pairing with the nerve-ring theme: rest and deliberate unwinding are part of this reading.",
    );
  } else if (p.pupilRatio > 0.44) {
    out.push(
      "The pupil reads wide relative to the iris — the nerve-depletion pattern in this tradition: a system running on empty, where sleep and recovery outrank stimulation.",
    );
  }
  if (p.pupilShape?.form === "oval") {
    const axisWord =
      p.pupilShape.axis === "tall"
        ? "a tall oval"
        : p.pupilShape.axis === "wide"
          ? "a wide oval"
          : "a tilted oval";
    out.push(
      `The pupil itself is ${axisWord} rather than round — an oval pupil is one of the pupil abnormalities the old chart dictionaries list, read in this tradition as a nervous-system stress pattern: the system bracing rather than resting.`,
    );
  }
  if (p.pupilShape?.flatHour) {
    out.push(
      `The pupil's edge flattens toward ${p.pupilShape.flatHour} o'clock — the tradition reads a flat spot on the pupil as a stress location, the nerve supply bracing in the direction the flat faces.`,
    );
  }
  }
  // Lymphatic rosary: small cloud-like white spots beaded around the
  // outer band — the "string of pearls" the chart's rings entry and
  // Jensen both name. Read from the markers: at least four outer-band
  // white markings spread across at least four clock sectors.
  const beads = scan.markers.filter((m) => m.sign === "cloudy" && m.zone === "outer");
  const beadSectors = new Set(beads.map((m) => m.sector));
  if (beads.length >= 4 && beadSectors.size >= 4) {
    const toned = beads.filter((m) => m.tone);
    const bright = toned.filter((m) => m.tone === "white").length;
    const toneClause =
      toned.length === 0
        ? ""
        : bright >= toned.length / 2
          ? " The beads read mostly bright — the acute, recent end of the scale."
          : " The beads read mostly in the settled yellow-brown tones — a longer-standing pattern.";
    out.push(
      `Lymphatic rosary: a beaded string of ${beads.length} small white spots runs around the outer band of the iris — the "string of pearls" in the classic texts, read as the lymph system working under load.${toneClause} The traditional answers are the lymph's own: daily movement, steady hydration, and not overloading the system.`,
    );
  }
  return out;
}

/** Body systems for the Overview's pattern summary. */
export const BODY_SYSTEMS: Array<{ id: string; label: string; regions: BodyRegion[] }> = [
  { id: "digestive", label: "Digestion & bowel", regions: ["bowel", "liver"] },
  { id: "breathing", label: "Breathing & chest", regions: ["chest"] },
  { id: "circulation", label: "Heart & circulation", regions: ["heart"] },
  { id: "elimination", label: "Elimination — kidneys, spleen & lymph", regions: ["kidneys", "spleen", "neck"] },
  { id: "glands", label: "Glands, throat & head", regions: ["throat", "head", "face"] },
  { id: "structure", label: "Structure — spine, back & limbs", regions: ["spine", "upperback", "arms", "legs"] },
  { id: "pelvis", label: "Pelvis & reproductive", regions: ["pelvis"] },
];

/** Per-system sign counts with the dominant traditional stage. */
export function systemSummary(
  scan: Pick<ScanRecord, "eye" | "markers">,
): Array<{ label: string; count: number; dominantStage: string | null }> {
  const out: Array<{ label: string; count: number; dominantStage: string | null }> = [];
  for (const sys of BODY_SYSTEMS) {
    const ms = scan.markers.filter((m) => sys.regions.includes(bodyRegionFor(scan.eye, m)));
    if (ms.length === 0) continue;
    const depths = ms
      .filter((m) => m.tone)
      .map((m) => toneDepth(m.tone as ToneId))
      .sort((a, b) => a - b);
    let dominantStage: string | null = null;
    if (depths.length > 0) {
      const mid = depths[Math.floor(depths.length / 2)];
      dominantStage = mid === 0 ? "Acute" : mid === 1 ? "Sub-acute" : mid === 3 ? "Deepest" : "Chronic";
    }
    out.push({ label: sys.label, count: ms.length, dominantStage });
  }
  return out.sort((a, b) => b.count - a.count);
}

export interface Finding {
  markerId: string;
  title: string;
  body: string;
  /** Traditional colour-stage sentence for this sign's sampled tone. */
  stageNote?: string;
  /** Lacuna silhouette sentence (dictionary vocabulary), when the
   *  reader classified the shape. */
  shapeNote?: string;
}

export function buildFindings(scan: Pick<ScanRecord, "eye" | "color" | "markers">): Finding[] {
  return scan.markers.map((m) => {
    const sign = SIGNS[m.sign];
    const area = chartAreaFor(scan.eye, m.sector, m.zone);
    const zone = ZONES[m.zone];
    const confidenceNote =
      m.auto && m.confidence
        ? m.confidence === "strong"
          ? " The automatic reader found this sign clearly defined."
          : m.confidence === "moderate"
            ? " The automatic reader found this sign with moderate definition."
            : " The automatic reader found only a light indication of this sign — treat it as a hint, not a headline."
        : "";
    // The finding body says what the sign MEANS (Adam, 2026-11-01:
    // the old "It sits in the … band, which covers …" zone
    // boilerplate is gone) — position sentence first, then the
    // sign's traditional meaning as its own sentence.
    const meaning = sign.traditional.charAt(0).toUpperCase() + sign.traditional.slice(1);
    return {
      markerId: m.id,
      title: `${sign.label} — ${area.label} (${m.sector} o'clock, ${zone.label.toLowerCase()})`,
      body: `On the chart, the ${m.sector} o'clock position in this band is ${area.label}. ${meaning}.${confidenceNote}`,
      ...(m.tone ? { stageNote: stageSentence(m.tone) } : {}),
      ...(m.sign === "lacuna" && m.shape ? { shapeNote: lacunaShapeSentence(m.shape) } : {}),
    };
  });
}

export function zoneSummary(scan: Pick<ScanRecord, "markers">): Array<{ zone: ZoneId; count: number }> {
  const counts: Record<ZoneId, number> = { inner: 0, middle: 0, outer: 0 };
  for (const m of scan.markers) counts[m.zone] += 1;
  return (Object.keys(counts) as ZoneId[])
    .map((zone) => ({ zone, count: counts[zone] }))
    .filter((z) => z.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function generalNotes(scan: Pick<ScanRecord, "markers" | "color">): string[] {
  const notes: string[] = [];
  const zones = zoneSummary(scan);
  const dominant = zones[0]?.zone;
  if (dominant === "inner") {
    notes.push("Most of the signs found sit in the stomach & bowel ring. The chart puts digestion at the center of the whole picture — traditional practice starts there: regular meals, thorough chewing, and not eating under stress.");
  } else if (dominant === "middle") {
    notes.push("Most of the signs found sit in the organ band. In the traditional reading, the pattern across the named organ areas matters more than any single sign — look at which areas repeat.");
  } else if (dominant === "outer") {
    notes.push("Most of the signs found sit in the outer ring — skin, lymph and circulation. Traditional practice here emphasizes elimination and movement: hydration, sweating through exercise, and keeping the lymph moving.");
  }
  if (scan.markers.some((m) => m.sign === "ring" || m.sign === "radial")) {
    notes.push("Ring or radial-line signs were found. On the chart, nerve rings are the tension picture — sleep, breathing, and learning to relax are treated as part of the reading, not extras.");
  }
  if (scan.markers.length === 0) {
    notes.push("No signs stood out on this scan, so the report is a constitution reading only.");
  }
  notes.push("In the chart's own framing: iridology reads tendencies in the tissues, not specific diseases — it does not name a disease, and it cannot show things like past surgery or pregnancy. These are traditional interpretations for interest and self-reflection, not a medical diagnosis — for any health concern, see a qualified medical professional.");
  return notes;
}

/** Clock sector (1..12) + zone for a tap point. Coordinates are 0..1
 *  across the square image; irisRadius is the iris radius as a
 *  fraction of the half-width (0..1). Returns null outside the iris. */
export function locate(x: number, y: number, irisRadius: number): { sector: number; zone: ZoneId; rNorm: number } | null {
  const dx = (x - 0.5) * 2;
  const dy = (y - 0.5) * 2;
  const r = Math.sqrt(dx * dx + dy * dy);
  const rNorm = r / irisRadius;
  if (rNorm > 1.02) return null;
  // Clock position: 0deg = 12 o'clock, increasing clockwise.
  let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  const idx = Math.floor(((deg + 15) % 360) / 30); // 0 = 12 o'clock, then clockwise
  const sector = idx === 0 ? 12 : idx;
  const zone: ZoneId = rNorm < 0.38 ? "inner" : rNorm < 0.75 ? "middle" : "outer";
  return { sector, zone, rNorm };
}

/** ── Post-scan reveal picks (Adam, 2026-11-05) ───────────────────
 *  What the reveal sequence shows right after a scan: the areas
 *  the reader is MOST confident about, and the three body areas
 *  carrying the most load ("need help" in the traditional reading —
 *  scored by sign count weighted by detection confidence and
 *  colour-stage depth, deeper and surer signs weighing more). */
export interface RevealAreaPick {
  area: string;
  region: BodyRegion;
  signs: number;
  strongestSign: string;
  score: number;
}

export interface RevealPicks {
  totalSigns: number;
  confident: { area: string; sign: string; region: BodyRegion }[];
  needsSupport: RevealAreaPick[];
}

export function revealPicks(scan: ScanRecord): RevealPicks {
  const weight = (c?: string) =>
    c === "strong" ? 3 : c === "moderate" ? 2 : c === "light" ? 1 : 0;
  const depth = (m: Marker) => toneDepth(m.tone ?? "white");
  const areas = new Map<
    string,
    { area: string; region: BodyRegion; signs: number; score: number; best: Marker }
  >();
  for (const m of scan.markers) {
    const ca = chartAreaFor(scan.eye, m.sector, m.zone);
    const label = ca.label;
    const cur =
      areas.get(label) ?? { area: label, region: ca.region, signs: 0, score: 0, best: m };
    cur.signs += 1;
    cur.score += weight(m.confidence) + depth(m);
    if (
      weight(m.confidence) > weight(cur.best.confidence) ||
      (weight(m.confidence) === weight(cur.best.confidence) &&
        depth(m) > depth(cur.best))
    ) {
      cur.best = m;
    }
    areas.set(label, cur);
  }
  const needsSupport = [...areas.values()]
    .sort((a, b) => b.score - a.score || b.signs - a.signs)
    .slice(0, 3)
    .map((a) => ({
      area: a.area,
      region: a.region,
      signs: a.signs,
      strongestSign: SIGNS[a.best.sign].label,
      score: a.score,
    }));
  const seen = new Set<string>();
  const confident: { area: string; sign: string; region: BodyRegion }[] = [];
  const byConf = [...scan.markers].sort(
    (a, b) => weight(b.confidence) - weight(a.confidence) || depth(b) - depth(a),
  );
  for (const m of byConf) {
    const ca = chartAreaFor(scan.eye, m.sector, m.zone);
    const label = ca.label;
    if (seen.has(label)) continue;
    seen.add(label);
    confident.push({ area: label, sign: SIGNS[m.sign].label, region: ca.region });
    if (confident.length >= 3) break;
  }
  return { totalSigns: scan.markers.length, confident, needsSupport };
}
