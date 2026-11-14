import "client-only";

import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import { BackSide, type PerspectiveCamera, SRGBColorSpace, TextureLoader, Vector3 } from "three";
import { MAX_SPHERE_FOV, SKY_SURVEY, ZOOM_IN_FOV } from "./constants";
import {
  clamp,
  type EquatorialCoordinates,
  equatorialToVector,
  horizontalToVerticalFov,
  normalizeRa,
  type SkyView,
  vectorToEquatorial,
} from "./sky-coordinates";

type CelestialSphereProps = {
  initialView: SkyView;
  onCursorMove: (cursor: EquatorialCoordinates | null) => void;
  /** Called once the view is zoomed to ZOOM_IN_FOV or narrower. */
  onZoomIn: (view: SkyView) => void;
};

/** First-person celestial sphere: the camera sits at the center and looks out at the inside of the sky. */
export default function CelestialSphere(props: CelestialSphereProps) {
  return (
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
      <SkyControls {...props} />
    </Canvas>
  );
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

const ZOOM_SPEED = 0.0015;
const MIN_POLE_SCALE = 0.2;
const MAX_DEC = 89.9;

/** Drag to look around, wheel to zoom, and report the RA/Dec under the cursor. */
function SkyControls({ initialView, onCursorMove, onZoomIn }: CelestialSphereProps) {
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
