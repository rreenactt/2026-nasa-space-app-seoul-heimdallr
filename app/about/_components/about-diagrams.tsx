import type { ReactNode } from "react";

/**
 * The three schematic drawings beside the About sections (Figma "I · About" right column). They are drawings, not
 * data, and each says so in its caption.
 */
function Figure({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="flex h-[320px] w-full flex-col border border-rule lg:max-w-[651px] lg:justify-self-end">
      <div className="min-h-0 flex-1 p-5">{children}</div>
      <figcaption className="border-t border-rule px-5 py-2.5 text-[12px] text-ash">{caption}</figcaption>
    </figure>
  );
}

/** Fixed stars shared by the patch drawings, in a 0–100 box. */
const STARS: [number, number, number][] = [
  [14, 22, 1.4],
  [31, 70, 1],
  [47, 18, 1.1],
  [62, 82, 1.5],
  [78, 34, 1],
  [88, 66, 1.2],
  [22, 48, 0.8],
  [70, 55, 0.9],
];

/** The moving object at three visits, in the same box. */
const TRACK: [number, number][] = [
  [30, 40],
  [50, 47],
  [70, 54],
];

function Patch({ visit, label }: { visit?: number; label?: string }) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible" aria-hidden>
      <rect x="0.5" y="0.5" width="99" height="99" fill="none" className="stroke-rule" strokeWidth="0.6" />
      {[25, 50, 75].map((at) => (
        <g key={at} className="stroke-rule" strokeWidth="0.3">
          <line x1={at} y1="0" x2={at} y2="100" />
          <line x1="0" y1={at} x2="100" y2={at} />
        </g>
      ))}
      {STARS.map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} className="fill-bone" />
      ))}
      {visit === undefined ? (
        <>
          <polyline
            points={TRACK.map(([x, y]) => `${x},${y}`).join(" ")}
            fill="none"
            className="stroke-ash"
            strokeWidth="0.5"
            strokeDasharray="1.5 1.5"
          />
          {TRACK.map(([x, y], index) => (
            <g key={index}>
              <circle cx={x} cy={y} r="1.8" className="fill-signal" opacity={0.45 + index * 0.27} />
              <text x={x} y={y - 4} textAnchor="middle" className="fill-ash font-data text-[4.5px]">
                Visit {index + 1}
              </text>
            </g>
          ))}
        </>
      ) : (
        <circle cx={TRACK[visit][0]} cy={TRACK[visit][1]} r="1.8" className="fill-signal" />
      )}
      {label && (
        <text x="3" y="96" className="fill-ash font-data text-[5.5px]">
          {label}
        </text>
      )}
    </svg>
  );
}

/** One sky patch on a fixed grid: the stars stay, a moving object shifts between visits. */
export function RevisitDiagram() {
  return (
    <Figure caption="Drawing, not data. One patch on a fixed sky grid: stars stay put, something moving shifts between visits.">
      <div className="mx-auto aspect-square h-full">
        <Patch />
      </div>
    </Figure>
  );
}

/** The Sun, Neptune's orbit, and distant orbits that line up; Planet X itself is drawn dashed because it is not found. */
export function PlanetXDiagram() {
  const orbits = [-18, -8, 2, 12, 22];
  return (
    <Figure caption="Drawing, not to scale. The dashed orbit is a guess: Planet X has not been found.">
      <svg viewBox="0 0 300 160" className="h-full w-full" aria-hidden>
        <g transform="translate(170 82)">
          {orbits.map((angle) => (
            <ellipse
              key={angle}
              cx="50"
              cy="0"
              rx="64"
              ry="22"
              transform={`rotate(${angle})`}
              fill="none"
              className="stroke-ash"
              strokeWidth="0.8"
            />
          ))}
          <ellipse
            cx="-55"
            cy="0"
            rx="90"
            ry="42"
            transform="rotate(8)"
            fill="none"
            className="stroke-signal"
            strokeWidth="0.8"
            strokeDasharray="4 3"
          />
          <circle r="14" fill="none" className="stroke-bone" strokeWidth="0.8" />
          <circle r="2.6" className="fill-paper" />
          <text x="0" y="-6" textAnchor="middle" className="fill-ash text-[7px]">
            Sun
          </text>
          <text x="0" y="31" textAnchor="middle" className="fill-ash text-[7px]">
            Neptune&apos;s orbit
          </text>
          <text x="70" y="-40" className="fill-ash text-[7px]">
            Distant icy bodies
          </text>
          <text x="-140" y="-59" className="fill-signal text-[7px]">
            Planet X? Not found
          </text>
        </g>
      </svg>
    </Figure>
  );
}

/** A blink: the same spot shown visit after visit, with one dot moving. */
export function BlinkDiagram() {
  return (
    <Figure caption="Drawing, not data. A blink shows the same spot visit after visit; the site plays these as a loop.">
      <div className="grid h-full grid-cols-3 items-center gap-4 px-0">
        {TRACK.map((_, visit) => (
          <div key={visit} className="aspect-square w-full">
            <Patch visit={visit} label={`Visit ${visit + 1}`} />
          </div>
        ))}
      </div>
    </Figure>
  );
}
