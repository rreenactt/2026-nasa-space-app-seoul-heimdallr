import type { SkyView } from "./sky-coordinates";

/** Imagery for the sky screen: one HiPS that Aladin Lite renders at every field of view. */
export type SkySurvey = {
  /** HiPS ID or base URL. */
  hips: string;
  /** Credit line shown on screen. */
  credit: string;
  /** Short name for the analysis panel's data line. */
  shortName: string;
  /** Shown when the survey stands in for the SPHEREx imagery. */
  notice?: string;
};

/** Intended imagery: the SPHEREx QR2 color HiPS published by CDS. Browsing only; analysis uses IRSA DR1/QR3 cutouts. */
export const SPHEREX_COLOR_SURVEY: SkySurvey = {
  hips: "CDS/P/SPHEREx/QR2/color",
  credit: "SPHEREx QR2 color preview (CDS HiPS) · Courtesy NASA/JPL-Caltech",
  shortName: "SPHEREx QR2 color preview",
};

/**
 * Stand-in while CDS is offline (cybersecurity incident, November 2026) and the SPHEREx color HiPS cannot be
 * reached: the 2MASS color HiPS that IRSA mirrors.
 */
export const TWO_MASS_COLOR_SURVEY: SkySurvey = {
  hips: "https://irsa.ipac.caltech.edu/data/hips/CDS/2MASS/Color",
  credit: "2MASS J, H, K color. UMass and IPAC/Caltech, HiPS via IRSA",
  shortName: "2MASS color (temporary, not SPHEREx)",
  // Figma "I · Explore": one line. Why (the CDS outage) is on the Method page under "Data sources and credits".
  notice: "Temporary background: 2MASS, not SPHEREx",
};

/** Switch back to SPHEREX_COLOR_SURVEY once CDS serves the SPHEREx tiles again. */
export const SKY_SURVEY = TWO_MASS_COLOR_SURVEY;

/** Widest horizontal field of view (degrees). TAN allows up to 150° in Aladin Lite; wider looks stretched at the edges. */
export const MAX_FOV = 120;

/** Narrowest field of view (degrees), a little wider than one cutout. */
export const MIN_FOV = 0.05;

/** At this field of view (degrees) or narrower, the cursor becomes the aiming square and a click opens the panel. */
export const AIM_FOV = 5;

/**
 * Field of view (degrees) a click on the sky flies to when the view is wider than AIM_FOV: narrow enough to aim, wide
 * enough to still see the surroundings of the clicked point.
 */
export const CLICK_ZOOM_FOV = 2;

/** Field of view (degrees) the view flies to when a test target or a searched point is chosen. */
export const TARGET_FOV = 1;

/** Side of the aiming square: the default cutout size of the analysis (PLAN.md chapter 4), in arcminutes. */
export const CUTOUT_ARCMIN = 3;

/** First view: the Galactic Center. */
export const INITIAL_VIEW: SkyView = { ra: 266.414, dec: -29.006, fov: 90 };
