import "client-only";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { api } from "@/lib/ky";
import type { GaiaStar } from "@/app/_lib/sky/types";
import { normalizeRa } from "../sky-coordinates";
import type { SettledSky } from "../sky-view";

/**
 * Star guide (decision #48): points out stars in the view that Gaia DR3 measured moving, as places worth opening to
 * watch a star move. Known stars, not candidates: it teaches where motion can be seen, it does not find anything new.
 */

/** The guide looks only at this field of view (degrees) or narrower; the Gaia cone query allows a 3° radius. */
export const GUIDE_MAX_FOV = 5;
/**
 * Slowest motion listed, mas/yr. 0.2″/yr is about one 6.2″ SPHEREx pixel over the 27 years between 2MASS (about 1999)
 * and SPHEREx (2025–26), so every star listed visibly moves in the Sky Time Machine comparison.
 */
export const GUIDE_MIN_PM = 200;
/** The fastest this many stars are marked and listed. */
export const GUIDE_STARS = 5;
/** Gaia DR3 positions are for this epoch. */
export const GAIA_EPOCH = 2016.0;
/** About when SPHEREx DR1 observed (2025–26). */
export const SPHEREX_EPOCH = 2026.0;
/** SPHEREx pixel size, arcseconds. */
export const SPHEREX_PIXEL_ARCSEC = 6.2;

type FastStarsAnswer = { stars: GaiaStar[]; service: string; truncated: boolean };

/** One Gaia cone over the settled view, rounded so a tiny nudge reuses the answer. */
type Cone = { key: string; ra: number; dec: number; radius: number };

function coneFor(view: SettledSky): Cone | null {
  if (view.fov > GUIDE_MAX_FOV) return null;
  const halfDiagonal = (view.fov / 2) * Math.hypot(1, view.height / Math.max(view.width, 1));
  const radius = Math.min(Math.ceil(halfDiagonal * 1.05 * 100) / 100, 3);
  const ra = Number(normalizeRa(view.ra).toFixed(3));
  const dec = Number(view.dec.toFixed(3));
  return { key: `${ra} ${dec} ${radius}`, ra, dec, radius };
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

/** Whether a star's position now falls inside the view (flat-sky approximation, fine below a few degrees). */
function onScreen(star: GaiaStar, view: SettledSky) {
  const [ra, dec] = positionAt(star, SPHEREX_EPOCH);
  const dx = ((((ra - view.ra + 540) % 360) - 180) * Math.cos((view.dec * Math.PI) / 180));
  const halfHeight = (view.fov / 2) * (view.height / Math.max(view.width, 1));
  return Math.abs(dx) <= view.fov / 2 && Math.abs(dec - view.dec) <= halfHeight;
}

export type StarGuideState =
  | { status: "off" }
  /** Zoomed out beyond GUIDE_MAX_FOV. */
  | { status: "too-wide" }
  /** On, waiting for the view to hold still. */
  | { status: "waiting" }
  | { status: "loading" }
  | { status: "error" }
  /** `stale`: the view moved since; the marks stay (dimmed) until the next answer. */
  | { status: "done"; stars: GaiaStar[]; truncated: boolean; stale: boolean };

export function useStarGuide(enabled: boolean) {
  const [cone, setCone] = useState<Cone | null>(null);
  const [view, setView] = useState<SettledSky | null>(null);
  const [tooWide, setTooWide] = useState(false);
  const [moving, setMoving] = useState(true);

  const onSettle = useCallback((settled: SettledSky | null) => {
    if (!settled) {
      setMoving(true);
      return;
    }
    setMoving(false);
    setView(settled);
    const next = coneFor(settled);
    setTooWide(next === null);
    if (next) setCone((previous) => (previous?.key === next.key ? previous : next));
  }, []);

  const query = useQuery({
    queryKey: ["sky", "fast-stars", cone?.key],
    queryFn: ({ signal }) =>
      api
        .get("/api/sky/fast-stars", {
          searchParams: { ra: cone!.ra, dec: cone!.dec, radius: cone!.radius, minPm: GUIDE_MIN_PM },
          timeout: 65_000,
          signal,
        })
        .json<FastStarsAnswer>(),
    enabled: enabled && cone !== null,
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });

  let state: StarGuideState;
  if (!enabled) state = { status: "off" };
  else if (tooWide && !moving) state = { status: "too-wide" };
  else if (query.data)
    state = {
      status: "done",
      // The cone is a circle around the screen; keep the stars inside the screen itself.
      stars: query.data.stars.filter((star) => !view || onScreen(star, view)).slice(0, GUIDE_STARS),
      truncated: query.data.truncated,
      stale: moving || query.isFetching,
    };
  else if (query.isError) state = { status: "error" };
  else if (cone && !moving) state = { status: "loading" };
  else state = { status: "waiting" };

  return { state, onSettle: enabled ? onSettle : undefined };
}
