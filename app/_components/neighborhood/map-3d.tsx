"use client";

import "client-only";

import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { BufferGeometry, Float32BufferAttribute, Line, LineBasicMaterial, LineDashedMaterial, LineLoop } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { modelStatus, positionAt, sampleModels, type MotionModel, type Vec3 } from "@/app/_lib/nim/motion";
import type { NeighborObject } from "@/app/_lib/nim/types";

/**
 * ICRS (x → RA 0h, z → north celestial pole), pc → three.js (y up): (x, y, z)_ICRS ↦ (x, z, −y).
 * Display only; all physics stays in ICRS pc and km/s.
 */
const toThree = ([x, y, z]: Vec3): [number, number, number] => [x, z, -y];

export const STATUS_COLOR = { "full-3d": "#7dd3fc", "assumed-rv": "#fbbf24", "distance-uncertain": "#94a3b8" } as const;

function Controls() {
  const { camera, gl, invalidate } = useThree();
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enableDamping = false;
    c.minDistance = 0.5;
    c.maxDistance = 60;
    const onChange = () => invalidate();
    c.addEventListener("change", onChange);
    return () => {
      c.removeEventListener("change", onChange);
      c.dispose();
    };
  }, [camera, gl, invalidate]);
  return null;
}

function Polyline({ points, color, dashed = false, opacity = 1 }: { points: Vec3[]; color: string; dashed?: boolean; opacity?: number }) {
  const line = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(points.flatMap(toThree), 3));
    const mat = dashed
      ? new LineDashedMaterial({ color, dashSize: 0.08, gapSize: 0.06, transparent: true, opacity })
      : new LineBasicMaterial({ color, transparent: true, opacity });
    const l = new Line(g, mat);
    if (dashed) l.computeLineDistances();
    return l;
  }, [points, color, dashed, opacity]);
  useEffect(() => () => {
    line.geometry.dispose();
    (line.material as LineBasicMaterial).dispose();
  }, [line]);
  return <primitive object={line} />;
}

function Ring({ radius }: { radius: number }) {
  const loop = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i < 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(...toThree([radius * Math.cos(a), radius * Math.sin(a), 0]));
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pts, 3));
    return new LineLoop(g, new LineBasicMaterial({ color: "#334155" }));
  }, [radius]);
  return <primitive object={loop} />;
}

export interface Map3DProps {
  objects: NeighborObject[];
  models: Map<string, MotionModel>;
  selectedId: string;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  year: number;
  range: { min: number; max: number };
  showUncertainty: boolean;
  assumedRv: Record<string, number>;
}

/** The solar neighbourhood in 3D: Sun at the origin, 1 unit = 1 pc, north celestial pole up. */
export default function Map3D(props: Map3DProps) {
  return (
    <Canvas frameloop="demand" camera={{ position: [5, 3.5, 5], fov: 50, near: 0.01, far: 500 }} className="absolute! inset-0">
      <color attach="background" args={["#020617"]} />
      <ambientLight intensity={1} />
      <Controls />
      <Scene {...props} />
    </Canvas>
  );
}

function Scene({ objects, models, selectedId, onSelect, onHover, year, range, showUncertainty, assumedRv }: Map3DProps) {
  const { invalidate } = useThree();
  useEffect(() => invalidate(), [year, selectedId, showUncertainty, objects, invalidate]);

  const selected = objects.find((o) => o.id === selectedId);
  const samples = useMemo(
    () => (selected && showUncertainty ? sampleModels(selected, assumedRv[selected.id] ?? 0, 120).map((m) => positionAt(m, year)) : []),
    [selected, showUncertainty, assumedRv, year],
  );

  return (
    <group>
      {[1, 2, 3, 4].map((r) => (
        <Ring key={r} radius={r} />
      ))}
      {/* Sun / barycenter */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshBasicMaterial color="#fde047" />
      </mesh>
      {objects.map((o) => {
        const m = models.get(o.id);
        if (!m) return null;
        const status = modelStatus(o).level;
        const color = STATUS_COLOR[status];
        const now = positionAt(m, year);
        const isSel = o.id === selectedId;
        const past = positionAt(m, range.min);
        const future = positionAt(m, range.max);
        return (
          <group key={o.id}>
            <Polyline points={[past, now]} color="#64748b" opacity={isSel ? 0.9 : 0.35} />
            <Polyline points={[now, future]} color={color} dashed={status !== "full-3d"} opacity={isSel ? 1 : 0.45} />
            {isSel && <Polyline points={[now, [now[0], now[1], 0]]} color="#475569" opacity={0.8} />}
            <mesh
              position={toThree(now)}
              onClick={(e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                onSelect(o.id);
              }}
              onPointerOver={(e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                onHover(o.id);
              }}
              onPointerOut={() => onHover(null)}
            >
              <sphereGeometry args={[isSel ? 0.09 : 0.05, 16, 16]} />
              <meshBasicMaterial color={isSel ? "#ffffff" : color} />
            </mesh>
          </group>
        );
      })}
      {samples.map((p, i) => (
        <mesh key={i} position={toThree(p)}>
          <sphereGeometry args={[0.012, 6, 6]} />
          <meshBasicMaterial color="#f472b6" transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
}
