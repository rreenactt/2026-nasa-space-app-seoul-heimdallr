import "client-only";

import A from "aladin-lite";
import { useEffect, useRef } from "react";
import { SKY_SURVEY, ZOOM_OUT_FOV } from "./constants";
import type { EquatorialCoordinates, SkyView } from "./sky-coordinates";

type AladinViewProps = {
  initialView: SkyView;
  onCursorMove: (cursor: EquatorialCoordinates | null) => void;
  /** Called once the view is zoomed out past ZOOM_OUT_FOV. */
  onZoomOut: (view: SkyView) => void;
  onError: (message: string) => void;
};

/** Narrow-field view: Aladin Lite renders the survey's HiPS tiles at full resolution. */
export default function AladinView({ initialView, onCursorMove, onZoomOut, onError }: AladinViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onCursorMove, onZoomOut, onError });
  const { ra, dec, fov } = initialView;

  useEffect(() => {
    callbacks.current = { onCursorMove, onZoomOut, onError };
  });

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let cancelled = false;

    A.init
      .then(() => {
        if (cancelled) return;
        const aladin = A.aladin(element, {
          survey: SKY_SURVEY.hips,
          target: `${ra} ${dec}`,
          fov,
          cooFrame: "ICRS",
          projection: "SIN",
          backgroundColor: "rgb(0, 0, 0)",
          log: false,
          showReticle: false,
          showZoomControl: false,
          showLayersControl: false,
          showFullscreenControl: false,
          showProjectionControl: false,
          showFrame: false,
          showFov: false,
          showCooLocation: false,
          showStatusBar: false,
          showContextMenu: false,
        });
        aladin.on("mouseMove", (event) => {
          callbacks.current.onCursorMove(
            event.ra === null || event.dec === null ? null : { ra: event.ra, dec: event.dec },
          );
        });
        aladin.on("zoomChanged", (nextFov) => {
          if (nextFov <= ZOOM_OUT_FOV) return;
          const [centerRa, centerDec] = aladin.getRaDec();
          callbacks.current.onZoomOut({ ra: centerRa, dec: centerDec, fov: nextFov });
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) callbacks.current.onError(String(error));
      });

    return () => {
      cancelled = true;
      // Aladin Lite has no destroy method; removing its DOM drops the canvas and its controls.
      element.replaceChildren();
    };
  }, [ra, dec, fov]);

  // Aladin Lite restyles the element it is given (position included), so it gets an inner element that fills a
  // positioned wrapper.
  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" />
    </div>
  );
}
