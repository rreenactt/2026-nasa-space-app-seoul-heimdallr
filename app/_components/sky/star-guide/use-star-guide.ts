import "client-only";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/ky";
import type { GaiaStar } from "@/app/_lib/sky/types";
import { angularDistance, normalizeRa } from "../sky-coordinates";
import type { SettledSky } from "../sky-view";

/**
 * Star guide (decision #48): points out stars in the view that Gaia DR3 measured moving, as places worth opening to
 * watch a star move. Known stars, not candidates: it teaches where motion can be seen, it does not find anything new.
 */

/** The guide looks up stars at this field of view (degrees) or narrower; the Gaia cone query allows a 3° radius. */
export const GUIDE_MAX_FOV = 5;
/** Stars already collected are still drawn up to this field of view. */
export const GUIDE_DRAW_FOV = 10;
/**
 * Slowest motion listed, mas/yr. 0.2″/yr is about one 6.2″ SPHEREx pixel over the 27 years between 2MASS (about 1999)
 * and SPHEREx (2025–26), so every star listed visibly moves in the Sky Time Machine comparison.
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
/** Largest cone radius the API accepts, degrees. */
const MAX_RADIUS = 3;

type FastStarsAnswer = { stars: GaiaStar[]; service: string; truncated: boolean };

/** One Gaia cone query. */
type Cone = { key: string; ra: number; dec: number; radius: number };

/**
 * Everything collected this page visit, kept at module level so it outlives the sky screen (opening About and coming
 * back keeps it). `covered` lists the cones already asked; a view inside one of them needs no new query.
 */
const collected = { stars: new Map<string, GaiaStar>(), covered: [] as Cone[] };

/** Radius (degrees) of the circle around the view's center that contains the whole view. */
function viewRadius(view: SettledSky) {
  return (view.fov / 2) * Math.hypot(1, view.height / Math.max(view.width, 1));
}

/**
 * The cone to ask for a view. Its size steps in powers of two and its center snaps to a grid of half that, so coming
 * back to roughly the same place asks the same cone (and TanStack Query answers from its cache). 1.5 × the step size
 * still covers the view after snapping. Past the 3° limit the cone is centered on the view itself.
 */
function coneFor(view: SettledSky): Cone {
  const half = viewRadius(view);
  const level = 2 ** Math.ceil(Math.log2(half));
  if (1.5 * level > MAX_RADIUS) {
    const ra = Number(normalizeRa(view.ra).toFixed(2));
    const dec = Number(view.dec.toFixed(2));
    return { key: `${ra} ${dec} ${MAX_RADIUS}`, ra, dec, radius: MAX_RADIUS };
  }
  const step = level / 2;
  const dec = Math.min(Math.max(Math.round(view.dec / step) * step, -90), 90);
  const raStep = step / Math.max(Math.cos((dec * Math.PI) / 180), 0.05);
  const ra = normalizeRa(Math.round(view.ra / raStep) * raStep);
  const radius = 1.5 * level;
  return { key: `${ra.toFixed(4)} ${dec.toFixed(4)} ${radius}`, ra, dec, radius };
}

/** Whether a cone already asked contains the whole view. */
function isCovered(view: SettledSky) {
  const half = viewRadius(view);
  return collected.covered.some((cone) => angularDistance(cone, view) + half <= cone.radius);
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
  const dx = (((ra - view.ra + 540) % 360) - 180) * Math.cos((view.dec * Math.PI) / 180);
  const halfHeight = (view.fov / 2) * (view.height / Math.max(view.width, 1));
  return Math.abs(dx) <= view.fov / 2 && Math.abs(dec - view.dec) <= halfHeight;
}

export type GuidePhase =
  /** Zoomed out beyond GUIDE_MAX_FOV: nothing new is looked up. */
  | "too-wide"
  /** Moving, or not yet still. */
  | "waiting"
  | "loading"
  | "error"
  | "ready";

export type StarGuideState =
  | { status: "off" }
  | {
      status: "on";
      phase: GuidePhase;
      /** Every star collected so far, fastest first; drawn wherever they are on screen. */
      known: GaiaStar[];
      /** The fastest stars on the last settled screen, as numbered in the card. */
      listed: GaiaStar[];
      /** The view is moving: callouts follow whatever is fastest on screen, without the entrance animation. */
      moving: boolean;
    };

export function useStarGuide(enabled: boolean) {
  const [view, setView] = useState<SettledSky | null>(null);
  const [cone, setCone] = useState<Cone | null>(null);
  const [moving, setMoving] = useState(true);
  // Bumped when the collection grows, so the lists are worked out again.
  const [version, setVersion] = useState(0);

  const onSettle = useCallback((settled: SettledSky | null) => {
    if (!settled) {
      setMoving(true);
      return;
    }
    setMoving(false);
    setView(settled);
    if (settled.fov <= GUIDE_MAX_FOV && !isCovered(settled)) {
      const next = coneFor(settled);
      setCone((previous) => (previous?.key === next.key ? previous : next));
    }
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
    gcTime: Infinity,
  });

  // Fold each answer into the collection. A cut-off answer (300 fastest) does not count as covering its cone.
  useEffect(() => {
    if (!query.data || !cone) return;
    for (const star of query.data.stars) collected.stars.set(star.sourceId, star);
    if (!query.data.truncated && !collected.covered.some((c) => c.key === cone.key)) collected.covered.push(cone);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the collection lives outside React; this re-reads it
    setVersion((v) => v + 1);
  }, [query.data, cone]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` stands for the collection, which lives outside React
  const known = useMemo(() => [...collected.stars.values()].sort((a, b) => totalPm(b) - totalPm(a)), [version]);
  const listed = useMemo(
    () => (view && view.fov <= GUIDE_DRAW_FOV ? known.filter((star) => onScreen(star, view)).slice(0, GUIDE_STARS) : []),
    [known, view],
  );
  const phase: GuidePhase =
    !view || moving
      ? "waiting"
      : view.fov > GUIDE_MAX_FOV
        ? "too-wide"
        : query.isFetching
          ? "loading"
          : query.isError
            ? "error"
            : "ready";
  const state = useMemo<StarGuideState>(
    () => (enabled ? { status: "on", phase, known, listed, moving } : { status: "off" }),
    [enabled, phase, known, listed, moving],
  );
  return { state, onSettle: enabled ? onSettle : undefined };
}
