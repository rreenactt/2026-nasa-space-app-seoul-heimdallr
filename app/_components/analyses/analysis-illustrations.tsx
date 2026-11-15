import type { AnalysisId } from "./prefetch";

/**
 * Small diagrams that show how each additional analysis works at a glance. They are explanatory sketches, not data:
 * grey marks are the context, the signal colour marks what the analysis looks at.
 */
export function AnalysisIllustration({ id, className }: { id: AnalysisId; className?: string }) {
  const Sketch = SKETCHES[id];
  return (
    <svg
      viewBox="0 0 96 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <Sketch />
    </svg>
  );
}

const ACCENT = "var(--color-signal)";

/** Three epochs of the same fixed field: background stars stay put, one source shifts from frame to frame. */
function TimeMachine() {
  const frames = [
    { x: 4, dot: 12, label: "2000" },
    { x: 35, dot: 16, label: "2010" },
    { x: 66, dot: 20, label: "2025" },
  ];
  return (
    <>
      {frames.map((f) => (
        <g key={f.label}>
          <rect x={f.x} y={6} width={26} height={26} rx={2} opacity={0.5} />
          <circle cx={f.x + 7} cy={13} r={1.2} fill="currentColor" stroke="none" opacity={0.6} />
          <circle cx={f.x + 20} cy={26} r={1.2} fill="currentColor" stroke="none" opacity={0.6} />
          <circle cx={f.x + f.dot - 4} cy={19} r={2.2} fill={ACCENT} stroke="none" />
          <text x={f.x + 13} y={44} fontSize={7} textAnchor="middle" fill="currentColor" stroke="none" opacity={0.7}>
            {f.label}
          </text>
        </g>
      ))}
      <path d="M8 54 H88 M84 51 L88 54 L84 57" opacity={0.6} />
    </>
  );
}

/** A dot under the crosshair, checked against quality flags, uncertainty and other exposures. */
function FakePlanet() {
  return (
    <>
      <rect x={4} y={6} width={40} height={40} rx={2} opacity={0.5} />
      <circle cx={24} cy={26} r={2.2} fill={ACCENT} stroke="none" />
      <circle cx={24} cy={26} r={8} stroke={ACCENT} />
      <path d="M24 14 V18 M24 34 V38 M12 26 H16 M32 26 H36" stroke={ACCENT} />
      {[
        { y: 14, ok: true },
        { y: 26, ok: true },
        { y: 38, ok: null },
      ].map((row) => (
        <g key={row.y}>
          {row.ok ? (
            <path d={`M54 ${row.y} L57 ${row.y + 3} L62 ${row.y - 3}`} stroke={ACCENT} />
          ) : (
            <text x={58} y={row.y + 3} fontSize={9} textAnchor="middle" fill="currentColor" stroke="none" opacity={0.8}>
              ?
            </text>
          )}
          <path d={`M68 ${row.y} H${row.y === 26 ? 84 : 90}`} opacity={0.5} />
        </g>
      ))}
      <text x={48} y={58} fontSize={7} textAnchor="middle" fill="currentColor" stroke="none" opacity={0.7}>
        real or defect?
      </text>
    </>
  );
}

/** The Sun at the origin of a 3D frame, with nearby objects and their motion arrows. */
function Neighborhood() {
  const stars = [
    { x: 64, y: 16, dx: 10, dy: -4 },
    { x: 30, y: 14, dx: -6, dy: -6 },
    { x: 72, y: 42, dx: 8, dy: 6 },
  ];
  return (
    <>
      <path d="M40 40 H88 M40 40 V4 M40 40 L14 58" opacity={0.4} />
      <ellipse cx={40} cy={40} rx={22} ry={9} opacity={0.3} strokeDasharray="2 2" />
      <circle cx={40} cy={40} r={3} fill={ACCENT} stroke="none" />
      <text x={44} y={35} fontSize={7} textAnchor="start" fill="currentColor" stroke="none" opacity={0.7}>
        Sun
      </text>
      {stars.map((s) => (
        <g key={`${s.x}-${s.y}`}>
          <circle cx={s.x} cy={s.y} r={1.8} fill="currentColor" stroke="none" />
          <path d={`M${s.x} ${s.y} l${s.dx} ${s.dy}`} stroke={ACCENT} />
          <circle cx={s.x + s.dx} cy={s.y + s.dy} r={0.9} fill={ACCENT} stroke="none" />
        </g>
      ))}
    </>
  );
}

/** A scan line sweeps the field; each star becomes a note (left/right, pitch) and a sound wave. */
function Sonata() {
  return (
    <>
      <rect x={4} y={4} width={40} height={36} rx={2} opacity={0.5} />
      <circle cx={12} cy={12} r={1.4} fill="currentColor" stroke="none" opacity={0.6} />
      <circle cx={36} cy={30} r={1.4} fill="currentColor" stroke="none" opacity={0.6} />
      <circle cx={24} cy={20} r={2.4} fill={ACCENT} stroke="none" />
      <path d="M24 6 V38" stroke={ACCENT} strokeDasharray="2 2" />
      <path d="M50 22 L58 22 M55 19 L58 22 L55 25" opacity={0.6} />
      <path d="M64 12 V32 M70 16 V28 M76 8 V36 M82 14 V30 M88 18 V26" stroke={ACCENT} />
      <path d="M8 54 Q16 46 24 54 T40 54 T56 54 T72 54 T88 54" opacity={0.6} />
    </>
  );
}

/** A comet with its coma and tail, and the gas bands (H₂O, CO₂, CO) measured before and after perihelion. */
function CometBreath() {
  const bars = [
    { x: 58, before: 14, after: 26, label: "H₂O" },
    { x: 72, before: 22, after: 30, label: "CO₂" },
    { x: 86, before: 8, after: 12, label: "CO" },
  ];
  return (
    <>
      <path d="M8 44 Q26 30 46 8 M8 44 Q30 36 48 18" opacity={0.5} />
      <circle cx={10} cy={44} r={6} stroke={ACCENT} opacity={0.6} />
      <circle cx={10} cy={44} r={2.6} fill={ACCENT} stroke="none" />
      {bars.map((b) => (
        <g key={b.label}>
          <rect x={b.x - 5} y={46 - b.before} width={4} height={b.before} fill="currentColor" stroke="none" opacity={0.45} />
          <rect x={b.x} y={46 - b.after} width={4} height={b.after} fill={ACCENT} stroke="none" />
          <text x={b.x} y={56} fontSize={6} textAnchor="middle" fill="currentColor" stroke="none" opacity={0.7}>
            {b.label}
          </text>
        </g>
      ))}
      <path d="M50 46 H92" opacity={0.5} />
    </>
  );
}

const SKETCHES: Record<AnalysisId, () => React.ReactElement> = {
  "sky-time-machine": TimeMachine,
  "fake-planet-lab": FakePlanet,
  "neighborhood-in-motion": Neighborhood,
  "sky-sonata": Sonata,
  "comet-breath": CometBreath,
};
