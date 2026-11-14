"use client";

import { cn } from "cn";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { INITIAL_VIEW, SKY_SURVEY } from "./constants";
import { setCursor, useCursor } from "./cursor-store";
import { formatDec, formatRa, type SkyView } from "./sky-coordinates";

// three.js and Aladin Lite touch browser APIs as soon as they load, so both render only on the client.
// Aladin Lite (with its WebAssembly core) loads in its own chunk the first time the view zooms in.
const CelestialSphere = dynamic(() => import("./celestial-sphere"), { ssr: false });
const AladinView = dynamic(() => import("./aladin-view"), { ssr: false });

type Mode = "sphere" | "aladin";

/** The sky screen: a wide celestial sphere that hands off to Aladin Lite below ZOOM_IN_FOV and back above ZOOM_OUT_FOV. */
export function SkyExplorer() {
  const [mode, setMode] = useState<Mode>("sphere");
  const [view, setView] = useState<SkyView>(INITIAL_VIEW);
  const [error, setError] = useState<string | null>(null);

  const switchTo = useCallback((nextMode: Mode, nextView: SkyView) => {
    setView(nextView);
    setMode(nextMode);
  }, []);
  const zoomIn = useCallback((next: SkyView) => switchTo("aladin", next), [switchTo]);
  const zoomOut = useCallback((next: SkyView) => switchTo("sphere", next), [switchTo]);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black text-white">
      {mode === "sphere" ? (
        <CelestialSphere initialView={view} onCursorMove={setCursor} onZoomIn={zoomIn} />
      ) : (
        <AladinView initialView={view} onCursorMove={setCursor} onZoomOut={zoomOut} onError={setError} />
      )}
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
    </div>
  );
}

function CursorReadout({ mode }: { mode: Mode }) {
  const cursor = useCursor();
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 rounded-md bg-black/60 px-3 py-2 font-mono text-xs leading-5 text-white/80">
      <div>{mode === "sphere" ? "Sky view" : "Zoom view"}</div>
      <div>RA {cursor ? formatRa(cursor.ra) : "—"}</div>
      <div>Dec {cursor ? formatDec(cursor.dec) : "—"}</div>
    </div>
  );
}
