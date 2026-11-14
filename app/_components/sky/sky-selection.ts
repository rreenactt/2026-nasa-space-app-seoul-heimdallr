import { z } from "zod";
import { MAX_FOV } from "./constants";
import type { EquatorialCoordinates } from "./sky-coordinates";
import { findTestTarget, type TestTarget } from "./test-targets";

/** The point the analysis panel is open for, and the field of view it was chosen at. */
export type SkySelection = EquatorialCoordinates & { fov: number; target?: TestTarget };

// An empty parameter would coerce to 0, so each value must be a non-empty string before it becomes a number.
const number = () => z.string().trim().min(1).pipe(z.coerce.number());

const selectionParams = z
  .object({
    ra: number().pipe(z.number().min(0).lt(360)),
    dec: number().pipe(z.number().min(-90).max(90)),
    fov: number().pipe(z.number().positive().max(MAX_FOV)),
  })
  .strict();

/**
 * Reads `?ra=&dec=&fov=` (degrees). Anyone can craft the URL, so anything missing or out of range opens no panel.
 * Other parameters are ignored.
 */
export function parseSelection(searchParams: Record<string, string | string[] | undefined>): SkySelection | null {
  const { ra, dec, fov } = searchParams;
  const parsed = selectionParams.safeParse({ ra, dec, fov });
  if (!parsed.success) return null;
  return { ...parsed.data, target: findTestTarget(parsed.data) };
}

/** Shareable URL for a selection: about 0.04″ precision for RA/Dec. */
export function selectionUrl({ ra, dec, fov }: SkySelection): string {
  const params = new URLSearchParams({ ra: ra.toFixed(5), dec: dec.toFixed(5), fov: fov.toFixed(3) });
  return `/?${params}`;
}
