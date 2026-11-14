"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AutoOpenAnalysis } from "../analyses/additional-analyses";
import { AnalysisPanel } from "./analysis-panel";
import { AIM_FOV, CLICK_ZOOM_FOV, INITIAL_VIEW, MAX_FOV, MIN_FOV, SKY_SURVEY, TARGET_FOV } from "./constants";
import { setCursor, useCursor } from "./cursor-store";
import { type EquatorialCoordinates, formatDec, formatRa, type SkyView as SkyViewState } from "./sky-coordinates";
import {
  ALL_CANDIDATES,
  type CandidateFilter,
  findReviewEntry,
  nextReviewEntry,
  type ReviewEntry,
  reviewQueue,
} from "./review-queue";
import { SkySearchBox } from "./sky-search-box";
import { SkyControls } from "./sky-controls";
import { type SkySelection, selectionUrl, viewUrl } from "./sky-selection";
import type { Flight, SkyLayers } from "./sky-view";
import { MostRated } from "./most-rated";
import { TargetList } from "./target-list";
import { findTestTarget, type TestTarget } from "./test-targets";
import { getView, subscribeView } from "./view-store";

// Aladin Lite touches browser APIs as soon as it loads, so the sky renders only on the client.
const SkyView = dynamic(() => import("./sky-view"), { ssr: false });

/**
 * The sky screen: one Aladin Lite view from 120° down to arcminutes. Clicking a test target pin, or a point once zoomed
 * in to aim, opens the analysis panel and puts the point in the URL. A click on the wide view zooms in on that point
 * instead, so reaching a spot to analyze takes two clicks rather than many wheel steps.
 */
export function SkyExplorer({
  initialSelection,
  initialView,
  autoOpen,
}: {
  /** Opens the analysis panel at start (a shared `?ra=&dec=&fov=` link). */
  initialSelection: SkySelection | null;
  /** Where the sky starts, such as a shared link's point; the Galactic Center otherwise. */
  initialView?: SkyViewState;
  /** Opens one additional analysis in the panel at start (older `?stm=` / `?sonata=` links). */
  autoOpen?: AutoOpenAnalysis;
}) {
  const [startView] = useState<SkyViewState>(initialView ?? INITIAL_VIEW);
  const [aiming, setAiming] = useState(startView.fov <= AIM_FOV);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [selection, setSelection] = useState<SkySelection | null>(initialSelection);
  const [error, setError] = useState<string | null>(null);
  // A shared link's analysis opens only for the panel it came with, not for every place opened afterwards.
  const [linkedAnalysis, setLinkedAnalysis] = useState(autoOpen);
  const [candidateFilter, setCandidateFilter] = useState<CandidateFilter>(ALL_CANDIDATES);
  const [layers, setLayers] = useState<SkyLayers>({ pins: true, constellations: true, grid: true });
  const flightId = useRef(0);
  const selectionRef = useRef(selection);
  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);
  const queue = useMemo(() => reviewQueue(candidateFilter), [candidateFilter]);

  // Only crossing AIM_FOV changes state, so zooming does not re-render the screen.
  const onFovChange = useCallback((fov: number) => setAiming(fov <= AIM_FOV), []);

  // The URL follows the open panel without adding history entries (PLAN.md chapter 5).
  const openPanel = useCallback((next: SkySelection) => {
    setSelection(next);
    setLinkedAnalysis(undefined);
    window.history.replaceState(null, "", selectionUrl(next));
  }, []);
  const closePanel = useCallback(() => {
    setSelection(null);
    const view = getView();
    window.history.replaceState(null, "", view ? viewUrl(view) : "/");
  }, []);

  // With no panel open, the URL follows the view as `?view=ra,dec,fov` once it settles, so the address bar is always a
  // link to what is on screen. Browsers throttle replaceState, so it is not called on every frame.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeView(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const view = getView();
        if (view && !selectionRef.current) window.history.replaceState(null, "", viewUrl(view));
      }, 500);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  // Zoom buttons: an animated zoom about the view center. Repeated clicks during the animation build on the zoom
  // already asked for, not on the field of view the animation has reached.
  const lastZoom = useRef<{ fov: number; at: number } | null>(null);
  const zoomBy = useCallback((factor: number) => {
    const view = getView();
    if (!view) return;
    const now = performance.now();
    const base = lastZoom.current && now - lastZoom.current.at < 700 ? lastZoom.current.fov : view.fov;
    const fov = Math.min(Math.max(base * factor, MIN_FOV), MAX_FOV);
    lastZoom.current = { fov, at: now };
    flightId.current += 1;
    setFlight({ ra: view.ra, dec: view.dec, fov, id: flightId.current });
  }, []);

  // A test target or a searched point: fly there and open the panel, which the flight shows through.
  const goTo = useCallback(
    (point: EquatorialCoordinates, target?: TestTarget) => {
      flightId.current += 1;
      setFlight({ ...point, fov: TARGET_FOV, id: flightId.current });
      openPanel({ ...point, fov: TARGET_FOV, target: target ?? findTestTarget(point) });
    },
    [openPanel],
  );
  const goToTarget = useCallback((target: TestTarget) => goTo(target, target), [goTo]);
  // Too wide to aim: a click on empty sky only zooms in on that point. At 90° one screen pixel is about 3′, as large as
  // the analysis cutout, so the panel opens on the next click, once the user can see what they are picking.
  const zoomTo = useCallback((point: EquatorialCoordinates) => {
    flightId.current += 1;
    setFlight({ ...point, fov: CLICK_ZOOM_FOV, id: flightId.current });
  }, []);
  const selectPoint = useCallback(
    (point: EquatorialCoordinates, fov: number, target?: TestTarget) => {
      if (target && fov > AIM_FOV) goTo(target, target);
      else if (fov > AIM_FOV) zoomTo(point);
      else openPanel({ ...point, fov, target: target ?? findTestTarget(point) });
    },
    [goTo, openPanel, zoomTo],
  );

  // A list entry flies there and opens the panel like a pin; "Next" in the panel walks the same order.
  const goToEntry = useCallback(
    (entry: ReviewEntry) => (entry.kind === "test" ? goTo(entry.point, entry.target) : goTo(entry.point)),
    [goTo],
  );
  const currentEntry = selection ? findReviewEntry(queue, selection) : undefined;
  const nextEntry = selection ? nextReviewEntry(queue, currentEntry) : undefined;
  const next = useMemo(
    () => (nextEntry ? { name: nextEntry.name, go: () => goToEntry(nextEntry) } : undefined),
    [nextEntry, goToEntry],
  );

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black text-white">
      <SkyView
        initialView={startView}
        flight={flight}
        layers={layers}
        onCursorMove={setCursor}
        onFovChange={onFovChange}
        onSelect={selectPoint}
        onError={setError}
      />
      {/* Top-left column: the search box (and any search message below it), then the places to analyze. */}
      <div className="absolute top-4 left-4 z-10 flex flex-col items-start gap-2">
        <SkySearchBox onTarget={goToTarget} onPoint={goTo} />
        <TargetList
          queue={queue}
          currentId={currentEntry?.id}
          filter={candidateFilter}
          onFilterChange={setCandidateFilter}
          onSelect={goToEntry}
        />
        <MostRated onSelect={goTo} />
      </div>
      <CursorReadout aiming={aiming} />
      <div className="absolute top-4 right-4 z-10">
        <SkyControls layers={layers} onLayersChange={setLayers} onZoom={zoomBy} />
      </div>
      {error && (
        <p role="alert" className="absolute top-4 left-1/2 -translate-x-1/2 rounded-md bg-red-950/80 px-3 py-2 text-sm">
          Sky view unavailable: {error}
        </p>
      )}
      {/* The credit sits above the Aladin Lite logo, which stays visible in the bottom-right corner. */}
      <div className="pointer-events-none absolute right-4 bottom-12 max-w-md text-right text-xs leading-5">
        {SKY_SURVEY.notice && <p className="text-amber-300">{SKY_SURVEY.notice}</p>}
        <p className="text-white/60">{SKY_SURVEY.credit}</p>
      </div>
      <AnalysisPanel selection={selection} onClose={closePanel} autoOpen={linkedAnalysis} next={next} />
    </div>
  );
}

function CursorReadout({ aiming }: { aiming: boolean }) {
  const cursor = useCursor();
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 rounded-md bg-black/60 px-3 py-2 font-mono text-xs leading-5 text-white/80">
      <div>{aiming ? "Aiming · click to analyze" : "Click to zoom in · click a pin to analyze"}</div>
      <div>RA {cursor ? formatRa(cursor.ra) : "—"}</div>
      <div>Dec {cursor ? formatDec(cursor.dec) : "—"}</div>
    </div>
  );
}
