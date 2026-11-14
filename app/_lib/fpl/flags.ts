import type { FlagBit } from "@/app/_lib/comet/types";

/**
 * How Fake Planet Lab reads SPHEREx FLAGS. Bits are matched by the NAME in the file header (MSKNnnnn),
 * never by a hard-coded bit number. A flag means "the pipeline marked this effect", not "this is fake".
 */

export type FlagRole = "exclude" | "warning" | "context" | "info" | "unknown";

export interface FlagCategory {
  id: string;
  label: string;
  role: FlagRole;
  names: string[];
  color: string; // overlay color (r,g,b)
  explain: string;
}

export const FLAG_CATEGORIES: FlagCategory[] = [
  {
    id: "unusable",
    label: "Unusable pixel",
    role: "exclude",
    names: ["NONFUNC", "MISSING_DATA", "HOT", "COLD", "SUR_ERROR"],
    color: "239,68,68",
    explain: "Permanently bad, hot/cold, onboard-error or missing pixels. Excluded from measurements.",
  },
  {
    id: "saturation",
    label: "Saturation / nonlinearity",
    role: "warning",
    names: ["OVERFLOW", "NONLINEAR", "BLOOM"],
    color: "249,115,22",
    explain: "Saturated or nonlinear signal, or blooming from a bright source. Brightness is unreliable here.",
  },
  {
    id: "transient",
    label: "Cosmic ray / transient",
    role: "warning",
    names: ["TRANSIENT", "SNOWBALL", "HALO"],
    color: "234,179,8",
    explain: "Hits detected during the exposure (cosmic rays, snowballs, their halos). Single-exposure dots here are suspect.",
  },
  {
    id: "ghost",
    label: "Ghost",
    role: "warning",
    names: ["GHOST", "GHOST_FPA", "GHOST_EXT"],
    color: "168,85,247",
    explain: "Optical ghosts from a bright source in this exposure, on another detector, or outside the field.",
  },
  {
    id: "persistence",
    label: "Persistence",
    role: "warning",
    names: ["PERSIST"],
    color: "236,72,153",
    explain: "Residual charge from an earlier bright signal. Check whether the dot repeats in other observations.",
  },
  {
    id: "crosstalk",
    label: "Crosstalk",
    role: "warning",
    names: ["CROSSTALK"],
    color: "20,184,166",
    explain: "Signal coupled from elsewhere on the detector, not from this point on the sky.",
  },
  {
    id: "streak",
    label: "Streak",
    role: "warning",
    names: ["STREAK"],
    color: "59,130,246",
    explain: "Satellite or other streak crossing the exposure.",
  },
  {
    id: "outlier",
    label: "Outlier (context)",
    role: "context",
    names: ["OUTLIER"],
    color: "132,204,22",
    explain:
      "Pixels that differ from the expected sky. Cosmic rays land here, but so do real moving or variable objects. Treat as 'look closer', not as an artifact.",
  },
  {
    id: "info",
    label: "Informational",
    role: "info",
    names: ["SOURCE", "FULLSAMPLE", "DICHROIC", "PHANMISS"],
    color: "148,163,184",
    explain: "SOURCE marks pixels mapped to a known catalog source (not a defect). Others describe processing or efficiency.",
  },
];

export const UNKNOWN_CATEGORY: FlagCategory = {
  id: "unknown",
  label: "Not interpreted",
  role: "unknown",
  names: [],
  color: "255,255,255",
  explain: "A bit defined in this file that this tool does not interpret. Its raw name and description are shown as-is.",
};

/** Bits used to exclude pixels from the S/N measurement (policy shown on screen). */
export const MEASUREMENT_EXCLUDE = [
  "NONFUNC",
  "MISSING_DATA",
  "HOT",
  "COLD",
  "SUR_ERROR",
  "OVERFLOW",
  "NONLINEAR",
  "TRANSIENT",
  "SNOWBALL",
  "PERSIST",
  "STREAK",
];

export function categoryOf(name: string): FlagCategory {
  return FLAG_CATEGORIES.find((c) => c.names.includes(name)) ?? UNKNOWN_CATEGORY;
}

export interface DecodedBit extends FlagBit {
  mask: number;
  category: FlagCategory;
}

/** Bit table from the file header, each bit tied to its category. */
export function decodeBits(flagBits: FlagBit[]): DecodedBit[] {
  return flagBits.map((b) => ({ ...b, mask: (1 << b.bit) >>> 0, category: categoryOf(b.name) }));
}

/** Names of the bits set in one pixel value (multi-bit pixels decode to several names). */
export function namesIn(value: number, bits: DecodedBit[]): string[] {
  const v = value >>> 0;
  const names = bits.filter((b) => (v & b.mask) !== 0).map((b) => b.name);
  // Bits set in the value but not defined in the header.
  let known = 0;
  for (const b of bits) known |= b.mask;
  const undefinedBits = (v & ~known) >>> 0;
  if (undefinedBits) {
    for (let i = 0; i < 32; i++) if (undefinedBits & (1 << i)) names.push(`bit${i}(undefined)`);
  }
  return names;
}

export function maskOfNames(bits: DecodedBit[], names: string[]): number {
  let m = 0;
  for (const b of bits) if (names.includes(b.name)) m |= b.mask;
  return m >>> 0;
}

export function maskOfCategory(bits: DecodedBit[], categoryId: string): number {
  let m = 0;
  for (const b of bits) if (b.category.id === categoryId) m |= b.mask;
  return m >>> 0;
}
