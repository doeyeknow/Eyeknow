// Personalized diet themes for the unlocked full report.
//
// Generated from the reading itself: the constitution, which body
// areas hold signs, which zones dominate, and which sign types
// repeat. The content follows the traditional themes printed on the
// iridology chart (alkaline-leaning produce, hydration, decongesting
// greens, less salt, deep-cleansing themes for dark markings) —
// paraphrased and framed as traditional wellness themes, never as
// medical nutrition advice.

import {
  CONSTITUTIONS,
  bodyRegionFor,
  type BodyRegion,
  type ScanRecord,
} from "./chart";

export interface DietSection {
  title: string;
  points: string[];
}

const REGION_DIET: Partial<Record<BodyRegion, { title: string; points: string[] }>> = {
  bowel: {
    title: "For your stomach & bowel ring",
    points: [
      "Build meals around fiber-rich vegetables, legumes, and whole grains so the bowel has something to move.",
      "Add fermented foods (live yogurt, kefir, sauerkraut, kimchi) to support the gut's own culture.",
      "Chew slowly and eat sitting down — the chart's tradition treats rushed, stressed eating as part of the bowel picture.",
      "Start the day with warm water before coffee; keep plain water coming steadily through the day.",
    ],
  },
  liver: {
    title: "For your liver area",
    points: [
      "Bring in bitter greens regularly — dandelion, arugula, endive, mustard greens — the classic liver-theme foods.",
      "Favor cruciferous vegetables (broccoli, cabbage, cauliflower, Brussels sprouts) several times a week.",
      "Go easy on fried foods, heavy fats, and alcohol while this area is highlighted; favor grilled, steamed, and baked.",
      "Beets, carrots, and lemon in water are the chart tradition's everyday liver supports.",
    ],
  },
  spleen: {
    title: "For your spleen area",
    points: [
      "Pair iron-rich plant foods (lentils, beans, spinach) with vitamin C foods (peppers, citrus) at the same meal.",
      "Warm, cooked meals over cold/raw ones for a while — the spleen's traditional theme is warmth and steady energy.",
      "Keep blood-sugar swings small: protein and fiber at each meal rather than sweet snacks alone.",
    ],
  },
  kidneys: {
    title: "For your kidneys & lower back",
    points: [
      "Hydration is the headline here: steady water through the day rather than large amounts at once.",
      "Ease back on added salt and heavily processed foods — the chart's sodium-ring theme is exactly this.",
      "Parsley, cucumber, celery, and watermelon are the tradition's kidney-friendly staples.",
    ],
  },
  chest: {
    title: "For your lungs & chest",
    points: [
      "Warm fluids through the day — herbal teas, broths, warm water with honey and lemon.",
      "Colorful produce daily (peppers, berries, leafy greens, citrus) for the chest's antioxidant theme.",
      "Ginger, garlic, and onions are the kitchen staples the tradition pairs with the lung area.",
    ],
  },
  heart: {
    title: "For your heart area",
    points: [
      "Center meals on whole foods: vegetables, beans, whole grains, and olive oil over processed fats.",
      "Potassium-rich foods (beans, potatoes, bananas, leafy greens) support the heart's traditional picture.",
      "Oily fish or ground flax/chia a few times a week for the omega-3 theme.",
    ],
  },
  throat: {
    title: "For your throat & thyroid area",
    points: [
      "Warm teas (ginger, licorice root, chamomile) and honey soothe the throat's theme.",
      "If you use salt, iodized sea salt in normal cooking amounts covers the thyroid's iodine theme — more is not better.",
      "Avoid very hot, very spicy, or smoke-heavy environments while the throat area is lit.",
    ],
  },
  head: {
    title: "For your head & brain area",
    points: [
      "Omega-3 themes: walnuts, ground flax, chia, or oily fish a few times a week.",
      "Berries and leafy greens daily — the brain area's antioxidant staples in the tradition.",
      "Keep caffeine earlier in the day so sleep can do its repair work at night.",
    ],
  },
  spine: {
    title: "For your spine & back",
    points: [
      "Calcium-and-magnesium foods together: leafy greens, almonds, sesame/tahini, beans, and yogurt or kefir.",
      "Vitamin D through sensible sun and food (oily fish, eggs) supports the bone theme.",
      "Anti-inflammatory staples — turmeric, ginger, olive oil — suit a highlighted back.",
    ],
  },
  pelvis: {
    title: "For your pelvis area",
    points: [
      "Cranberry and plenty of water are the pelvis/bladder tradition's basics.",
      "Zinc-and-protein adequacy: eggs, pumpkin seeds, beans, and seafood if you eat it.",
      "Limit bladder irritants while this area is lit — strong coffee, alcohol, and very spicy food.",
    ],
  },
};

const CONSTITUTION_DIET: Record<ScanRecord["color"], string[]> = {
  blue: [
    "Your lymphatic constitution theme: keep the lymph moving — water, broths, and watery vegetables (cucumber, celery, melon) daily.",
    "Favor lightly cooked over heavy, congesting meals; the tradition pairs this type with decongesting greens and citrus.",
  ],
  brown: [
    "Your hematogenic constitution theme: the liver and blood carry the load — bitter greens, beets, and lemon water are your staples.",
    "Keep heavy fats and large late meals rare; this type traditionally does best with cleaner, simpler plates.",
  ],
  mixed: [
    "Your biliary constitution theme: liver/gallbladder and lymph together — bitter greens plus steady hydration cover both.",
    "Regular meal timing matters for this type; long gaps followed by heavy meals are the pattern to avoid.",
  ],
};

/** Traditional nutrient focus per body area, adapted from Jensen's
 *  chart pairings of organs with vitamins/minerals — expressed as
 *  ordinary foods only, never supplements or remedies. */
const NUTRIENT_FOCUS: Partial<Record<BodyRegion, string>> = {
  bowel:
    "Traditional nutrient focus for this area: fibre and friendly oils — ground flaxseed, chia, oats, beans and lentils, plus leafy greens for magnesium and folate.",
  liver:
    "Traditional nutrient focus for this area: the B-vitamin and bitter-green family — leafy greens, artichoke, dandelion greens, beets, eggs, and whole grains.",
  spleen:
    "Traditional nutrient focus for this area: iron with vitamin C — lentils, beans, and spinach eaten with peppers, tomatoes, or citrus so the iron absorbs.",
  kidneys:
    "Traditional nutrient focus for this area: potassium and clean fluids — cucumber, celery, parsley, melon, and potatoes, with added salt kept light.",
  chest:
    "Traditional nutrient focus for this area: vitamins A and C — peppers, carrots, sweet potato, citrus, and berries, with garlic and ginger as kitchen staples.",
  heart:
    "Traditional nutrient focus for this area: potassium and magnesium — bananas, beans, potatoes, leafy greens, nuts, and garlic.",
  throat:
    "Traditional nutrient focus for this area: iodine from ordinary food — seafood, sea vegetables (kelp, nori), eggs, and dairy, in normal eating amounts.",
  head:
    "Traditional nutrient focus for this area: omega-3s and B vitamins — walnuts, ground flax, oily fish, eggs, oats, and leafy greens.",
  spine:
    "Traditional nutrient focus for this area: calcium and magnesium together — leafy greens, almonds, sesame/tahini, beans, and yogurt or kefir.",
  pelvis:
    "Traditional nutrient focus for this area: zinc and vitamin C — pumpkin seeds, eggs, beans, seafood if you eat it, and peppers or citrus.",
};

export function buildDiet(scan: ScanRecord): DietSection[] {
  const sections: DietSection[] = [];

  sections.push({
    title: `Your constitution — ${CONSTITUTIONS[scan.color].label.split(" (")[0]}`,
    points: CONSTITUTION_DIET[scan.color],
  });

  // Rank body areas by sign weight so the diet follows the reading's
  // own emphases, strongest first (top 4 areas).
  const weights = new Map<BodyRegion, number>();
  for (const m of scan.markers) {
    const region = bodyRegionFor(scan.eye, m);
    const w = m.confidence === "strong" ? 3 : m.confidence === "moderate" ? 2 : 1;
    weights.set(region, (weights.get(region) ?? 0) + w);
  }
  const ranked = Array.from(weights.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([r]) => r)
    .filter((r) => REGION_DIET[r])
    .slice(0, 4);
  for (const region of ranked) {
    const d = REGION_DIET[region];
    if (!d) continue;
    const focus = NUTRIENT_FOCUS[region];
    sections.push(
      focus ? { title: d.title, points: [...d.points, focus] } : d,
    );
  }

  // Sign-pattern themes from the chart's own notes.
  const rings = scan.markers.filter((m) => m.sign === "ring").length;
  const white = scan.markers.filter((m) => m.sign === "cloudy").length;
  const dark = scan.markers.filter((m) => m.sign === "lacuna" || m.sign === "pigment").length;
  const signPoints: string[] = [];
  if (rings >= 2) {
    signPoints.push(
      "Your nerve rings point to tension: magnesium-rich foods (leafy greens, nuts, seeds, cacao) and an evening wind-down — chamomile or lemon-balm tea instead of a late coffee.",
    );
  }
  if (white >= 2) {
    signPoints.push(
      "Your white markings carry the chart's decongest theme: lighter meals for a stretch, green juices or smoothies, and movement after eating.",
    );
  }
  if (dark >= 2) {
    signPoints.push(
      "Your dark markings carry the chart's deep-cleansing theme: a produce-heavy, alkaline-leaning plate (mostly vegetables, greens, and fruit) with generous water, and less meat and processed food for a while.",
    );
  }
  if (signPoints.length > 0) {
    sections.push({ title: "From your sign patterns", points: signPoints });
  }

  sections.push({
    title: "Making it stick",
    points: [
      "Pick two or three changes from the sections above — not all of them — and run them for two weeks.",
      "Shop the perimeter of the store: produce, whole foods, and fermented staples cover most of these themes.",
      "Re-scan after a few weeks of changes; in the traditional reading, the iris picture is the feedback loop.",
    ],
  });

  return sections;
}
