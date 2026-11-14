import "client-only";

import A, { type Aladin } from "aladin-lite";
import { useEffect, useRef } from "react";
import { AIM_FOV, CUTOUT_ARCMIN, FLY_SECONDS, MAX_FOV, MIN_FOV, SKY_SURVEY } from "./constants";
import constellationLines from "./data/constellation-lines.json";
import { angularDistance, type EquatorialCoordinates, normalizeRa, type SkyView } from "./sky-coordinates";
import { TEST_TARGETS, type TestTarget } from "./test-targets";

/** A request to fly the view somewhere; a new `id` starts a new flight. */
export type Flight = SkyView & { id: number };

type SkyViewProps = {
  initialView: SkyView;
  flight: Flight | null;
  onCursorMove: (cursor: EquatorialCoordinates | null) => void;
  onFovChange: (fov: number) => void;
  /**
   * A click (not a drag): on a test target's pin at any field of view, or on any point once zoomed to AIM_FOV or
   * narrower.
   */
  onSelect: (point: EquatorialCoordinates, fov: number, target?: TestTarget) => void;
  onError: (message: string) => void;
};

/** A click this close (CSS pixels) to a test target's pin selects the target itself. */
const PIN_HIT_RADIUS = 12;

type ConstellationData = { features: { geometry: { coordinates: number[][][] } }[] };

/**
 * Constellation stick figures from d3-celestial (BSD-3-Clause, see data/LICENSE-d3-celestial.txt; positions J2000,
 * lines after the IAU constellation pages). Longitude in the file is RA in −180…180°. In the TAN projection a great
 * circle is a straight line, so straight segments between the stars are exact.
 *
 * They are drawn on our own canvas over the sky, not as an Aladin Lite polyline overlay: in 3.8.2 a polyline with a
 * point outside the TAN projection throws inside Aladin's draw loop and freezes the whole view.
 */
const CONSTELLATION_LINES = (constellationLines as ConstellationData).features.flatMap((feature) =>
  feature.geometry.coordinates.map((line) => line.map(([ra, dec]): [number, number] => [normalizeRa(ra), dec])),
);

/**
 * The whole sky screen in one Aladin Lite view. TAN is the perspective view from the center of the sphere, so the
 * wide view looks like a first-person sky, and HiPS tiles sharpen continuously as the view zooms in: no hand-off, no
 * visible boundary.
 */
export default function SkyView({ initialView, flight, onCursorMove, onFovChange, onSelect, onError }: SkyViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const reticle = useRef<HTMLDivElement>(null);
  const linesCanvas = useRef<HTMLCanvasElement>(null);
  const aladinRef = useRef<Aladin | null>(null);
  const pendingFlight = useRef<Flight | null>(null);
  const callbacks = useRef({ onCursorMove, onFovChange, onSelect, onError });
  const startView = useRef(initialView);

  useEffect(() => {
    callbacks.current = { onCursorMove, onFovChange, onSelect, onError };
  });

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let cancelled = false;
    let frame = 0;

    const hideReticle = () => {
      if (reticle.current) reticle.current.style.visibility = "hidden";
    };

    A.init
      .then(() => {
        if (cancelled) return;
        const { ra, dec, fov } = startView.current;
        const aladin = A.aladin(element, {
          survey: SKY_SURVEY.hips,
          target: `${ra} ${dec}`,
          fov,
          cooFrame: "ICRS",
          projection: "TAN",
          // Dragging rotates the sphere like a trackball and can roll the view; keep celestial north up.
          lockNorthUp: true,
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
          gridOptions: { enabled: true, color: "rgb(111, 143, 184)", opacity: 0.35, thickness: 1, showLabels: false },
        });
        aladin.setFoVRange(MIN_FOV, MAX_FOV);

        // Redraw the constellation lines only on frames where the view moved, zoomed, or resized.
        let drawnFor = "";
        const drawLines = () => {
          frame = requestAnimationFrame(drawLines);
          const canvas = linesCanvas.current;
          if (!canvas) return;
          const [centerRa, centerDec] = aladin.getRaDec();
          const [width] = aladin.getFov();
          const key = `${centerRa} ${centerDec} ${width} ${element.clientWidth} ${element.clientHeight}`;
          if (key === drawnFor) return;
          drawnFor = key;
          drawConstellations(canvas, aladin, element.clientWidth, element.clientHeight);
        };
        drawLines();

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
        const placeReticle = () => {
          const square = reticle.current;
          if (!square) return;
          if (!pointer || currentFov > AIM_FOV) {
            square.style.visibility = "hidden";
            return;
          }
          const side = Math.max((CUTOUT_ARCMIN / 60 / currentFov) * element.clientWidth, 8);
          square.style.width = `${side}px`;
          square.style.height = `${side}px`;
          square.style.transform = `translate(${pointer.x - side / 2}px, ${pointer.y - side / 2}px)`;
          square.style.visibility = "visible";
        };

        aladin.on("mouseMove", (event) => {
          if (event.ra === null || event.dec === null) {
            pointer = null;
            hideReticle();
            callbacks.current.onCursorMove(null);
            return;
          }
          pointer = { x: event.x, y: event.y };
          placeReticle();
          callbacks.current.onCursorMove({ ra: event.ra, dec: event.dec });
        });
        aladin.on("click", (event) => {
          if (event.isDragging) return;
          const target = targetNear(aladin, event.x, event.y);
          if (target) callbacks.current.onSelect(target, currentFov, target);
          else if (currentFov <= AIM_FOV) callbacks.current.onSelect({ ra: event.ra, dec: event.dec }, currentFov);
        });
        aladin.on("zoomChanged", (nextFov) => {
          currentFov = nextFov;
          placeReticle();
          callbacks.current.onFovChange(nextFov);
        });

        aladinRef.current = aladin;
        callbacks.current.onFovChange(fov);
        if (pendingFlight.current) fly(aladin, pendingFlight.current);
      })
      .catch((error: unknown) => {
        if (!cancelled) callbacks.current.onError(String(error));
      });

    element.addEventListener("pointerleave", hideReticle);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      aladinRef.current = null;
      element.removeEventListener("pointerleave", hideReticle);
      // Aladin Lite has no destroy method; removing its DOM drops the canvas and its controls.
      element.replaceChildren();
    };
  }, []);

  useEffect(() => {
    if (!flight) return;
    if (aladinRef.current) fly(aladinRef.current, flight);
    else pendingFlight.current = flight;
  }, [flight]);

  // Aladin Lite restyles the element it is given (position included), so it gets an inner element that fills a
  // positioned wrapper.
  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" />
      <canvas ref={linesCanvas} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
      {/* Aiming square the size of the analysis cutout; clicking opens the analysis panel for that point. */}
      <div
        ref={reticle}
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 border border-amber-300/90 shadow-[0_0_0_1px_rgb(0_0_0/0.6)]"
      />
    </div>
  );
}

function drawConstellations(canvas: HTMLCanvasElement, aladin: Aladin, width: number, height: number) {
  const ratio = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.strokeStyle = "rgba(168, 200, 255, 0.45)";
  context.lineWidth = 1;
  context.beginPath();
  for (const line of CONSTELLATION_LINES) {
    let previous: [number, number] | null = null;
    for (const [ra, dec] of line) {
      // Points more than 90° from the view center have no TAN position; the segment to them is skipped.
      const pixel = aladin.world2pix(ra, dec);
      const point: [number, number] | null = pixel ? [pixel[0], pixel[1]] : null;
      if (previous && point) {
        context.moveTo(previous[0], previous[1]);
        context.lineTo(point[0], point[1]);
      }
      previous = point;
    }
  }
  context.stroke();
}

/**
 * Pans and zooms to a view. A far target first widens the view enough to show where it is going, then zooms in, so
 * the flight never streaks across the sky at high zoom.
 */
function fly(aladin: Aladin, { ra, dec, fov }: Flight) {
  const [centerRa, centerDec] = aladin.getRaDec();
  const [currentFov] = aladin.getFov();
  const distance = angularDistance({ ra: centerRa, dec: centerDec }, { ra, dec });
  aladin.animateToRaDec(ra, dec, FLY_SECONDS);
  if (distance <= currentFov / 2) {
    aladin.zoomToFoV(fov, FLY_SECONDS);
    return;
  }
  const overview = Math.min(Math.max(distance * 1.5, currentFov, fov), MAX_FOV);
  aladin.zoomToFoV(overview, FLY_SECONDS / 2, () => aladin.zoomToFoV(fov, FLY_SECONDS / 2));
}

function targetNear(aladin: Aladin, x: number, y: number): TestTarget | undefined {
  return TEST_TARGETS.find((target) => {
    const pixel = aladin.world2pix(target.ra, target.dec);
    return pixel ? Math.hypot(pixel[0] - x, pixel[1] - y) <= PIN_HIT_RADIUS : false;
  });
}
