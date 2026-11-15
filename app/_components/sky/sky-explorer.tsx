"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AutoOpenAnalysis } from "../analyses/analyses-context";
import { AnalysisPanel } from "./analysis-panel";
import { AIM_FOV, CLICK_ZOOM_FOV, INITIAL_VIEW, MAX_FOV, MIN_FOV, SKY_SURVEY, TARGET_FOV } from "./constants";
import { setCursor, useCursor } from "./cursor-store";
import {
  angularDistance,
  clamp,
  type EquatorialCoordinates,
  formatDec,
  formatRa,
  normalizeRa,
  type SkyView as SkyViewState,
} from "./sky-coordinates";
import {
  ALL_CANDIDATES,
  type CandidateFilter,
  MOVEMENT_CANDIDATES,
  findReviewEntry,
  type ReviewEntry,
  reviewQueue,
} from "./review-queue";
import { ListIcon } from "lucide-react";
import { cn } from "cn";
import { Keycap } from "../site/keycap";
import { DEFAULT_OVERLAYS, type SkyOverlays, skyLayers } from "./overlays";
import { SkyIntro } from "./sky-intro";
import { ShortcutSheet, useSkyShortcuts } from "./sky-shortcuts";
import { SiteHeader } from "../site/site-header";
import { SkyFrame } from "./sky-frame";
import { SkyHeaderActions } from "./sky-header-actions";
import { ShowOnSky, SkyTools } from "./sky-tools";
import { type SkySelection, selectionUrl, viewUrl } from "./sky-selection";
import type { Flight, SkyPainter } from "./sky-view";
import { FovScale } from "./fov-scale";
import { paintCandidates } from "./candidate-layer";
import { clearPlaces, recordPlace, samePlace, usePlaceHistory } from "./place-history";
import { RatingGuide, ReviewQueuePanel } from "./review-queue-panel";
import { MostRated } from "./most-rated";
import { ViewCenter } from "./view-center";
import { findTestTarget, TEST_TARGETS, type TestTarget } from "./test-targets";
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
  const [overlays, setOverlays] = useStoredOverlays();
  const layers = useMemo(() => skyLayers(overlays), [overlays]);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const opened = usePlaceHistory();
  // A place being flown to: the frame closes in and a ring marks it; the panel opens when the camera lands
  // (Figma "I · Frame states · Flying to a target").
  const [flyingTo, setFlyingTo] = useState<(SkySelection & { id: number }) | null>(null);
  const flyingRef = useRef(flyingTo);
  useEffect(() => {
    flyingRef.current = flyingTo;
  }, [flyingTo]);
  // The queue row picked with a click, N or P (decision #48): the camera flies there and a ring with its name and
  // position marks it, but the analysis opens only with Enter, "Open blink" or a second click on the row.
  const [picked, setPicked] = useState<ReviewEntry | null>(null);
  // True while the camera flies to the picked place, which may start off screen.
  const pickFlight = useRef(false);
  const painter = useMemo<SkyPainter>(
    () => (context, frame) =>
      paintCandidates(context, frame, {
        candidates: MOVEMENT_CANDIDATES,
        overlays,
        opened,
        selected: flyingTo ?? selection,
        picked: picked && { ...picked.point, name: picked.kind === "candidate" ? picked.candidate.id : picked.name },
      }),
    [overlays, opened, selection, flyingTo, picked],
  );
  const [queueOpen, setQueueOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  // The About and Method pages link to the sky with #search to open the search box.
  useEffect(() => {
    if (window.location.hash !== "#search") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the address after mount
    setSearchOpen(true);
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);
  // The pick lives only while the queue is open: folding the queue (Hide, Q, Esc, a drag) drops it (decision #48).
  const foldQueue = useCallback(() => {
    setQueueOpen(false);
    setPicked(null);
  }, []);
  // A drag takes the view back: the queue folds and a flight in progress is abandoned (its panel does not open).
  const onDragStart = useCallback(() => {
    foldQueue();
    setFlyingTo(null);
    pickFlight.current = false;
  }, [foldQueue]);
  const dragging = useSkyDrag(onDragStart);
  // The frame comes in for a scene (flying to a place, the queue open, a place open) and stays off while looking
  // around or in full screen (decision #38, Figma "I · Frame states").
  const framed = !fullscreen && (selection !== null || queueOpen || flyingTo !== null || picked !== null);
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
    // Opening another place drops the pick; opening the picked place keeps it.
    setPicked((entry) => (entry && samePlace(entry.point, next) ? entry : null));
    setLinkedAnalysis(undefined);
    recordPlace({ ra: next.ra, dec: next.dec, name: next.target?.name });
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

  // A test target, a queue row, Next or a searched point: close any open panel, fly there with the frame on, and open
  // the panel once the camera lands.
  const goTo = useCallback((point: EquatorialCoordinates, target?: TestTarget) => {
    flightId.current += 1;
    const id = flightId.current;
    setSelection(null);
    setFlight({ ...point, fov: TARGET_FOV, id });
    setFlyingTo({ ...point, fov: TARGET_FOV, target: target ?? findTestTarget(point), id });
  }, []);
  const onFlightEnd = useCallback(
    (id: number) => {
      pickFlight.current = false;
      const flying = flyingRef.current;
      if (!flying) return;
      // Another flight (zoom, pan, back to the first view) replaced this one: the place is not opened.
      if (flying.id !== id) {
        setFlyingTo(null);
        return;
      }
      setFlyingTo(null);
      openPanel({ ra: flying.ra, dec: flying.dec, fov: flying.fov, target: flying.target });
    },
    [openPanel],
  );
  // A wheel zoom also takes the view back from a flight, which then never lands.
  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      if (!(event.target instanceof Element && event.target.closest("[data-sky-surface]"))) return;
      setFlyingTo(null);
      pickFlight.current = false;
    };
    window.addEventListener("wheel", onWheel, { capture: true, passive: true });
    return () => window.removeEventListener("wheel", onWheel, { capture: true });
  }, []);
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

  // Opening a list entry flies there and opens the panel like a pin.
  const goToEntry = useCallback(
    (entry: ReviewEntry) => (entry.kind === "test" ? goTo(entry.point, entry.target) : goTo(entry.point)),
    [goTo],
  );
  const currentEntry = selection ? findReviewEntry(queue, selection) : undefined;

  // Opening the queue, N/P, or a shared candidate link turns candidates back on (decision #40).
  const showCandidates = useCallback(
    () => setOverlays((value) => (value.candidates ? value : { ...value, candidates: true })),
    [setOverlays],
  );
  const toggleQueue = useCallback(() => {
    if (queueOpen) return foldQueue();
    setQueueOpen(true);
    showCandidates();
  }, [queueOpen, foldQueue, showCandidates]);
  // Picking a row, N or P: fly there with the frame on and mark the place, without opening the panel (decision #48).
  const pick = useCallback(
    (entry: ReviewEntry) => {
      flightId.current += 1;
      pickFlight.current = true;
      setFlyingTo(null);
      setPicked(entry);
      // N and P with the queue folded open it, so a pick is never hidden.
      setQueueOpen(true);
      showCandidates();
      setFlight({ ...entry.point, fov: TARGET_FOV, id: flightId.current });
    },
    [showCandidates],
  );
  // Enter and "Open blink" open the picked place.
  const openPicked = useCallback(() => {
    if (picked) goToEntry(picked);
  }, [picked, goToEntry]);
  // A click on the picked row opens it; any other row is picked.
  const onRow = useCallback(
    (entry: ReviewEntry) => (picked?.id === entry.id ? goToEntry(entry) : pick(entry)),
    [picked, goToEntry, pick],
  );
  const step = useCallback(
    (direction: 1 | -1) => {
      if (queue.length === 0) return;
      const from = picked ?? currentEntry;
      const index = from ? queue.findIndex((entry) => entry.id === from.id) : -1;
      pick(queue[(index + direction + queue.length) % queue.length] ?? queue[0]);
    },
    [queue, picked, currentEntry, pick],
  );
  // The pick ends once its place leaves the screen, so Enter never opens a place the user cannot see.
  useEffect(() => {
    if (!picked) return;
    return subscribeView(() => {
      const view = getView();
      if (view && !pickFlight.current && angularDistance(view, picked.point) > view.fov / 2) setPicked(null);
    });
  }, [picked]);
  const pan = useCallback((dx: number, dy: number) => {
    const view = getView();
    if (!view) return;
    const stepDeg = view.fov * 0.15;
    const dec = clamp(view.dec + dy * stepDeg, -90, 90);
    const ra = normalizeRa(view.ra - (dx * stepDeg) / Math.max(Math.cos((view.dec * Math.PI) / 180), 0.05));
    flightId.current += 1;
    setFlight({ ra, dec, fov: view.fov, id: flightId.current });
  }, []);

  const goHome = useCallback(() => {
    flightId.current += 1;
    setFlight({ ...INITIAL_VIEW, id: flightId.current });
  }, []);

  // Full screen keeps the frame off until it is left again.
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  }, []);

  useSkyShortcuts(
    {
      zoom: zoomBy,
      pan,
      fullscreen: toggleFullscreen,
      queue: toggleQueue,
      next: () => step(1),
      previous: () => step(-1),
      // Enter: the picked place; with nothing picked, the view center, unless the queue is open (decision #48).
      open: () => {
        if (picked) return openPicked();
        if (queueOpen) return;
        const view = getView();
        if (view) selectPoint(view, view.fov);
      },
      candidates: () => setOverlays((value) => ({ ...value, candidates: !value.candidates })),
      layers: () => setLayersOpen((open) => !open),
      search: () => setSearchOpen(true),
      help: () => setShortcutsOpen(true),
      escape: () => {
        if (layersOpen) setLayersOpen(false);
        else if (searchOpen) setSearchOpen(false);
        else if (queueOpen) foldQueue();
      },
    },
    // The analysis panel and the shortcut sheet are dialogs with their own keys.
    selection === null && !shortcutsOpen,
  );

  return (
    <div data-sky-framed={framed} className="relative h-dvh w-full overflow-hidden bg-ink text-paper">
      <div data-sky-surface className="absolute inset-0">
        <SkyView
          initialView={startView}
          flight={flight}
          layers={layers}
          painter={painter}
          onCursorMove={setCursor}
          onFovChange={onFovChange}
          onFlightEnd={onFlightEnd}
          onSelect={selectPoint}
          onError={setError}
        />
      </div>
      {/* Where Enter analyzes: the view center while aiming, only with the frame off (decision #49). */}
      <ViewCenter hidden={!aiming || framed} />
      <SkyFrame on={framed} dim={selection !== null} />
      <SiteHeader
        className={cn(
          "absolute inset-x-0 top-0 z-20 transition-opacity duration-300",
          framed || searchOpen
            ? "opacity-100"
            : dragging
              ? "pointer-events-none opacity-0"
              : "opacity-70 hover:opacity-100 focus-within:opacity-100",
        )}
        actions={
          <SkyHeaderActions
            onTarget={goToTarget}
            onPoint={goTo}
            searchOpen={searchOpen}
            onSearchOpenChange={setSearchOpen}
            menuGroups={[
              [
                { label: "Keyboard shortcuts", key: "?", onSelect: () => setShortcutsOpen(true) },
                {
                  label: "How to rate",
                  onSelect: () => {
                    setQueueOpen(true);
                    setGuideOpen(true);
                  },
                },
              ],
              [
                {
                  label: "Test targets",
                  items: TEST_TARGETS.map((target) => ({ label: target.name, onSelect: () => goToTarget(target) })),
                },
              ],
              [
                { label: "Data sources and credits", href: "/method#sources" },
                {
                  label: "Clear places you opened",
                  hint: opened.length ? opened.length.toLocaleString("en-US") : undefined,
                  disabled: opened.length === 0,
                  onSelect: clearPlaces,
                },
              ],
            ]}
          />
        }
      />
      {/* Everything anchored to the sky sits in this box, which shrinks with the frame. */}
      <div
        className={cn(
          "pointer-events-none absolute z-10 font-ui transition-[inset] ease-out-expo",
          framed ? "inset-[56px_12px_12px_12px] duration-500" : "inset-[56px_0_0_0] duration-250",
        )}
      >
        {/* Reviewing (Figma "I · Frame states · Reviewing"): the queue takes the button's place inside the frame,
            nearly full height, and "How to rate" sits at the top right. */}
        {queueOpen ? (
          <>
            <div className="pointer-events-auto absolute top-4 bottom-[76px] left-4">
              <ReviewQueuePanel
                queue={queue}
                currentId={currentEntry?.id}
                pickedId={picked?.id}
                filter={candidateFilter}
                onFilterChange={setCandidateFilter}
                onSelect={onRow}
                onOpenPlace={goTo}
                onOpenPicked={openPicked}
                onStep={step}
                onClose={foldQueue}
              />
            </div>
            <div className="pointer-events-auto absolute top-4 right-4">
              <RatingGuide open={guideOpen} onOpenChange={setGuideOpen} />
            </div>
          </>
        ) : (
          <div className="pointer-events-auto absolute top-3 left-6 flex flex-col items-start gap-2">
            {/* Figma "I · Explore": 214 × 32 with the candidate count and the key at the right end. */}
            <button
              type="button"
              aria-expanded={false}
              onClick={toggleQueue}
              className="flex h-8 w-[214px] items-center gap-2 rounded-[2px] bg-ink/80 pr-2 pl-2.5 text-[13px] font-medium text-paper transition-colors hover:bg-ink"
            >
              <ListIcon className="size-4 stroke-[1.5]" aria-hidden />
              Review queue
              <span className="text-xs font-normal text-ash">{MOVEMENT_CANDIDATES.length.toLocaleString("en-US")}</span>
              <Keycap className="ml-auto">Q</Keycap>
            </button>
            {/* Most rated places (from main, decision #35). Not in the Figma screens yet, so it sits under the button. */}
            <MostRated onSelect={goTo} />
          </div>
        )}
        {/* Centred on the screen rather than on this box (Figma: icons 20px from the edge, 34px apart). */}
        <div
          className={cn(
            "pointer-events-auto absolute top-1/2 right-3.5 -translate-y-1/2 transition-[margin] duration-500 ease-out-expo",
            framed ? "-mt-2" : "-mt-7",
          )}
        >
          <SkyTools
            candidatesOff={!overlays.candidates}
            onZoom={zoomBy}
            onHome={goHome}
            fullscreen={fullscreen}
            onFullscreen={toggleFullscreen}
            layersOpen={layersOpen}
            onLayersOpenChange={setLayersOpen}
            layersPanel={<ShowOnSky overlays={overlays} onChange={setOverlays} onClose={() => setLayersOpen(false)} />}
          />
        </div>
        <CursorReadout hidden={framed} />
        <FovScale hidden={framed} aiming={aiming} />
        {!overlays.candidates && !framed && (
          <button
            type="button"
            onClick={showCandidates}
            className="pointer-events-auto absolute bottom-[52px] left-6 flex h-8 items-center gap-3 rounded-[2px] bg-ink/80 pr-2 pl-3 text-[13px] text-bone hover:text-paper"
          >
            Candidates hidden
            <span className="font-medium text-paper">Show</span>
            <Keycap>C</Keycap>
          </button>
        )}
        {/* The credit sits above the Aladin Lite logo, which stays visible in the bottom-right corner. */}
        <div className="absolute right-4 bottom-[29px] text-right [text-shadow:0_1px_3px_rgb(0_0_0/0.9)]">
          {SKY_SURVEY.notice && <p className="text-xs leading-4 text-signal">{SKY_SURVEY.notice}</p>}
          <p className="mt-0.5 text-[11px] leading-[15px] text-ash">{SKY_SURVEY.credit}</p>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="absolute top-16 left-1/2 z-20 -translate-x-1/2 rounded-sm bg-red-950/80 px-3 py-2 text-sm"
        >
          Sky view unavailable: {error}
        </p>
      )}
      <SkyIntro enabled={!initialSelection && !initialView} />
      <ShortcutSheet open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <AnalysisPanel selection={selection} onClose={closePanel} autoOpen={linkedAnalysis} />
    </div>
  );
}

/** The coordinates under the pointer, bottom left while exploring (Figma "I · Explore"). */
function CursorReadout({ hidden }: { hidden: boolean }) {
  const cursor = useCursor();
  return (
    <div
      aria-hidden={hidden}
      className={cn(
        "absolute bottom-[21px] left-6 transition-opacity duration-300 [text-shadow:0_1px_3px_rgb(0_0_0/0.9)]",
        hidden && "opacity-0",
      )}
    >
      <p className="font-data text-[11px] leading-[13px] tracking-[0.04em] text-bone/80">
        RA {cursor ? formatRa(cursor.ra) : "—"}&nbsp;&nbsp;&nbsp;Dec {cursor ? formatDec(cursor.dec) : "—"}
      </p>
    </div>
  );
}

const OVERLAYS_KEY = "heimdallr:show-on-sky";

/** "Show on sky" settings, remembered in this browser (decision #40). Read after mount so the server render matches. */
function useStoredOverlays() {
  const [overlays, setOverlays] = useState<SkyOverlays>(DEFAULT_OVERLAYS);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(OVERLAYS_KEY) ?? "null") as Partial<SkyOverlays> | null;
      if (stored && typeof stored === "object") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser storage after mount
        setOverlays({ ...DEFAULT_OVERLAYS, ...stored, statuses: { ...DEFAULT_OVERLAYS.statuses, ...stored.statuses } });
      }
    } catch {
      // Storage blocked or malformed: keep the defaults.
    }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      window.localStorage.setItem(OVERLAYS_KEY, JSON.stringify(overlays));
    } catch {
      // Storage blocked: the setting lasts until the page closes.
    }
  }, [overlays]);
  return [overlays, setOverlays] as const;
}

/**
 * True while the sky is being dragged and for 600 ms after release, so the header can step aside. A drag (not a
 * click) also calls onDragStart, which folds the queue: dragging means looking around (decision #38).
 */
function useSkyDrag(onDragStart: () => void) {
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    let start: { x: number; y: number } | null = null;
    let active = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const down = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (event.button !== 0 || !target?.closest("[data-sky-surface]")) return;
      start = { x: event.clientX, y: event.clientY };
    };
    const move = (event: PointerEvent) => {
      if (!start || active || Math.hypot(event.clientX - start.x, event.clientY - start.y) < 4) return;
      active = true;
      clearTimeout(timer);
      setDragging(true);
      onDragStart();
    };
    const up = () => {
      start = null;
      if (!active) return;
      active = false;
      timer = setTimeout(() => setDragging(false), 600);
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
    };
  }, [onDragStart]);
  return dragging;
}
