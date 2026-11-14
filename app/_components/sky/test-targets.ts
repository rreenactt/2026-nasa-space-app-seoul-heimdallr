import type { EquatorialCoordinates } from "./sky-coordinates";

export type TestTarget = EquatorialCoordinates & {
  id: string;
  name: string;
  /** Moving objects: the position is only valid at this epoch (absolute principle 6). */
  epoch: string;
  /** Where the position comes from. */
  source: string;
  /** Why the team tests with it. */
  note: string;
};

/**
 * The five test targets from the plan, pinned on the sky. Positions were queried from IRSA (gaia_dr3_source,
 * allwise_p3as_psd) on 2026-11-14. Barnard's Star and WISE 0855 match the values used in the Sky Time Machine
 * analysis.
 */
export const TEST_TARGETS: TestTarget[] = [
  {
    id: "barnard",
    name: "Barnard's Star",
    ra: 269.44850252544,
    dec: 4.73942005111,
    epoch: "2016.0",
    source: "Gaia DR3 4472832130942575872",
    note: "One of the fastest-moving stars on the sky, about 10.4″ per year to the north.",
  },
  {
    id: "eps-ind-b",
    name: "Epsilon Indi B",
    ra: 331.07645259656,
    dec: -56.79381206688,
    epoch: "2016.0",
    source: "Gaia DR3 6412596012146801152",
    note: "Nearby brown dwarf pair, about 4.7″ per year. Bright in the infrared, faint in visible light.",
  },
  {
    id: "wise0855",
    name: "WISE 0855−0714",
    ra: 133.795125,
    dec: -7.245139,
    epoch: "≈2010",
    source: "AllWISE designation J085510.83−071442.5",
    note: "The coldest known brown dwarf, about 8″ per year. Not in Gaia; may be too faint for SPHEREx.",
  },
  {
    id: "rw-aur",
    name: "RW Aurigae",
    ra: 76.95608119553,
    dec: 30.4012045891,
    epoch: "2016.0",
    source: "Gaia DR3 156430822114424576 (RW Aur A)",
    note: "Young star whose brightness changes; tests a source that varies without moving.",
  },
  {
    id: "r-dra",
    name: "R Draconis",
    ra: 248.16737836729,
    dec: 66.75500674547,
    epoch: "2016.0",
    source: "Gaia DR3 1648328016354496384",
    note: "Mira variable; tests a bright source that varies without moving.",
  },
];

/** Returns the test target within `toleranceDeg` of a position, if any. */
export function findTestTarget({ ra, dec }: EquatorialCoordinates, toleranceDeg = 1 / 3600): TestTarget | undefined {
  return TEST_TARGETS.find((target) => {
    const dRa = (((ra - target.ra + 540) % 360) - 180) * Math.cos((dec * Math.PI) / 180);
    return Math.hypot(dRa, dec - target.dec) <= toleranceDeg;
  });
}
