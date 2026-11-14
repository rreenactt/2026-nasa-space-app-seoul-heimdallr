import type { EquatorialCoordinates } from "./sky-coordinates";
import { TEST_TARGETS, type TestTarget } from "./test-targets";

export type SkySearchResult =
  | { kind: "target"; target: TestTarget }
  | { kind: "point"; point: EquatorialCoordinates }
  | { kind: "error"; message: string };

/** Other spellings people type for the test targets, compared after `normalizeName`. */
const ALIASES: Record<string, string[]> = {
  barnard: ["barnard", "barnardsstar", "gj699", "gl699"],
  "eps-ind-b": ["epsilonindib", "epsindb", "epsindib", "epsilonindb"],
  wise0855: ["wise0855", "wise08550714", "wisej08550714", "wisej085510830714425"],
  "rw-aur": ["rwaurigae", "rwaur"],
  "r-dra": ["rdraconis", "rdra"],
};

const normalizeName = (text: string) =>
  text
    .toLowerCase()
    .replace(/ε/g, "eps")
    .replace(/[^a-z0-9]/g, "");

// Coordinates start with a number, which also keeps catalog names such as "M31" out of the coordinate parser.
const COORDINATE_CHARS = /^[+\-−–]?\d[\d\s.,:+\-−–hdms°′″'"]*$/i;

/**
 * Reads what the user typed into the sky search: a test target name, decimal degrees ("269.4485 4.7394"), or
 * sexagesimal RA in hours and Dec in degrees ("17 57 48.5 +04 41 36", "17h57m48.5s +4d41m36s", "17:57:48.5 4:41:36").
 * Other object names need a name resolver (SIMBAD), which is offline during the CDS outage.
 */
export function parseSkySearch(query: string): SkySearchResult {
  const text = query.trim();
  if (!text) return { kind: "error", message: "Type a test target name or coordinates." };

  const target = findTargetByName(text);
  if (target) return { kind: "target", target };

  if (!COORDINATE_CHARS.test(text)) {
    return {
      kind: "error",
      message: "Only the test targets can be found by name for now. Try coordinates, for example 269.4485 4.7394.",
    };
  }

  const point = parseCoordinates(text);
  return point
    ? { kind: "point", point }
    : { kind: "error", message: "Could not read those coordinates. Use RA then Dec, for example 17 57 48.5 +04 41 36." };
}

function findTargetByName(text: string): TestTarget | undefined {
  const name = normalizeName(text);
  if (name.length < 3) return undefined;
  const aliasesOf = (target: TestTarget) => [normalizeName(target.name), ...(ALIASES[target.id] ?? [])];
  const exact = TEST_TARGETS.find((target) => aliasesOf(target).includes(name));
  if (exact) return exact;
  const partial = TEST_TARGETS.filter((target) => aliasesOf(target).some((alias) => alias.startsWith(name)));
  return partial.length === 1 ? partial[0] : undefined;
}

function parseCoordinates(text: string): EquatorialCoordinates | null {
  const sexagesimal = /[hms:°′″'"]/i.test(text) || /\d\s*d\s*\d/i.test(text);
  const tokens = text
    .replace(/[−–]/g, "-")
    .replace(/[hdms:°′″'",]/gi, " ")
    .replace(/([+-])\s+/g, "$1")
    .trim()
    .split(/\s+/);

  if (!sexagesimal && tokens.length === 2) {
    const [ra, dec] = tokens.map(Number);
    return valid(ra, dec);
  }
  if (tokens.length === 6) {
    const [rh, rm, rs, dd, dm, ds] = tokens.map(Number);
    if ([rm, dm].some((value) => value < 0 || value >= 60) || [rs, ds].some((value) => value < 0 || value >= 60)) {
      return null;
    }
    // The sign belongs to the whole declination, including "-00 30 00".
    const sign = tokens[3].startsWith("-") ? -1 : 1;
    const ra = (rh + rm / 60 + rs / 3600) * 15;
    const dec = sign * (Math.abs(dd) + dm / 60 + ds / 3600);
    return rh < 0 ? null : valid(ra, dec);
  }
  return null;
}

function valid(ra: number, dec: number): EquatorialCoordinates | null {
  if (!Number.isFinite(ra) || !Number.isFinite(dec)) return null;
  if (ra < 0 || ra >= 360 || dec < -90 || dec > 90) return null;
  return { ra, dec };
}
