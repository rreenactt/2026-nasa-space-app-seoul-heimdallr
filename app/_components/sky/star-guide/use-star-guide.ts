import "client-only";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { api } from "@/lib/ky";
import type { GaiaStar } from "@/app/_lib/sky/types";
import { angularDistance, normalizeRa } from "../sky-coordinates";
import type { SettledSky } from "../sky-view";

/**
 * Star guide (decision #48): points out stars in the view that Gaia DR3 measured moving, as places worth opening to
 * watch a star move. Known stars, not candidates: it teaches where motion can be seen, it does not find anything new.
 *
 * The stars come from a static catalog of every Gaia DR3 star moving GUIDE_MIN_PM or faster (about 70,000, built by
 * scripts/fast-stars-catalog.ts). It loads once, the first time the guide is switched on; after that any view is
 * answered in the browser, with no request.
 */

export const CATALOG_URL = "/data/gaia-fast-stars.json";
/** Stars are listed and drawn at this field of view (degrees) or narrower. */
export const GUIDE_MAX_FOV = 10;
/**
 * Slowest motion in the catalog, mas/yr. 0.2″/yr is about one 6.2″ SPHEREx pixel over the 27 years between 2MASS
 * (about 1999) and SPHEREx (2025–26), so every star listed visibly moves in the Sky Time Machine comparison.
 */
export const GUIDE_MIN_PM = 200;
/** The fastest this many stars on screen get a number, a callout and a row in the card. */
export const GUIDE_STARS = 5;
/** Gaia DR3 positions are for this epoch. */
export const GAIA_EPOCH = 2016.0;
/** About when SPHEREx DR1 observed (2025–26). */
export const SPHEREX_EPOCH = 2026.0;
/** SPHEREx pixel size, arcseconds. */
export const SPHEREX_PIXEL_ARCSEC = 6.2;
/** Catalog index cell size, degrees. */
const CELL = 2;

/** [ra, dec, pmra, pmdec, parallax], fastest first (see scripts/fast-stars-catalog.ts). */
type CatalogRow = [number, number, number, number, number | null];

export type Catalog = { stars: GaiaStar[]; cells: Map<string, GaiaStar[]> };

const cellKey = (ra: number, dec: number) => `${Math.floor(normalizeRa(ra) / CELL)} ${Math.floor((dec + 90) / CELL)}`;

export function buildCatalog(rows: CatalogRow[]): Catalog {
  const cells = new Map<string, GaiaStar[]>();
  // The row number (fastest first) is the star's id here, so sorting by id keeps the fastest first.
  const stars = rows.map(([ra, dec, pmra, pmdec, parallax], index): GaiaStar => ({
    sourceId: String(index),
    ra,
    dec,
    pmra,
    pmdec,
    parallax,
    gmag: null,
  }));
  for (const star of stars) {
    const key = cellKey(star.ra, star.dec);
    const list = cells.get(key);
    if (list) list.push(star);
    else cells.set(key, [star]);
  }
  return { stars, cells };
}

/** Search radius around the view's center: out to its farthest corner, plus room for motion since 2016 (0.1°). */
const searchRadius = (view: { radius: number }) => view.radius + 0.1;

/**
 * The stars to number: the fastest on screen that are not hidden under the interface (the card, the tool bar), so
 * every numbered star and its callout can be seen.
 */
export function pickNumbered(stars: GaiaStar[], view: { project: SettledSky["project"]; covered: SettledSky["covered"] }) {
  const picked: GaiaStar[] = [];
  for (const star of stars) {
    if (picked.length === GUIDE_STARS) break;
    const point = view.project(...positionAt(star, SPHEREX_EPOCH));
    if (point && !view.covered(point[0], point[1])) picked.push(star);
  }
  return picked;
}

/**
 * Catalog stars whose 2026 position is on screen, fastest first. The same test for the sky marks and the card, through
 * the view's own projection, so the two always agree.
 */
export function starsOnScreen(
  catalog: Catalog,
  view: { ra: number; dec: number; radius: number; width: number; height: number; project: SettledSky["project"] },
): GaiaStar[] {
  return starsNear(catalog, view.ra, view.dec, searchRadius(view)).filter((star) => {
    const point = view.project(...positionAt(star, SPHEREX_EPOCH));
    return point !== null && point[0] >= 0 && point[1] >= 0 && point[0] <= view.width && point[1] <= view.height;
  });
}

/** Catalog stars within `radius` degrees of a point, fastest first, from the index cells that circle touches. */
export function starsNear(catalog: Catalog, ra: number, dec: number, radius: number): GaiaStar[] {
  const out: GaiaStar[] = [];
  const decLow = Math.max(dec - radius, -90);
  const decHigh = Math.min(dec + radius, 90);
  const nearPole = Math.max(Math.abs(decLow), Math.abs(decHigh)) > 85;
  const raHalf = nearPole ? 180 : radius / Math.cos((Math.max(Math.abs(decLow), Math.abs(decHigh)) * Math.PI) / 180);
  const columns = 360 / CELL;
  const firstColumn = nearPole || raHalf >= 180 ? 0 : Math.floor(normalizeRa(ra - raHalf) / CELL);
  const columnCount = nearPole || raHalf >= 180 ? columns : Math.ceil((2 * raHalf) / CELL) + 1;
  for (let row = Math.floor((decLow + 90) / CELL); row <= Math.floor((Math.min(decHigh, 89.999) + 90) / CELL); row++) {
    for (let i = 0; i < Math.min(columnCount, columns); i++) {
      const list = (catalogCell(catalog, (firstColumn + i) % columns, row));
      for (const star of list) if (angularDistance(star, { ra, dec }) <= radius) out.push(star);
    }
  }
  return out.sort((a, b) => Number(a.sourceId) - Number(b.sourceId));
}

function catalogCell(catalog: Catalog, column: number, row: number) {
  return catalog.cells.get(`${column} ${row}`) ?? [];
}

/** Linear proper motion from the Gaia epoch, parallax ignored (decision #27). */
export function positionAt(star: GaiaStar, year: number): [number, number] {
  const years = year - GAIA_EPOCH;
  const cosDec = Math.max(Math.cos((star.dec * Math.PI) / 180), 1e-6);
  return [normalizeRa(star.ra + (star.pmra * years) / 3.6e6 / cosDec), star.dec + (star.pmdec * years) / 3.6e6];
}

export function totalPm(star: GaiaStar) {
  return Math.hypot(star.pmra, star.pmdec);
}

/** Light years from a Gaia parallax (mas); null when the parallax is too small to say. */
export function lightYears(parallax: number | null) {
  return parallax && parallax > 1 ? 3261.56 / parallax : null;
}

export type GuidePhase =
  /** The catalog is still loading (the first time only). */
  | "loading"
  | "error"
  /** Zoomed out beyond GUIDE_MAX_FOV. */
  | "too-wide"
  | "ready";

export type StarGuideState =
  | { status: "off" }
  | {
      status: "on";
      phase: GuidePhase;
      /** The loaded catalog; the painter picks the stars around the current view from it on every frame. */
      catalog: Catalog | null;
      /** The fastest stars on the last settled screen, as numbered in the card. */
      listed: GaiaStar[];
      /** The view is moving: callouts follow whatever is fastest on screen. */
      moving: boolean;
    };

export function useStarGuide(enabled: boolean) {
  const [view, setView] = useState<SettledSky | null>(null);
  const [moving, setMoving] = useState(true);

  const onSettle = useCallback((settled: SettledSky | null) => {
    setMoving(settled === null);
    if (settled) setView(settled);
  }, []);

  const catalog = useQuery({
    queryKey: ["sky", "fast-star-catalog"],
    queryFn: async ({ signal }) => buildCatalog(await api.get(CATALOG_URL, { timeout: 60_000, signal }).json<CatalogRow[]>()),
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const listed = useMemo(
    () =>
      catalog.data && view && view.fov <= GUIDE_MAX_FOV
        ? pickNumbered(starsOnScreen(catalog.data, view), view)
        : [],
    [catalog.data, view],
  );
  const phase: GuidePhase = catalog.isError
    ? "error"
    : !catalog.data
      ? "loading"
      : view && view.fov > GUIDE_MAX_FOV
        ? "too-wide"
        : "ready";
  const state = useMemo<StarGuideState>(
    () => (enabled ? { status: "on", phase, catalog: catalog.data ?? null, listed, moving } : { status: "off" }),
    [enabled, phase, catalog.data, listed, moving],
  );
  return { state, onSettle: enabled ? onSettle : undefined, total: catalog.data?.stars.length ?? null };
}
