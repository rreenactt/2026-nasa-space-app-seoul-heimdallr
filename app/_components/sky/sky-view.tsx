import "client-only";

import A, { type Aladin } from "aladin-lite";
import { cn } from "cn";
import { useEffect, useRef } from "react";
import { AIM_FOV, CUTOUT_ARCMIN, MAX_FOV, MIN_FOV, SKY_SURVEY } from "./constants";
import constellationLines from "./data/constellation-lines.json";
import { angularDistance, type EquatorialCoordinates, normalizeRa, type SkyView } from "./sky-coordinates";
import { TEST_TARGETS, type TestTarget } from "./test-targets";
import { setView } from "./view-store";

/** A request to fly the view somewhere; a new `id` starts a new flight. */
export type Flight = SkyView & { id: number };

/** Overlays that can be switched off; the sky image itself always shows. */
export type SkyLayers = { pins: boolean; constellations: boolean; grid: boolean };

/** What a painter gets on each redraw: a sky-to-screen projection (null beyond the view) and the view size. */
export type SkyPaintFrame = {
  project: (ra: number, dec: number) => [number, number] | null;
  fov: number;
  width: number;
  height: number;
};
/** Draws extra marks over the sky. A new function asks for a redraw; otherwise it runs only when the view changes. */
export type SkyPainter = (context: CanvasRenderingContext2D, frame: SkyPaintFrame) => void;

type SkyViewProps = {
  initialView: SkyView;
  flight: Flight | null;
  layers: SkyLayers;
  /** Candidate marks, density cells and opened places (candidate-layer.ts). */
  painter?: SkyPainter;
  onCursorMove: (cursor: EquatorialCoordinates | null) => void;
  onFovChange: (fov: number) => void;
  /** A flight reached its destination (not called when another flight or a drag cut it short). */
  onFlightEnd?: (id: number) => void;
  /** A click (not a drag) at any field of view, with the test target when it landed on that target's pin. */
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
export default function SkyView({
  initialView,
  flight,
  layers,
  painter,
  onCursorMove,
  onFovChange,
  onFlightEnd,
  onSelect,
  onError,
}: SkyViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const reticle = useRef<HTMLDivElement>(null);
  const linesCanvas = useRef<HTMLCanvasElement>(null);
  const markCanvas = useRef<HTMLCanvasElement>(null);
  const painterRef = useRef(painter);
  const painterVersion = useRef(0);
  const aladinRef = useRef<Aladin | null>(null);
  const layersRef = useRef(layers);
  const pendingFlight = useRef<Flight | null>(null);
  /** Cancels the flight in progress, if any. */
  const stopFlight = useRef<() => void>(() => {});
  const callbacks = useRef({ onCursorMove, onFovChange, onFlightEnd, onSelect, onError });
  const startView = useRef(initialView);

  useEffect(() => {
    callbacks.current = { onCursorMove, onFovChange, onFlightEnd, onSelect, onError };
  });
  useEffect(() => {
    painterRef.current = painter;
    painterVersion.current += 1;
  }, [painter]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let cancelled = false;
    let frame = 0;

    // Pointer position over the sky, from the browser's own pointermove: Aladin sends no mouseMove while its wheel zoom
    // animates, so the square would stay behind until the zoom ends.
    let pointer: { x: number; y: number } | null = null;
    const trackPointer = (event: PointerEvent) => {
      const box = element.getBoundingClientRect();
      pointer = { x: event.clientX - box.left, y: event.clientY - box.top };
    };
    const hideReticle = () => {
      pointer = null;
    };
    // A wheel step or a drag takes the view back from a flight.
    const interrupt = () => stopFlight.current();

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

        // Every frame, from the view's actual state: Aladin's zoomChanged event is throttled, so anything sized from it
        // steps during a zoom. The constellation lines are redrawn only on frames where the view moved, zoomed, or
        // resized.
        let drawnFor = "";
        let paintedFor = "";
        let placedFor = "";
        let reportedFor = "";
        let pointedFor = "";
        const onFrame = () => {
          frame = requestAnimationFrame(onFrame);
          const [centerRa, centerDec] = aladin.getRaDec();
          const [width] = aladin.getFov();
          const canvas = linesCanvas.current;
          const viewKey = `${centerRa} ${centerDec} ${width}`;
          if (viewKey !== reportedFor) {
            reportedFor = viewKey;
            setView({ ra: centerRa, dec: centerDec, fov: width });
          }
          const key = `${viewKey} ${element.clientWidth} ${element.clientHeight}`;
          if (canvas && key !== drawnFor) {
            drawnFor = key;
            drawConstellations(canvas, aladin, element.clientWidth, element.clientHeight);
          }
          const marks = markCanvas.current;
          const markKey = `${key} ${painterVersion.current}`;
          if (marks && markKey !== paintedFor) {
            paintedFor = markKey;
            const context = prepareCanvas(marks, element.clientWidth, element.clientHeight);
            if (context && painterRef.current) {
              painterRef.current(context, {
                project: (ra, dec) => {
                  const pixel = aladin.world2pix(ra, dec);
                  return pixel ? [pixel[0], pixel[1]] : null;
                },
                fov: width,
                width: element.clientWidth,
                height: element.clientHeight,
              });
            }
          }
          // The sky under a still pointer changes while the view drags, zooms or flies, and Aladin sends mouseMove only
          // when the pointer itself moves, so the readout is worked out here from the pointer and the current view.
          const pointKey = pointer ? `${viewKey} ${pointer.x} ${pointer.y}` : "none";
          if (pointKey !== pointedFor) {
            pointedFor = pointKey;
            const world = pointer ? aladin.pix2world(pointer.x, pointer.y) : null;
            callbacks.current.onCursorMove(
              world && Number.isFinite(world[0]) && Number.isFinite(world[1]) ? { ra: ((world[0] % 360) + 360) % 360, dec: world[1] } : null,
            );
          }
          const square = reticle.current;
          if (!square) return;
          // The square fades in and out (CSS opacity transition) but its size tracks the zoom exactly.
          const shown = pointer !== null && width <= AIM_FOV;
          const side = Math.max((CUTOUT_ARCMIN / 60 / width) * element.clientWidth, 8);
          const placement = shown && pointer ? `${side} ${pointer.x} ${pointer.y}` : "hidden";
          if (placement === placedFor) return;
          placedFor = placement;
          square.style.opacity = shown ? "1" : "0";
          if (!shown || !pointer) return;
          square.style.width = `${side}px`;
          square.style.height = `${side}px`;
          square.style.transform = `translate(${pointer.x - side / 2}px, ${pointer.y - side / 2}px)`;
        };
        onFrame();

        // Test target pins and their names are drawn by the painter (candidate-layer.ts), in the site type.
        applyLayers(aladin, layersRef.current);

        aladin.on("click", (event) => {
          if (event.isDragging) return;
          const [currentFov] = aladin.getFov();
          const target = layersRef.current.pins ? targetNear(aladin, event.x, event.y) : undefined;
          if (target) callbacks.current.onSelect(target, currentFov, target);
          else callbacks.current.onSelect({ ra: event.ra, dec: event.dec }, currentFov);
        });
        aladin.on("zoomChanged", (nextFov) => callbacks.current.onFovChange(nextFov));

        aladinRef.current = aladin;
        callbacks.current.onFovChange(fov);
        const pending = pendingFlight.current;
        if (pending) stopFlight.current = fly(aladin, pending, () => callbacks.current.onFlightEnd?.(pending.id));
      })
      .catch((error: unknown) => {
        if (!cancelled) callbacks.current.onError(String(error));
      });

    element.addEventListener("pointermove", trackPointer);
    element.addEventListener("pointerleave", hideReticle);
    element.addEventListener("wheel", interrupt, { capture: true, passive: true });
    element.addEventListener("pointerdown", interrupt, { capture: true });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stopFlight.current();
      aladinRef.current = null;
      element.removeEventListener("pointermove", trackPointer);
      element.removeEventListener("pointerleave", hideReticle);
      element.removeEventListener("wheel", interrupt, { capture: true });
      element.removeEventListener("pointerdown", interrupt, { capture: true });
      // Aladin Lite has no destroy method; removing its DOM drops the canvas and its controls.
      element.replaceChildren();
    };
  }, []);

  useEffect(() => {
    layersRef.current = layers;
    if (aladinRef.current) applyLayers(aladinRef.current, layers);
  }, [layers]);

  useEffect(() => {
    if (!flight) return;
    if (!aladinRef.current) {
      pendingFlight.current = flight;
      return;
    }
    stopFlight.current();
    stopFlight.current = fly(aladinRef.current, flight, () => callbacks.current.onFlightEnd?.(flight.id));
  }, [flight]);

  // Aladin Lite restyles the element it is given (position included), so it gets an inner element that fills a
  // positioned wrapper.
  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" />
      <canvas
        ref={linesCanvas}
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 h-full w-full", !layers.constellations && "hidden")}
      />
      <canvas ref={markCanvas} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
      {/* Aiming square the size of the analysis cutout; clicking opens the analysis panel for that point. */}
      <div
        ref={reticle}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 border border-amber-300/90 opacity-0 shadow-[0_0_0_1px_rgb(0_0_0/0.6)] transition-opacity duration-200"
      />
    </div>
  );
}

function applyLayers(aladin: Aladin, layers: SkyLayers) {
  aladin.setCooGrid({ enabled: layers.grid });
}

/** Sizes a canvas to its box at the device pixel ratio and clears it; returns a context in CSS pixels. */
function prepareCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  const ratio = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  return context;
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

/** Curvature of the flight path: how much a long flight widens the view on the way (van Wijk and Nuij use √2). */
const FLIGHT_RHO = Math.SQRT2;
/** Flight duration per unit of path length (van Wijk and Nuij's S), clamped so short hops and long flights both read. */
const FLIGHT_SECONDS_PER_S = 0.45;
const FLIGHT_MIN_SECONDS = 0.6;
const FLIGHT_MAX_SECONDS = 2.2;

/**
 * Pans and zooms to a view in one animation, every display frame, and returns a function that cancels it.
 *
 * The path is van Wijk and Nuij's optimal zoom-and-pan ("Smooth and efficient zooming and panning", 2003): the view
 * widens just enough on a long flight that the target comes into sight, and the apparent speed on screen stays even.
 * Aladin's own animateToRaDec and zoomToFoV run separately, pan at a constant angular speed (fast on screen when zoomed
 * in), and step the zoom on a 50 ms timer, which is what made flights stutter.
 */
function fly(aladin: Aladin, { ra, dec, fov }: Flight, onDone: () => void): () => void {
  const [startRa, startDec] = aladin.getRaDec();
  const [startFov] = aladin.getFov();
  const endFov = Math.min(Math.max(fov, MIN_FOV), MAX_FOV);
  const distance = angularDistance({ ra: startRa, dec: startDec }, { ra, dec });
  const path = zoomPanPath(startFov, endFov, distance);
  const seconds = Math.min(Math.max(path.length * FLIGHT_SECONDS_PER_S, FLIGHT_MIN_SECONDS), FLIGHT_MAX_SECONDS);
  const started = performance.now();
  let frame = 0;
  const step = (now: number) => {
    const t = Math.min((now - started) / (seconds * 1000), 1);
    const { along, width } = path.at(easeInOutCubic(t));
    const [stepRa, stepDec] = t < 1 ? slerp(startRa, startDec, ra, dec, along) : [ra, dec];
    aladin.gotoRaDec(stepRa, stepDec);
    aladin.setFoV(t < 1 ? Math.min(Math.max(width, MIN_FOV), MAX_FOV) : endFov);
    if (t < 1) frame = requestAnimationFrame(step);
    else onDone();
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

/**
 * van Wijk and Nuij's zoom-and-pan path from width w0 to w1 over a distance u1 (degrees), sampled by progress 0…1:
 * `along` is the fraction of the distance covered, `width` the field of view there.
 */
function zoomPanPath(w0: number, w1: number, u1: number) {
  const rho = FLIGHT_RHO;
  // Practically no pan: a pure zoom at an even exponential rate.
  if (u1 < 1e-6 * Math.max(w0, w1)) {
    const length = Math.abs(Math.log(w1 / w0)) / rho;
    return { length, at: (p: number) => ({ along: 1, width: w0 * Math.pow(w1 / w0, p) }) };
  }
  const b = (w: number, sign: number) => (w1 * w1 - w0 * w0 + sign * rho ** 4 * u1 * u1) / (2 * w * rho * rho * u1);
  const r = (bi: number) => Math.log(-bi + Math.sqrt(bi * bi + 1));
  const r0 = r(b(w0, 1));
  const r1 = r(b(w1, -1));
  const length = (r1 - r0) / rho;
  return {
    length,
    at: (p: number) => {
      const s = p * length;
      const u = (w0 / (rho * rho)) * (Math.cosh(r0) * Math.tanh(rho * s + r0) - Math.sinh(r0));
      return { along: Math.min(Math.max(u / u1, 0), 1), width: (w0 * Math.cosh(r0)) / Math.cosh(rho * s + r0) };
    },
  };
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** The point a fraction `f` of the way along the great circle between two positions (degrees). */
function slerp(ra1: number, dec1: number, ra2: number, dec2: number, f: number): [number, number] {
  const toVector = (ra: number, dec: number) => {
    const a = (ra * Math.PI) / 180;
    const d = (dec * Math.PI) / 180;
    return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
  };
  const p = toVector(ra1, dec1);
  const q = toVector(ra2, dec2);
  const angle = Math.acos(Math.min(Math.max(p[0] * q[0] + p[1] * q[1] + p[2] * q[2], -1), 1));
  if (angle < 1e-9) return [ra2, dec2];
  const a = Math.sin((1 - f) * angle) / Math.sin(angle);
  const c = Math.sin(f * angle) / Math.sin(angle);
  const [x, y, z] = [a * p[0] + c * q[0], a * p[1] + c * q[1], a * p[2] + c * q[2]];
  return [normalizeRa((Math.atan2(y, x) * 180) / Math.PI), (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI];
}

function targetNear(aladin: Aladin, x: number, y: number): TestTarget | undefined {
  return TEST_TARGETS.find((target) => {
    const pixel = aladin.world2pix(target.ra, target.dec);
    return pixel ? Math.hypot(pixel[0] - x, pixel[1] - y) <= PIN_HIT_RADIUS : false;
  });
}
