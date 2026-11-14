import "client-only";

import A, { type Aladin } from "aladin-lite";
import { useEffect, useRef } from "react";
import { CUTOUT_ARCMIN, SKY_SURVEY, ZOOM_OUT_FOV } from "./constants";
import type { EquatorialCoordinates, SkyView } from "./sky-coordinates";
import { TEST_TARGETS, type TestTarget } from "./test-targets";

type AladinViewProps = {
  initialView: SkyView;
  onCursorMove: (cursor: EquatorialCoordinates | null) => void;
  /** Called once the view is zoomed out past ZOOM_OUT_FOV. */
  onZoomOut: (view: SkyView) => void;
  /** Called on a click (not a drag) with the clicked point, or the test target whose pin was clicked. */
  onSelect: (point: EquatorialCoordinates, fov: number, target?: TestTarget) => void;
  onError: (message: string) => void;
};

/** A click this close (CSS pixels) to a test target's pin selects the target itself. */
const PIN_HIT_RADIUS = 12;

/** Narrow-field view: Aladin Lite renders the survey's HiPS tiles at full resolution. */
export default function AladinView({ initialView, onCursorMove, onZoomOut, onSelect, onError }: AladinViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const reticle = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onCursorMove, onZoomOut, onSelect, onError });
  const { ra, dec, fov } = initialView;

  useEffect(() => {
    callbacks.current = { onCursorMove, onZoomOut, onSelect, onError };
  });

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let cancelled = false;

    const hideReticle = () => {
      if (reticle.current) reticle.current.style.visibility = "hidden";
    };

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

        const pins = A.catalog({
          name: "Test targets",
          shape: "circle",
          sourceSize: 14,
          color: "#fcd34d",
          displayLabel: true,
          labelColumn: "name",
          labelFont: "12px sans-serif",
        });
        pins.addSources(TEST_TARGETS.map((target) => A.source(target.ra, target.dec, { name: target.name })));
        aladin.addCatalog(pins);

        let currentFov = fov;
        // Last pointer position, so a wheel zoom can resize the square without the mouse moving.
        let pointer: { x: number; y: number } | null = null;
        const placeReticle = (x: number, y: number) => {
          pointer = { x, y };
          const square = reticle.current;
          if (!square) return;
          const side = Math.max((CUTOUT_ARCMIN / 60 / currentFov) * element.clientWidth, 8);
          square.style.width = `${side}px`;
          square.style.height = `${side}px`;
          square.style.transform = `translate(${x - side / 2}px, ${y - side / 2}px)`;
          square.style.visibility = "visible";
        };

        aladin.on("mouseMove", (event) => {
          if (event.ra === null || event.dec === null) {
            pointer = null;
            hideReticle();
            callbacks.current.onCursorMove(null);
            return;
          }
          placeReticle(event.x, event.y);
          callbacks.current.onCursorMove({ ra: event.ra, dec: event.dec });
        });
        aladin.on("click", (event) => {
          if (event.isDragging) return;
          const target = targetNear(aladin, event.x, event.y);
          callbacks.current.onSelect(target ?? { ra: event.ra, dec: event.dec }, currentFov, target);
        });
        aladin.on("zoomChanged", (nextFov) => {
          currentFov = nextFov;
          if (pointer && reticle.current?.style.visibility === "visible") placeReticle(pointer.x, pointer.y);
          if (nextFov <= ZOOM_OUT_FOV) return;
          const [centerRa, centerDec] = aladin.getRaDec();
          callbacks.current.onZoomOut({ ra: centerRa, dec: centerDec, fov: nextFov });
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) callbacks.current.onError(String(error));
      });

    element.addEventListener("pointerleave", hideReticle);

    return () => {
      cancelled = true;
      element.removeEventListener("pointerleave", hideReticle);
      // Aladin Lite has no destroy method; removing its DOM drops the canvas and its controls.
      element.replaceChildren();
    };
  }, [ra, dec, fov]);

  // Aladin Lite restyles the element it is given (position included), so it gets an inner element that fills a
  // positioned wrapper.
  return (
    <div className="absolute inset-0 cursor-crosshair">
      <div ref={container} className="h-full w-full" />
      {/* Aiming square the size of the analysis cutout; clicking opens the analysis panel for that point. */}
      <div
        ref={reticle}
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 border border-amber-300/90 shadow-[0_0_0_1px_rgb(0_0_0/0.6)]"
      />
    </div>
  );
}

function targetNear(aladin: Aladin, x: number, y: number): TestTarget | undefined {
  return TEST_TARGETS.find((target) => {
    const pixel = aladin.world2pix(target.ra, target.dec);
    return pixel ? Math.hypot(pixel[0] - x, pixel[1] - y) <= PIN_HIT_RADIUS : false;
  });
}
