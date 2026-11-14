"use client";

import { cn } from "cn";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { AnalysisPanel } from "./analysis-panel";
import { INITIAL_VIEW, SKY_SURVEY, TARGET_FOV, ZOOM_IN_FOV } from "./constants";
import { setCursor, useCursor } from "./cursor-store";
import { type EquatorialCoordinates, formatDec, formatRa, type SkyView } from "./sky-coordinates";
import { SkySearchBox } from "./sky-search-box";
import { type SkySelection, selectionUrl } from "./sky-selection";
import { findTestTarget, type TestTarget } from "./test-targets";

// three.js and Aladin Lite touch browser APIs as soon as they load, so both render only on the client.
// Aladin Lite (with its WebAssembly core) loads in its own chunk the first time the view zooms in.
const CelestialSphere = dynamic(() => import("./celestial-sphere"), { ssr: false });
const AladinView = dynamic(() => import("./aladin-view"), { ssr: false });

type Mode = "sphere" | "aladin";

const modeFor = (fov: number): Mode => (fov <= ZOOM_IN_FOV ? "aladin" : "sphere");

/**
 * The sky screen: a wide celestial sphere that hands off to Aladin Lite below ZOOM_IN_FOV and back above ZOOM_OUT_FOV.
 * Clicking a test target pin, or a point in the zoom view, opens the analysis panel and puts the point in the URL.
 */
export function SkyExplorer({
  initialSelection,
  initialView,
  analysisLinks,
}: {
  /** Opens the analysis panel at start (a shared `?ra=&dec=&fov=` link). */
  initialSelection: SkySelection | null;
  /** Where the sky starts when it differs from the selection, such as an older `?stm=` link. */
  initialView?: SkyView;
  /** Buttons for the additional analyses, shown under the search box until they move into the analysis panel. */
  analysisLinks?: React.ReactNode;
}) {
  const [view, setView] = useState<SkyView>(initialView ?? INITIAL_VIEW);
  const [mode, setMode] = useState<Mode>(modeFor(view.fov));
  const [selection, setSelection] = useState<SkySelection | null>(initialSelection);
  const [error, setError] = useState<string | null>(null);

  const switchTo = useCallback((nextMode: Mode, nextView: SkyView) => {
    setView(nextView);
    setMode(nextMode);
  }, []);
  const zoomIn = useCallback((next: SkyView) => switchTo("aladin", next), [switchTo]);
  const zoomOut = useCallback((next: SkyView) => switchTo("sphere", next), [switchTo]);

  // The URL follows the open panel without adding history entries (PLAN.md chapter 5).
  const openPanel = useCallback((next: SkySelection) => {
    setSelection(next);
    window.history.replaceState(null, "", selectionUrl(next));
  }, []);
  const closePanel = useCallback(() => {
    setSelection(null);
    window.history.replaceState(null, "", "/");
  }, []);

  const selectTarget = useCallback(
    (target: TestTarget) => {
      switchTo("aladin", { ra: target.ra, dec: target.dec, fov: TARGET_FOV });
      openPanel({ ra: target.ra, dec: target.dec, fov: TARGET_FOV, target });
    },
    [switchTo, openPanel],
  );
  const selectPoint = useCallback(
    (point: EquatorialCoordinates, fov: number, target?: TestTarget) => {
      openPanel({ ...point, fov, target: target ?? findTestTarget(point) });
    },
    [openPanel],
  );
  // A searched point opens like a pin: in the zoom view at TARGET_FOV, with the panel on top.
  const goToPoint = useCallback(
    (point: EquatorialCoordinates) => {
      switchTo("aladin", { ...point, fov: TARGET_FOV });
      openPanel({ ...point, fov: TARGET_FOV, target: findTestTarget(point) });
    },
    [switchTo, openPanel],
  );

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black text-white">
      {mode === "sphere" ? (
        <CelestialSphere initialView={view} onCursorMove={setCursor} onZoomIn={zoomIn} onTargetSelect={selectTarget} />
      ) : (
        <AladinView
          initialView={view}
          onCursorMove={setCursor}
          onZoomOut={zoomOut}
          onSelect={selectPoint}
          onError={setError}
        />
      )}
      {/* Top-left column: the search box, then the analysis buttons below it (and below any search message). */}
      <div className="absolute top-4 left-4 z-10 flex flex-col items-start gap-2">
        <SkySearchBox onTarget={selectTarget} onPoint={goToPoint} />
        {analysisLinks}
      </div>
      <CursorReadout mode={mode} />
      {error && (
        <p role="alert" className="absolute top-4 left-1/2 -translate-x-1/2 rounded-md bg-red-950/80 px-3 py-2 text-sm">
          Zoom view unavailable: {error}
        </p>
      )}
      {/* In the zoom view the credit sits above the Aladin Lite logo, which stays visible in the bottom-right corner. */}
      <div
        className={cn(
          "pointer-events-none absolute right-4 max-w-md text-right text-xs leading-5",
          mode === "aladin" ? "bottom-12" : "bottom-4",
        )}
      >
        {SKY_SURVEY.notice && <p className="text-amber-300">{SKY_SURVEY.notice}</p>}
        <p className="text-white/60">{SKY_SURVEY.credit}</p>
      </div>
      <AnalysisPanel selection={selection} onClose={closePanel} />
    </div>
  );
}

function CursorReadout({ mode }: { mode: Mode }) {
  const cursor = useCursor();
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 rounded-md bg-black/60 px-3 py-2 font-mono text-xs leading-5 text-white/80">
      <div>{mode === "sphere" ? "Sky view · click a pin or zoom in" : "Zoom view · click to analyze"}</div>
      <div>RA {cursor ? formatRa(cursor.ra) : "—"}</div>
      <div>Dec {cursor ? formatDec(cursor.dec) : "—"}</div>
    </div>
  );
}
