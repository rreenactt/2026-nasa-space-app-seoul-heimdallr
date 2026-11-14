import type { SkyOverlays, StatusKey } from "./overlays";
import type { PlaceVisit } from "./place-history";
import type { MovementCandidate } from "./review-queue";
import type { SkyPaintFrame } from "./sky-view";

/** Field of view (degrees) above which candidates are drawn as density, and below which as single marks. */
export const DENSITY_FOV = 30;
export const MARKS_FOV = 5;
/** Noteworthy candidates still drawn on top of the density cells. */
const TOP_NOTEWORTHY = 20;

const HEX_RADIUS = 16;
const GROUP_CELL = 72;
const PAPER = "240, 240, 250";
const SIGNAL = "#fbde7e";
const ASH = "#b0b0a9";

export function statusKey(candidate: MovementCandidate): StatusKey {
  if (candidate.knownAsteroid) return "known";
  return candidate.status === "noteworthy" || candidate.status === "recommended" ? candidate.status : "needs-ratings";
}

type Projected = { candidate: MovementCandidate; x: number; y: number };

/**
 * Candidates on the sky by field of view (decision #39), so up to ~100k stay readable:
 * - wider than 30°: hexagon density cells plus the top 20 noteworthy candidates,
 * - 5° to 30°: group circles with counts,
 * - narrower than 5°: one shape mark per candidate.
 * Places this browser opened are squares at every level, and the selected candidate is always drawn, even with the
 * candidates switched off (decision #40). Binning is in screen space on each redraw; a precomputed sky index can
 * replace it once the pipeline publishes one.
 */
export function paintCandidates(
  context: CanvasRenderingContext2D,
  frame: SkyPaintFrame,
  {
    candidates,
    overlays,
    opened,
    selected,
  }: {
    candidates: MovementCandidate[];
    overlays: SkyOverlays;
    opened: PlaceVisit[];
    selected: { ra: number; dec: number } | null;
  },
) {
  const visible = (candidate: MovementCandidate) =>
    candidate.status !== "excluded" && overlays.statuses[statusKey(candidate)];

  if (overlays.candidates && candidates.length > 0) {
    const projected: Projected[] = [];
    for (const candidate of candidates) {
      if (!visible(candidate)) continue;
      const pixel = frame.project(candidate.ra, candidate.dec);
      if (pixel && inside(pixel, frame)) projected.push({ candidate, x: pixel[0], y: pixel[1] });
    }
    if (frame.fov > DENSITY_FOV) {
      if (overlays.density) paintDensity(context, projected);
      if (overlays.marks) {
        projected
          .filter(({ candidate }) => statusKey(candidate) === "noteworthy")
          .sort((a, b) => b.candidate.snr - a.candidate.snr)
          .slice(0, TOP_NOTEWORTHY)
          .forEach((point) => paintMark(context, point.x, point.y, "noteworthy"));
      }
    } else if (frame.fov > MARKS_FOV) {
      paintGroups(context, projected);
    } else if (overlays.marks) {
      for (const point of projected) paintMark(context, point.x, point.y, statusKey(point.candidate));
    }
  }

  if (overlays.opened) {
    for (const place of opened) {
      const pixel = frame.project(place.ra, place.dec);
      if (pixel && inside(pixel, frame)) paintOpened(context, pixel[0], pixel[1]);
    }
  }

  // The place being flown to or open: a paper ring, as in Figma "Flying to a target" and the selected candidate.
  if (selected) {
    const pixel = frame.project(selected.ra, selected.dec);
    if (pixel) {
      context.setLineDash([]);
      context.strokeStyle = `rgb(${PAPER})`;
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(pixel[0], pixel[1], 9, 0, Math.PI * 2);
      context.stroke();
    }
  }
}

function inside([x, y]: number[], { width, height }: SkyPaintFrame) {
  return x >= -HEX_RADIUS && y >= -HEX_RADIUS && x <= width + HEX_RADIUS && y <= height + HEX_RADIUS;
}

/** Pointy-top hexagon bins in screen space; cells below 22% of the busiest one are left empty (density style B). */
function paintDensity(context: CanvasRenderingContext2D, points: Projected[]) {
  const bins = new Map<string, { q: number; r: number; count: number }>();
  for (const { x, y } of points) {
    const [q, r] = hexRound(((Math.sqrt(3) / 3) * x - y / 3) / HEX_RADIUS, ((2 / 3) * y) / HEX_RADIUS);
    const key = `${q},${r}`;
    const bin = bins.get(key);
    if (bin) bin.count += 1;
    else bins.set(key, { q, r, count: 1 });
  }
  const max = Math.max(1, ...[...bins.values()].map((bin) => bin.count));
  for (const { q, r, count } of bins.values()) {
    const share = count / max;
    if (share < 0.22) continue;
    const cx = HEX_RADIUS * Math.sqrt(3) * (q + r / 2);
    const cy = HEX_RADIUS * 1.5 * r;
    context.beginPath();
    for (let corner = 0; corner < 6; corner += 1) {
      const angle = (Math.PI / 180) * (60 * corner - 30);
      const px = cx + (HEX_RADIUS - 1) * Math.cos(angle);
      const py = cy + (HEX_RADIUS - 1) * Math.sin(angle);
      if (corner === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    context.fillStyle = `rgba(${PAPER}, ${(0.06 + 0.14 * share).toFixed(3)})`;
    context.fill();
  }
}

function hexRound(q: number, r: number): [number, number] {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return [rq, rr];
}

/** Square screen cells merged into one circle with a count; a circle with a noteworthy member gets a signal dot. */
function paintGroups(context: CanvasRenderingContext2D, points: Projected[]) {
  const groups = new Map<string, { x: number; y: number; count: number; noteworthy: boolean }>();
  for (const { candidate, x, y } of points) {
    const key = `${Math.floor(x / GROUP_CELL)},${Math.floor(y / GROUP_CELL)}`;
    const group = groups.get(key) ?? { x: 0, y: 0, count: 0, noteworthy: false };
    group.x += x;
    group.y += y;
    group.count += 1;
    group.noteworthy ||= statusKey(candidate) === "noteworthy";
    groups.set(key, group);
  }
  context.font = "11px var(--font-data-face), ui-monospace, monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (const group of groups.values()) {
    const x = group.x / group.count;
    const y = group.y / group.count;
    const radius = 9 + Math.min(18, Math.log2(group.count) * 3);
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = "rgba(1, 1, 1, 0.55)";
    context.fill();
    context.strokeStyle = `rgba(${PAPER}, 0.7)`;
    context.lineWidth = 1;
    context.stroke();
    context.fillStyle = `rgb(${PAPER})`;
    context.fillText(String(group.count), x, y + 0.5);
    if (group.noteworthy) {
      context.fillStyle = SIGNAL;
      diamond(context, x + radius * 0.75, y - radius * 0.75, 3.5);
      context.fill();
    }
  }
}

/** The shape marks of decision #39, drawn on the sky (StatusMark draws the same shapes in lists). */
function paintMark(context: CanvasRenderingContext2D, x: number, y: number, kind: StatusKey) {
  context.lineWidth = 1.25;
  context.setLineDash([]);
  if (kind === "noteworthy") {
    context.fillStyle = SIGNAL;
    diamond(context, x, y, 6);
    context.fill();
  } else if (kind === "known") {
    context.strokeStyle = ASH;
    context.beginPath();
    context.moveTo(x - 5, y);
    context.lineTo(x + 5, y);
    context.moveTo(x, y - 5);
    context.lineTo(x, y + 5);
    context.stroke();
  } else {
    context.strokeStyle = `rgb(${PAPER})`;
    if (kind === "needs-ratings") context.setLineDash([2.5, 2]);
    context.beginPath();
    context.arc(x, y, 5.5, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
  }
}

function paintOpened(context: CanvasRenderingContext2D, x: number, y: number) {
  context.strokeStyle = ASH;
  context.lineWidth = 1;
  context.setLineDash([]);
  context.strokeRect(x - 6, y - 6, 12, 12);
}

function diamond(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
  context.beginPath();
  context.moveTo(x, y - size);
  context.lineTo(x + size, y);
  context.lineTo(x, y + size);
  context.lineTo(x - size, y);
  context.closePath();
}
