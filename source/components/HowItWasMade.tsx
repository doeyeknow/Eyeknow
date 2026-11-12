"use client";


// "How this app was made" — button + modal for the home view's renamed
// chart section. The steps are the real build history; the sources are
// the traditional texts the detection rules were built from (the code
// measures what those books describe — it was never trained to predict
// disease, and disease prediction was deliberately left out).
const STEPS: { title: string; body: string }[] = [
  {
    title: "Studied the traditional literature first",
    body: "Before any code, the classic iridology texts were read and digested — Liljequist, Jensen, and Williams (below), with a traditional chart Dictionary of Iridology for the old sign vocabulary. The app implements their system; it doesn't invent its own.",
  },
  {
    title: "Mapped the chart",
    body: "The iris is read as a reflex map: 12 sectors × 3 rings, left iris for the left side of the body, right iris for the right, with the stomach and bowel ring at the center and the skin and lymph ring at the edge.",
  },
  {
    title: "Made it fully automatic",
    body: "Photo in, reading out — no review step, no questionnaire. That was the rule from the first day: anyone with a phone camera can get a reading.",
  },
  {
    title: "Taught it to find the eye",
    body: "The reader locates the iris and pupil, unwraps the iris into a polar strip, and splits it into the chart's zones, so every measurement lands in a named body area.",
  },
  {
    title: "Taught it the signs",
    body: "Six traditional signs per sector and zone, each with a confidence score. Each sign's colour is staged against the iris's own base colour — white for acute and over-active, through yellow and orange-brown to the deepest tones — plus a constitution grade from 1 to 10, an inherited-pattern reading, and a temperament sketch.",
  },
  {
    title: "Made the camera work on a phone",
    body: "Guided capture, stills and short bursts, pupil-aligned averaging, and disclosed contrast enhancement so dark eyes read as well as light ones.",
  },
  {
    title: "Assembled the report — and drew the line",
    body: "Findings, zone summary, body map, chart, and a traditional nutrient focus, framed throughout as a traditional reading, never a diagnosis. Disease prediction was deliberately left out, even though published pipelines for it exist.",
  },
  {
    title: "Added time, sharing, and the launch",
    body: "The Timeline compares each rescan with the last, so signs can be watched as they change — the classic progress check. Then accounts, a free preview, shareable readings, and the launch at eyeknow.app, where the app is still being developed.",
  },
];

/** The "How this app was made" content. It renders inside the
 *  homepage popup modal that IrisApp owns — the whole section moved
 *  into a modal (Adam, 2026-11-05). */
export default function HowItWasMade() {
  return (
    <>
      <ol style={{ paddingLeft: 20, marginTop: 0 }}>
        {STEPS.map((s) => (
          <li key={s.title} style={{ marginBottom: 12 }}>
            <b>{s.title}.</b> {s.body}
          </li>
        ))}
      </ol>
      <h3 style={{ marginBottom: 6 }}>The books behind the detection</h3>
      <p style={{ marginTop: 0 }}>
        The detection rules come from these traditional sources — the chart, the sign
        meanings, the colour stages, and the constitution scale:
      </p>
      <ul style={{ marginTop: 0 }}>
        <li style={{ marginBottom: 8 }}>
          <b>Nils Liljequist, <i>The Diagnosis from the Eye</i> (1916)</b> — one of the
          founding texts of iridology, and the tradition this chart comes from: the sign
          taxonomy of clouds, lesions, and markings.
        </li>
        <li style={{ marginBottom: 8 }}>
          <b>Dr. Bernard Jensen, <i>Iridology Simplified</i> (1980)</b> — the constitution
          grades 1–10, the four tissue stages from acute to degenerative, the colour and
          tone ladder, the traditional nutrient focus, and reading the same iris over time.
        </li>
        <li>
          <b>Keri Williams, <i>Iridology through the homeopathic looking glass</i></b> —
          published iridology writing drawn on for the colour-stage readings and the
          traditional sign descriptions.
        </li>
      </ul>
      <p className="muted" style={{ marginBottom: 0 }}>
        A traditional reading, never a diagnosis — and never medical advice.
      </p>
    </>
  );
}
