import "client-only";

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { type RefObject, Suspense, useEffect, useRef } from "react";
import { BackSide, type PerspectiveCamera, SRGBColorSpace, TextureLoader, Vector3 } from "three";
import { MAX_SPHERE_FOV, SKY_SURVEY, ZOOM_IN_FOV } from "./constants";
import constellationLines from "./data/constellation-lines.json";
import {
  clamp,
  type EquatorialCoordinates,
  equatorialToVector,
  horizontalToVerticalFov,
  normalizeRa,
  type SkyView,
  vectorToEquatorial,
} from "./sky-coordinates";
import { TEST_TARGETS, type TestTarget } from "./test-targets";

type CelestialSphereProps = {
  initialView: SkyView;
  onCursorMove: (cursor: EquatorialCoordinates | null) => void;
  /** Called once the view is zoomed to ZOOM_IN_FOV or narrower. */
  onZoomIn: (view: SkyView) => void;
  onTargetSelect: (target: TestTarget) => void;
};

/** First-person celestial sphere: the camera sits at the center and looks out at the inside of the sky. */
export default function CelestialSphere({ onTargetSelect, ...props }: CelestialSphereProps) {
  const pins = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <>
      <Canvas
        frameloop="demand"
        camera={{ position: [0, 0, 0], near: 0.01, far: 10 }}
        className="absolute! inset-0 cursor-grab touch-none active:cursor-grabbing"
      >
        <color attach="background" args={["#000000"]} />
        <Suspense fallback={null}>
          <SkyBackground />
        </Suspense>
        <CoordinateGrid />
        <ConstellationLines />
        <SkyControls {...props} />
        <PinTracker pins={pins} />
      </Canvas>
      {/* Pins are HTML so they stay sharp and clickable; PinTracker moves them after every render of the sky. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {TEST_TARGETS.map((target, index) => (
          <button
            key={target.id}
            ref={(element) => {
              pins.current[index] = element;
            }}
            type="button"
            title={`${target.name} · ${target.note}`}
            onClick={() => onTargetSelect(target)}
            className="pointer-events-auto invisible absolute top-0 left-0 flex items-center gap-1.5 rounded-sm text-xs whitespace-nowrap text-amber-200 [text-shadow:0_0_4px_black] hover:text-amber-50 focus-visible:outline-2 focus-visible:outline-amber-300"
          >
            <span className="size-2.5 shrink-0 rounded-full border-2 border-current" />
            {target.name}
          </button>
        ))}
      </div>
    </>
  );
}

const PIN_DOT_RADIUS = 5;
const PIN_VECTORS = TEST_TARGETS.map((target) => new Vector3(...equatorialToVector(target.ra, target.dec)));

/** Places each pin's dot on its target's screen position after every render, and hides pins behind the camera. */
function PinTracker({ pins }: { pins: RefObject<(HTMLButtonElement | null)[]> }) {
  const projected = useRef(new Vector3());
  const forward = useRef(new Vector3());

  useFrame(({ camera, size }) => {
    camera.getWorldDirection(forward.current);
    PIN_VECTORS.forEach((vector, index) => {
      const pin = pins.current[index];
      if (!pin) return;
      const point = projected.current.copy(vector).project(camera);
      const visible = vector.dot(forward.current) > 0 && Math.abs(point.x) <= 1.1 && Math.abs(point.y) <= 1.1;
      pin.style.visibility = visible ? "visible" : "hidden";
      if (!visible) return;
      const x = ((point.x + 1) / 2) * size.width;
      const y = ((1 - point.y) / 2) * size.height;
      pin.style.transform = `translate(${x - PIN_DOT_RADIUS}px, ${y}px) translateY(-50%)`;
    });
  });

  return null;
}

/**
 * The 360° background on the inside of a sphere. SphereGeometry places u = 0.5 on the +x axis and u grows toward
 * -z, which in scene space (see equatorialToVector) means RA = 360u - 180. The background image is built with that
 * same column layout, so each pixel lands at its true RA/Dec and the view is not mirrored.
 */
function SkyBackground() {
  const texture = useLoader(TextureLoader, SKY_SURVEY.background);
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());

  return (
    <mesh>
      <sphereGeometry args={[BACKGROUND_RADIUS, 128, 64]} />
      <meshBasicMaterial
        map={texture}
        map-colorSpace={SRGBColorSpace}
        map-anisotropy={maxAnisotropy}
        side={BackSide}
      />
    </mesh>
  );
}

// The grid sits on a unit sphere just inside the background so its lines draw on top.
const BACKGROUND_RADIUS = 2;
const GRID_STEP = 15;
const SEGMENT_STEP = 2;

/** Builds line-segment vertices for the RA/Dec grid: one array for the regular lines, one for the equator and RA 0h. */
function buildGrid() {
  const regular: number[] = [];
  const reference: number[] = [];
  const addArc = (target: number[], points: [number, number][]) => {
    for (let i = 0; i < points.length - 1; i++) {
      target.push(...equatorialToVector(...points[i]), ...equatorialToVector(...points[i + 1]));
    }
  };

  for (let dec = -90 + GRID_STEP; dec < 90; dec += GRID_STEP) {
    const points: [number, number][] = [];
    for (let ra = 0; ra <= 360; ra += SEGMENT_STEP) points.push([ra, dec]);
    addArc(dec === 0 ? reference : regular, points);
  }
  for (let ra = 0; ra < 360; ra += GRID_STEP) {
    const points: [number, number][] = [];
    for (let dec = -90; dec <= 90; dec += SEGMENT_STEP) points.push([ra, dec]);
    addArc(ra === 0 ? reference : regular, points);
  }
  return { regular: new Float32Array(regular), reference: new Float32Array(reference) };
}

// The grid never changes, so it is built once when the module loads.
const GRID = buildGrid();

/** Faint RA/Dec grid every 15°, with the celestial equator and RA 0h brighter. */
function CoordinateGrid() {
  const { regular, reference } = GRID;
  return (
    <>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[regular, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#6f8fb8" transparent opacity={0.25} />
      </lineSegments>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[reference, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#8fb4e0" transparent opacity={0.5} />
      </lineSegments>
    </>
  );
}

type ConstellationData = {
  features: { geometry: { coordinates: number[][][] } }[];
};

/**
 * Constellation stick figures from d3-celestial (BSD-3-Clause, see data/LICENSE-d3-celestial.txt; positions J2000,
 * lines after the IAU constellation pages). Longitude in the file is RA in −180…180°. A straight segment between two
 * points on the sphere projects onto the great-circle arc between them as seen from the center, so no subdivision is
 * needed.
 */
function buildConstellationLines() {
  const vertices: number[] = [];
  for (const feature of (constellationLines as ConstellationData).features) {
    for (const line of feature.geometry.coordinates) {
      for (let i = 0; i < line.length - 1; i++) {
        const [ra1, dec1] = line[i];
        const [ra2, dec2] = line[i + 1];
        vertices.push(...equatorialToVector(ra1, dec1), ...equatorialToVector(ra2, dec2));
      }
    }
  }
  return new Float32Array(vertices);
}

const CONSTELLATION_LINES = buildConstellationLines();

function ConstellationLines() {
  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[CONSTELLATION_LINES, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#a8c8ff" transparent opacity={0.4} />
    </lineSegments>
  );
}

const ZOOM_SPEED = 0.0015;
const MIN_POLE_SCALE = 0.2;
const MAX_DEC = 89.9;

/** Drag to look around, wheel to zoom, and report the RA/Dec under the cursor. */
function SkyControls({ initialView, onCursorMove, onZoomIn }: Omit<CelestialSphereProps, "onTargetSelect">) {
  const get = useThree((state) => state.get);
  const size = useThree((state) => state.size);
  const view = useRef(initialView);
  const callbacks = useRef({ onCursorMove, onZoomIn });
  const applyViewRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    callbacks.current = { onCursorMove, onZoomIn };
  });

  // Keep the field of view horizontal when the canvas is resized.
  useEffect(() => {
    applyViewRef.current?.();
  }, [size]);

  useEffect(() => {
    const element = get().gl.domElement;

    const applyView = () => {
      const state = get();
      const perspective = state.camera as PerspectiveCamera;
      const aspect = state.size.width / state.size.height;
      perspective.aspect = aspect;
      perspective.fov = horizontalToVerticalFov(view.current.fov, aspect);
      perspective.updateProjectionMatrix();
      perspective.up.set(0, 1, 0);
      perspective.lookAt(...equatorialToVector(view.current.ra, view.current.dec));
      perspective.updateMatrixWorld();
      state.invalidate();
    };

    const cursorAt = (event: PointerEvent): EquatorialCoordinates => {
      const rect = element.getBoundingClientRect();
      const point = new Vector3(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
        0.5,
      ).unproject(get().camera);
      // The camera sits at the origin, so the unprojected point is also the viewing direction.
      return vectorToEquatorial(point.x, point.y, point.z);
    };

    let drag: { x: number; y: number } | null = null;

    const onPointerDown = (event: PointerEvent) => {
      drag = { x: event.clientX, y: event.clientY };
      element.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (drag) {
        // Dragging moves the sky with the pointer. RA increases to the left, so dragging right raises the RA at the center.
        const degreesPerPixel = view.current.fov / element.clientWidth;
        const poleScale = Math.max(Math.cos((view.current.dec * Math.PI) / 180), MIN_POLE_SCALE);
        view.current = {
          ...view.current,
          ra: normalizeRa(view.current.ra + ((event.clientX - drag.x) * degreesPerPixel) / poleScale),
          dec: clamp(view.current.dec + (event.clientY - drag.y) * degreesPerPixel, -MAX_DEC, MAX_DEC),
        };
        drag = { x: event.clientX, y: event.clientY };
        applyView();
      }
      callbacks.current.onCursorMove(cursorAt(event));
    };

    const onPointerUp = (event: PointerEvent) => {
      drag = null;
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    };

    const onPointerLeave = () => {
      if (!drag) callbacks.current.onCursorMove(null);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const fov = clamp(view.current.fov * Math.exp(event.deltaY * ZOOM_SPEED), ZOOM_IN_FOV, MAX_SPHERE_FOV);
      view.current = { ...view.current, fov };
      applyView();
      if (fov <= ZOOM_IN_FOV) callbacks.current.onZoomIn(view.current);
    };

    applyView();
    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", onPointerUp);
    element.addEventListener("pointercancel", onPointerUp);
    element.addEventListener("pointerleave", onPointerLeave);
    element.addEventListener("wheel", onWheel, { passive: false });
    applyViewRef.current = applyView;
    return () => {
      applyViewRef.current = null;
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointercancel", onPointerUp);
      element.removeEventListener("pointerleave", onPointerLeave);
      element.removeEventListener("wheel", onWheel);
    };
  }, [get]);

  return null;
}
