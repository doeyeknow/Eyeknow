import type { ReactNode } from "react";
import {
  BODY_REGION_LABELS,
  SIGN_COLORS,
  SIGNS,
  TONES,
  ZONES,
  type BodyRegion,
  type Marker,
  type SignId,
  type ToneId,
  type ZoneId,
} from "@/lib/chart";

/** Tiny stroke icons for the 15 body-map areas, drawn on a 24×24
 *  grid in the app's line style. Used on the badges that label which
 *  body part a sign refers to (body-map pop-up). */
export const REGION_ICONS: Record<BodyRegion, ReactNode> = {
  head: (
    <>
      <path d="M11 21v-4.2C9.3 16.1 8 15 7.3 13.6c-.2-.5-.7-.8-1.2-1-.4-.2-.6-.7-.3-1.1l.8-1.2-1-1c-.3-.3-.3-.9.1-1.2l1-.9C6.2 5.6 8.9 3 12.6 3c4.2 0 7.5 3.3 7.5 7.5 0 1.8-.6 3.4-1.7 4.7V21" />
      <path d="M8.7 9.2c-.5-2 .8-4 2.8-4.5.6-1 1.9-1.5 3.1-1.1 1.4-.6 3.1.1 3.8 1.5.9.7 1.2 2 .6 3.1-.5 1.2-1.8 1.9-3.1 1.7-.9.7-2.2.7-3.1.1-1.2 0-2.4-.8-2.8-2-.2-.3-.3-.6-.3-.8Z" />
      <path d="M10.6 6.7c.7.5 1.7.6 2.5.2M13.9 9.7c-.6.5-1.5.6-2.2.3" />
      <path d="M16 11.8c.8.3 1.3 1 1.2 1.9-.1.8-.7 1.4-1.4 1.5" />
    </>
  ),
  face: (
    <>
      <path d="M2.8 12C5.2 7.2 8.4 5 12 5s6.8 2.2 9.2 7c-2.4 4.8-5.6 7-9.2 7s-6.8-2.2-9.2-7Z" />
      <circle cx="12" cy="12" r="3.4" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <path d="M6.2 6.2 5.2 4.5M12 5V3.2M17.8 6.2l1-1.7" />
    </>
  ),
  throat: (
    <>
      <path d="M9.3 2.8h5.4M10.2 2.8v12.5M13.8 2.8v12.5" />
      <path d="M10.2 6h3.6M10.2 9h3.6M10.2 12h3.6" />
      <path d="M10.2 13.2c-1.5-.8-3-.4-3.5.8-.5 1.3.1 2.8 1.4 3.4 1 .5 2.1.2 2.1-.7ZM13.8 13.2c1.5-.8 3-.4 3.5.8.5 1.3-.1 2.8-1.4 3.4-1 .5-2.1.2-2.1-.7Z" />
      <path d="M9.4 20.8c.8.5 1.7.7 2.6.7s1.8-.2 2.6-.7" />
    </>
  ),
  neck: (
    <>
      <path d="M8.5 3v5.2c0 1.8-.6 3.1-1.8 4.3L4 15.4c-.9.9-1.4 2-1.6 3.2l-.2 2.9h19.6l-.2-2.9c-.2-1.2-.7-2.3-1.6-3.2l-2.7-2.9c-1.2-1.2-1.8-2.5-1.8-4.3V3" />
      <path d="M8.5 3h7" />
      <path d="M9.9 8.4 12 13.2M14.1 8.4 12 13.2" />
      <path d="M10.4 13.8c.6-.5 1.1-.5 1.6 0 .5-.5 1-.5 1.6 0 .1 1.2-.6 2-1.6 2s-1.7-.8-1.6-2Z" />
      <circle cx="8.6" cy="10.6" r="0.55" fill="currentColor" />
      <circle cx="15.4" cy="10.6" r="0.55" fill="currentColor" />
    </>
  ),
  chest: (
    <>
      <path d="M12 2.8v5M10.9 4.4h2.2M10.9 6.1h2.2" />
      <path d="M12 7.8 9.9 9.9M12 7.8l2.1 2.1M9.9 9.9l-1.7 1.3M10 10l-.2 2.1M14.1 9.9l1.7 1.3M14 10l.2 2.1" />
      <path d="M9.5 9.3C7 9.7 5.3 12.1 5 15.4l-.3 3.8c-.1 1.2.8 2 2 2h2.1c1 0 1.8-.8 1.8-1.8V11.1c0-1-.5-1.9-1.1-1.8Z" />
      <path d="M14.5 9.3c2.5.4 4.2 2.8 4.5 6.1l.3 3.8c.1 1.2-.8 2-2 2h-2.1c-1 0-1.8-.8-1.8-1.8V11.1c0-1 .5-1.9 1.1-1.8Z" />
      <path d="M7.5 13.2c-.6.8-.9 1.7-.8 2.7M16.5 13.2c.6.8.9 1.7.8 2.7" />
    </>
  ),
  heart: (
    <>
      <path d="M12 20.6S4.1 15.6 4.1 10.2C4.1 7.4 6.1 5.4 8.5 5.4c1.4 0 2.7.7 3.5 1.9.8-1.2 2.1-1.9 3.5-1.9 2.4 0 4.4 2 4.4 4.8 0 5.4-7.9 10.4-7.9 10.4Z" />
      <path d="M9.9 5.3c-.1-1.5.9-2.7 2.1-2.7s2.2 1.2 2.1 2.7M8.3 4.5 7.5 2.9M15.7 4.5l.8-1.6" />
      <path d="M12 8.6c-.1 2.9-.9 5.3-2.3 7.2M8.4 10.1c1 .7 2.2.9 3.6.5" />
    </>
  ),
  liver: (
    <>
      <path d="M2.6 10.2C5.8 6.8 12 5.4 21.4 7c-.4 3-1.9 5.7-4.4 7.4-3.2 2.2-8.8 2.1-12.4-.2C2.4 12.8 1.8 11.5 2.6 10.2Z" />
      <path d="M13.8 6.2c-.4 2.8-1.7 5.3-3.7 7.2" />
      <path d="M15.6 13.6c1 .2 1.7 1.1 1.7 2.2 0 1.2-.9 2.2-2.1 2.3-1.1.1-2-.8-2-1.9 0-1.2 1-2.4 2.4-2.6Z" />
    </>
  ),
  spleen: (
    <>
      <path d="M5.4 8.2c3.5-1.6 8-1.9 11.8-.8 2.5.7 4.1 2.9 3.9 5.4-.2 2.7-2.2 4.9-4.9 5.7-3 .9-6.3.1-8.4-2.2-1.3-1.6-1.9-3.6-1.5-5.5.2-1 .8-2 1.7-2.8Z" />
      <path d="M9.6 9.4c1.5 1.6 2.1 3.7 1.8 6M13.2 8.9c1.6 1.7 2.2 3.9 1.9 6.3" />
    </>
  ),
  bowel: (
    <>
      <path d="M5.6 20.6V7.6c0-1.7 1.3-3 3-3h6.8c1.7 0 3 1.3 3 3v13" />
      <path d="M5.6 15.8h2.7M5.6 11.2h2.7M8.7 4.7v2.7M13 4.7v2.7M18.4 11.2h-2.7M18.4 15.8h-2.7" />
      <path d="M9.1 9.3c1.2-1 2.5-1 3.7 0 1 .9 2.3.9 3.3-.1M8.9 12.7c1.3-1 2.8-1 4 .1 1 .9 2.3.8 3.2-.2M9.5 16.1c1.1-.9 2.4-.9 3.5 0" />
    </>
  ),
  kidneys: (
    <>
      <path d="M9.8 5.8C7.6 5 5 6.8 4.3 9.9c-.7 3.2 1.9 6.7 6.1 7.7C9.9 15.9 8.9 14.6 8.6 12.6c-.3-1.9.2-3.9 1.2-5.7.3-.6.5-1.2.6-1.9Z" />
      <path d="M14.2 5.8c2.2-.8 4.8 1 5.5 4.1.7 3.2-1.9 6.7-6.1 7.7.5-1.7 1.5-3 1.8-5 .3-1.9-.2-3.9-1.2-5.7-.3-.6-.5-1.2-.6-1.9Z" />
      <path d="M6.9 10c.5 1.1.5 2.3 0 3.4M17.1 10c-.5 1.1-.5 2.3 0 3.4" />
      <path d="M10.2 17.8c.1.8.4 1.4.8 1.9M13.8 17.8c-.1.8-.4 1.4-.8 1.9" />
    </>
  ),
  pelvis: (
    <>
      <path d="M4.8 5.2c2.5-.8 5-.7 7.2.5 2.2-1.2 4.7-1.3 7.2-.5.2 3.9-.6 7.5-2.4 10.3-1.3 2-3.2 3.3-5.4 3.7.4-1.2.2-2.5-.6-3.5-.6-.7-1.4-1-2.2-1s-1.6.3-2.2 1c-.8 1-1 2.3-.6 3.5-2.2-.4-4.1-1.7-5.4-3.7C5.4 12.7 4.6 9.1 4.8 5.2Z" />
      <path d="M9.9 6.4h4.2l-2.1 4Z" />
      <circle cx="7" cy="13.8" r="1.2" />
      <circle cx="17" cy="13.8" r="1.2" />
    </>
  ),
  arms: (
    <>
      <path d="M8.8 21.2v-6.1c0-1-.2-2-.7-2.9L6.2 8.9c-.3-.7-.1-1.5.6-1.8.6-.3 1.4-.1 1.7.5l.9 1.7V4.8c0-.8.6-1.4 1.3-1.4.7 0 1.2.5 1.3 1.2l.2 3V4.1c0-.8.6-1.4 1.3-1.4.7 0 1.3.6 1.3 1.4v3.5l.2-3c.1-.7.7-1.2 1.4-1.1.7.1 1.2.7 1.1 1.4l-.5 5.3c.9.8 1.5 2 1.5 3.3v7.7" />
      <path d="M8.8 21.2h9.7" />
    </>
  ),
  legs: (
    <>
      <path d="M5.2 3.4v13.5c0 .8.6 1.4 1.4 1.4h2.9c.8 0 1.4-.7 1.3-1.5l-.6-6.5c-.1-.9-.1-1.9 0-2.8l.3-4.1" />
      <path d="M18.8 3.4v13.5c0 .8-.6 1.4-1.4 1.4h-2.9c-.8 0-1.4-.7-1.3-1.5l.6-6.5c.1-.9.1-1.9 0-2.8l-.3-4.1" />
      <path d="M5.2 3.4h13.6" />
      <circle cx="7.5" cy="10.5" r="0.55" fill="currentColor" />
      <circle cx="16.5" cy="10.5" r="0.55" fill="currentColor" />
    </>
  ),
  spine: (
    <>
      <rect x="9" y="2.6" width="6" height="2.9" rx="1.4" />
      <rect x="9" y="6.1" width="6" height="2.9" rx="1.4" />
      <rect x="9" y="9.6" width="6" height="2.9" rx="1.4" />
      <rect x="9" y="13.1" width="6" height="2.9" rx="1.4" />
      <rect x="9" y="16.6" width="6" height="2.9" rx="1.4" />
      <path d="M6.3 4h2.7M6.3 7.5h2.7M6.3 11h2.7M6.3 14.5h2.7M15 4h2.7M15 7.5h2.7M15 11h2.7M15 14.5h2.7" />
      <path d="M9.8 20.6h4.4l-2.2 1.6Z" />
    </>
  ),
  upperback: (
    <>
      <path d="M7.5 3.8h9l.9 4.1c.2 1 .9 1.9 1.8 2.4l.6 5.5c.1 1.2-.8 2.2-2 2.2H6.2c-1.2 0-2.1-1-2-2.2l.6-5.5c.9-.5 1.6-1.4 1.8-2.4Z" />
      <path d="M8.7 8.3 11 10.6l-2.3 2.5c-.9-.6-1.4-1.5-1.3-2.6 0-1 .5-1.9 1.3-2.2ZM15.3 8.3 13 10.6l2.3 2.5c.9-.6 1.4-1.5 1.3-2.6 0-1-.5-1.9-1.3-2.2Z" />
      <path d="M12 5.2v1.5M12 8.4v1.5M12 11.6v1.5M12 14.8v1.5" />
    </>
  ),
};

export function RegionBadge({ region }: { region: BodyRegion }) {
  return (
    <span className="region-badge">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {REGION_ICONS[region]}
      </svg>
      {BODY_REGION_LABELS[region]}
    </span>
  );
}

/** The traditional colour-stage badge: a swatch of the tone sampled
 *  at the sign plus its stage on the classic ladder. */
export function StageBadge({ tone }: { tone: ToneId }) {
  const t = TONES[tone];
  return (
    <span className="stage-badge" title={`Tone sampled at this sign: ${t.label}`}>
      <i style={{ background: t.swatch }} aria-hidden="true" />
      {t.stage} · {t.label} tone
    </span>
  );
}

/** The body part's name centered above its big icon. The Findings
 *  tab leads each sign with this (Adam's direction, 2026-11-03:
 *  name above the icon, not beneath it). */
export function RegionHero({ region }: { region: BodyRegion }) {
  return (
    <span className="region-hero">
      <span className="region-badge">{BODY_REGION_LABELS[region]}</span>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {REGION_ICONS[region]}
      </svg>
    </span>
  );
}

/** The badge row under a sign's name: body part (with icon), zone,
 *  the colour-stage badge, and the reader-confidence level as signal
 *  bars + label. Used by the body-map pop-up and the Findings tab.
 *  hideRegion drops the body-part badge (the Findings tab shows it
 *  in the RegionHero instead). */
export function SignBadges({
  region,
  zone,
  confidence,
  tone,
  hideRegion,
  sign,
  onSignGuide,
}: {
  region: BodyRegion;
  zone: ZoneId;
  confidence?: Marker["confidence"];
  tone?: ToneId;
  hideRegion?: boolean;
  /** When given, the marking type leads the row — the Findings tab
   *  keeps it together with the band (zone) badge (Adam, 2026-11-03). */
  sign?: SignId;
  onSignGuide?: () => void;
}) {
  return (
    <div className="finding-badges">
      {sign &&
        (onSignGuide ? (
          <button
            type="button"
            className="kind-badge as-btn"
            onClick={onSignGuide}
            title={`What is a ${SIGNS[sign].label}?`}
          >
            <span
              className="sign-dot"
              style={{ background: SIGN_COLORS[sign].bg }}
              aria-hidden="true"
            />
            {SIGNS[sign].label}
            <span className="kb-q" aria-hidden="true">
              ?
            </span>
          </button>
        ) : (
          <span className="kind-badge">
            <span
              className="sign-dot"
              style={{ background: SIGN_COLORS[sign].bg }}
              aria-hidden="true"
            />
            {SIGNS[sign].label}
          </span>
        ))}
      {!hideRegion && <RegionBadge region={region} />}
      <span className="zone-badge">{ZONES[zone].label}</span>
      {tone && <StageBadge tone={tone} />}
      {confidence && (
        <span className={`conf-badge conf-${confidence}`}>
          <span className="conf-bars" aria-hidden="true">
            <i className="on" style={{ height: 5 }} />
            <i className={confidence !== "light" ? "on" : ""} style={{ height: 8 }} />
            <i className={confidence === "strong" ? "on" : ""} style={{ height: 11 }} />
          </span>
          Confidence:{" "}
          {confidence === "strong" ? "Strong" : confidence === "moderate" ? "Moderate" : "Light"}
        </span>
      )}
    </div>
  );
}
