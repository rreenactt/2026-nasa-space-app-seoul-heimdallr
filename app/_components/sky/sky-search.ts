import type { MessageKey } from "@/app/_i18n/message-keys";
import type { EquatorialCoordinates } from "./sky-coordinates";
import { TEST_TARGETS, type TestTarget } from "./test-targets";

export type SkySearchResult =
  | { kind: "target"; target: TestTarget }
  | { kind: "name"; name: SkyName }
  | { kind: "point"; point: EquatorialCoordinates }
  /** The message is a translation key; the search box shows it in the chosen language. */
  | { kind: "error"; message: MessageKey };

/**
 * A name that spells its own position (Jhhmmss.s±ddmmss): a candidate name, or a 2MASS designation, whose digits run
 * on without a decimal point (J08292680+5507243 is 08h29m26.80s +55°07′24.3″). The position is truncated, not
 * rounded, so it can sit up to about 1.5″ from the source, and a 2MASS position is from 1997–2001.
 */
export type SkyName = {
  /** "J…" without any catalog prefix. */
  designation: string;
  /** Eight RA and seven Dec digits: the 2MASS point source format. */
  twoMass: boolean;
  point: EquatorialCoordinates;
};

const NAME_PATTERN = /^(?:2mass|sphere?x)?j(\d{2})(\d{2})(\d{2}(?:\.\d+|\d*))([+\-−–])(\d{2})(\d{2})(\d{2}(?:\.\d+|\d*))$/i;

/** Reads a J-name such as "J082927.2+550714" or "2MASS J08292680+5507243"; null for anything else. */
export function parseSkyName(text: string): SkyName | null {
  // Spaces are dropped first, so "2MASS J0829 2680 +5507243" reads the same as the run-together form.
  const match = NAME_PATTERN.exec(text.replace(/\s+/g, ""));
  if (!match) return null;
  const [, rh, rm, rsDigits, signText, dd, dm, dsDigits] = match;
  // Digits past the first two of the seconds are decimals when no point is written.
  const seconds = (digits: string) => Number(digits.includes(".") ? digits : `${digits.slice(0, 2)}.${digits.slice(2) || "0"}`);
  const rs = seconds(rsDigits);
  const ds = seconds(dsDigits);
  if (Number(rm) >= 60 || rs >= 60 || Number(dm) >= 60 || ds >= 60) return null;
  const sign = signText === "+" ? 1 : -1;
  const point = valid((Number(rh) + Number(rm) / 60 + rs / 3600) * 15, sign * (Number(dd) + Number(dm) / 60 + ds / 3600));
  if (!point) return null;
  const sign2 = sign > 0 ? "+" : "-";
  return {
    designation: `J${rh}${rm}${rsDigits}${sign2}${dd}${dm}${dsDigits}`,
    twoMass: !rsDigits.includes(".") && !dsDigits.includes(".") && rsDigits.length === 4 && dsDigits.length === 3,
    point,
  };
}

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
 * Reads what the user typed into the sky search: a test target name, a J-name (a candidate or a 2MASS designation, which
 * the database is asked about), decimal degrees ("269.4485 4.7394"), or sexagesimal RA in hours and Dec in degrees
 * ("17 57 48.5 +04 41 36", "17h57m48.5s +4d41m36s", "17:57:48.5 4:41:36"). Other object names need a name resolver
 * (SIMBAD), which is offline during the CDS outage.
 */
export function parseSkySearch(query: string): SkySearchResult {
  const text = query.trim();
  if (!text) return { kind: "error", message: "search.errorEmpty" };

  const target = findTargetByName(text);
  if (target) return { kind: "target", target };

  const name = parseSkyName(text);
  if (name) return { kind: "name", name };

  if (!COORDINATE_CHARS.test(text)) {
    return {
      kind: "error",
      message: "search.errorUnknownName",
    };
  }

  const point = parseCoordinates(text);
  return point
    ? { kind: "point", point }
    : { kind: "error", message: "search.errorCoordinates" };
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
