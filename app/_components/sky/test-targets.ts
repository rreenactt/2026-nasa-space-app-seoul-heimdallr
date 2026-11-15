import { propagate } from "@/app/_lib/sky/wcs";
import type { MessageKey } from "@/app/_i18n/message-keys";
import type { EquatorialCoordinates } from "./sky-coordinates";

/** Epoch the SPHEREx DR1 observations of the test targets centre on (visits run 2025-05 → 2026-05). */
export const SPHEREX_EPOCH = 2025.9;

/** Measured proper motion with the position and epoch it starts from (not always the pin: see WISE 0855). */
export type TargetMotion = EquatorialCoordinates & {
  epoch: number;
  /** µα cos δ and µδ in mas/yr. */
  pmRaMasYr: number;
  pmDecMasYr: number;
  source: string;
};

export type TestTarget = EquatorialCoordinates & {
  id: string;
  name: string;
  /** Moving objects: the position is only valid at this epoch (absolute principle 6). */
  epoch: string;
  /** Where the position comes from. */
  source: string;
  /** Why the team tests with it (English; screens show `t(noteKey)`). */
  note: string;
  noteKey: MessageKey;
  /** Catalog proper motion. Every test target has one: none of them is fixed on the sky. */
  motion: TargetMotion;
  /**
   * Where the object sits during the SPHEREx observations: `motion` moved to SPHEREX_EPOCH with the same linear
   * formula the analyses use (`propagate` in app/_lib/sky/wcs.ts; parallax ignored). Computed, never typed in.
   * The pin itself stays at its catalog position.
   */
  spherexPosition: EquatorialCoordinates & { epoch: string; source: string };
  /** Detector the analysis panel opens with for this target only (the general default is the most exposures). */
  defaultDetector?: { detector: string; reason: string; reasonKey: MessageKey };
};

/**
 * The five test targets from the plan, pinned on the sky. Positions were queried from IRSA (gaia_dr3_source,
 * allwise_p3as_psd) on 2026-11-14. Barnard's Star and WISE 0855 match the values used in the Sky Time Machine
 * analysis.
 */
const PINS: Omit<TestTarget, "spherexPosition">[] = [
  {
    id: "barnard",
    name: "Barnard's Star",
    ra: 269.44850252544,
    dec: 4.73942005111,
    epoch: "2016.0",
    source: "Gaia DR3 4472832130942575872",
    note: "One of the fastest-moving stars on the sky, about 10.4″ per year to the north.",
    noteKey: "testTargets.barnardNote",
    motion: { ra: 269.44850252544, dec: 4.73942005111, epoch: 2016.0, pmRaMasYr: -801.551, pmDecMasYr: 10362.394, source: "Gaia DR3 proper motion" },
  },
  {
    id: "eps-ind-b",
    name: "Epsilon Indi B",
    ra: 331.07645259656,
    dec: -56.79381206688,
    epoch: "2016.0",
    source: "Gaia DR3 6412596012146801152",
    note: "Nearby brown dwarf pair, about 4.7″ per year. Bright in the infrared, faint in visible light.",
    noteKey: "testTargets.epsIndBNote",
    motion: { ra: 331.07645259656, dec: -56.79381206688, epoch: 2016.0, pmRaMasYr: 3981.977, pmDecMasYr: -2466.832, source: "Gaia DR3 proper motion" },
  },
  {
    id: "wise0855",
    name: "WISE 0855−0714",
    ra: 133.795125,
    dec: -7.245139,
    epoch: "≈2010",
    source: "AllWISE designation J085510.83−071442.5",
    note: "The coldest known brown dwarf, about 8″ per year. Not in Gaia; may be too faint for SPHEREx.",
    noteKey: "testTargets.wise0855Note",
    // Not in Gaia: Spitzer position at MJD 56839.7 and proper motion from Luhman & Esplin 2014 (arXiv:1409.5899),
    // the same values as app/_lib/nim/catalog.ts.
    motion: {
      ra: 133.7858505,
      dec: -7.2443176,
      epoch: 2014.4967,
      pmRaMasYr: -8100,
      pmDecMasYr: 700,
      source: "Luhman & Esplin 2014 position and proper motion",
    },
    defaultDetector: {
      detector: "D6",
      reason: "a Y dwarf is nearly dark below 4 µm and brightest near 4.6 µm",
      reasonKey: "testTargets.wise0855DetectorReason",
    },
  },
  {
    id: "rw-aur",
    name: "RW Aurigae",
    ra: 76.95608119553,
    dec: 30.4012045891,
    epoch: "2016.0",
    source: "Gaia DR3 156430822114424576 (RW Aur A)",
    note: "Young star whose brightness changes; tests a source that varies while it moves far less than a SPHEREx pixel (about 0.03″ per year).",
    noteKey: "testTargets.rwAurNote",
    motion: { ra: 76.95608119553, dec: 30.4012045891, epoch: 2016.0, pmRaMasYr: 2.64, pmDecMasYr: -27.4, source: "Gaia DR3 proper motion" },
  },
  {
    id: "r-dra",
    name: "R Draconis",
    ra: 248.16737836729,
    dec: 66.75500674547,
    epoch: "2016.0",
    source: "Gaia DR3 1648328016354496384",
    note: "Mira variable; tests a bright source that varies while it moves far less than a SPHEREx pixel (about 0.02″ per year).",
    noteKey: "testTargets.rDraNote",
    motion: { ra: 248.16737836729, dec: 66.75500674547, epoch: 2016.0, pmRaMasYr: -20.64, pmDecMasYr: 6.15, source: "Gaia DR3 proper motion" },
  },
];

export const TEST_TARGETS: TestTarget[] = PINS.map((pin) => {
  const m = pin.motion;
  return {
    ...pin,
    spherexPosition: {
      ...propagate(m.ra, m.dec, m.pmRaMasYr, m.pmDecMasYr, m.epoch, SPHEREX_EPOCH),
      epoch: SPHEREX_EPOCH.toFixed(1),
      source: `${m.source}, moved to ${SPHEREX_EPOCH.toFixed(1)}`,
    },
  };
});

/** Angular separation in degrees (small-angle; fine for the arcminute scales used here). */
function separationDeg(a: EquatorialCoordinates, b: EquatorialCoordinates): number {
  const dRa = (((a.ra - b.ra + 540) % 360) - 180) * Math.cos((a.dec * Math.PI) / 180);
  return Math.hypot(dRa, a.dec - b.dec);
}

/** Returns the test target within `toleranceDeg` of a position (its pin or its SPHEREx-epoch position), if any. */
export function findTestTarget(point: EquatorialCoordinates, toleranceDeg = 1 / 3600): TestTarget | undefined {
  return TEST_TARGETS.find(
    (target) =>
      separationDeg(point, target) <= toleranceDeg || separationDeg(point, target.spherexPosition) <= toleranceDeg,
  );
}

/**
 * Epoch and source of the position a panel is open on: the target's SPHEREx-epoch position when the point is there,
 * otherwise the pin (absolute principle 6: a moving object's coordinates always carry their epoch).
 */
export function targetPositionAt(
  target: TestTarget,
  point: EquatorialCoordinates,
  toleranceDeg = 1 / 3600,
): { epoch: string; source: string; atSpherexPosition: boolean } {
  const later = target.spherexPosition;
  // Slow targets have both positions within the tolerance: the nearer one names the point.
  if (separationDeg(point, later) <= toleranceDeg && separationDeg(point, later) < separationDeg(point, target)) return { epoch: later.epoch, source: later.source, atSpherexPosition: true };
  return { epoch: target.epoch, source: target.source, atSpherexPosition: false };
}

/** How far the object has moved from its pin by the SPHEREx observations, in arcseconds. */
export function pinToSpherexArcsec(target: TestTarget): number {
  return separationDeg(target, target.spherexPosition) * 3600;
}
