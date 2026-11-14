import type { SkyView } from "./sky-coordinates";

/** Imagery for the sky screen: the zoom view's HiPS and the sphere's 360° background built from it. */
export type SkySurvey = {
  /** HiPS ID or base URL that Aladin Lite loads in the zoom view. */
  hips: string;
  /** Equirectangular background in public/, built by scripts/sky-background/build_background.py. */
  background: string;
  /** Credit line shown on screen. */
  credit: string;
  /** Shown when the survey stands in for the SPHEREx imagery. */
  notice?: string;
};

/** Intended imagery: the SPHEREx QR2 color HiPS published by CDS. Browsing only; analysis uses IRSA DR1/QR3 cutouts. */
export const SPHEREX_COLOR_SURVEY: SkySurvey = {
  hips: "CDS/P/SPHEREx/QR2/color",
  background: "/sky/spherex-qr2-color-4096.jpg",
  credit: "SPHEREx QR2 color preview (CDS HiPS) · Courtesy NASA/JPL-Caltech",
};

/**
 * Stand-in while CDS is offline (cybersecurity incident, November 2026) and the SPHEREx color HiPS cannot be
 * reached: the 2MASS color HiPS that IRSA mirrors.
 */
export const TWO_MASS_COLOR_SURVEY: SkySurvey = {
  hips: "https://irsa.ipac.caltech.edu/data/hips/CDS/2MASS/Color",
  background: "/sky/2mass-color-4096.jpg",
  credit: "2MASS J, H, K color · University of Massachusetts & IPAC/Caltech (HiPS via IRSA)",
  notice: "Temporary background: 2MASS, not SPHEREx. The SPHEREx sky tiles are unavailable during the CDS outage.",
};

/** Switch back to SPHEREX_COLOR_SURVEY once CDS serves the SPHEREx tiles again and its background is built. */
export const SKY_SURVEY = TWO_MASS_COLOR_SURVEY;

/** Zooming the sphere to this horizontal field of view (degrees) or narrower hands off to Aladin Lite. */
export const ZOOM_IN_FOV = 5;

/** Zooming Aladin Lite out past this field of view (degrees) returns to the sphere. The gap avoids flicker at the boundary. */
export const ZOOM_OUT_FOV = 6;

/** Widest horizontal field of view the sphere allows (degrees). */
export const MAX_SPHERE_FOV = 120;

/** First view: the Galactic Center. */
export const INITIAL_VIEW: SkyView = { ra: 266.414, dec: -29.006, fov: 90 };
