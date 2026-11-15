import { MIN_FOV } from "./constants";
import type { SkyOverlays, StatusKey } from "./overlays";
import type { PlaceVisit } from "./place-history";
import type { MovementCandidate } from "./review-queue";
import type { SkyPaintFrame } from "./sky-view";
import { TEST_TARGETS } from "./test-targets";

/** Field of view (degrees) wider than which no candidates are drawn, and narrower than which each gets its own mark. */
export const GROUPS_FOV = 80;
export const MARKS_FOV = 5;

/** About how far apart, in screen pixels, count circles sit. */
const GROUP_CELL = 72;
/** Room beyond the screen edge so a circle half off screen is still drawn. */
const EDGE_MARGIN = 32;
const PAPER = "240, 240, 250";
const SIGNAL = "#fbde7e";
const ASH = "#b0b0a9";
const BONE = "#f1f0ea";

/** A font from one of the next/font families in app/layout.tsx; canvas cannot read CSS variables itself. */
function siteFont(size: number, variable: "--font-ui-face" | "--font-data-face", weight = 400) {
  const family = getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || "sans-serif";
  return `${weight} ${size}px ${family}`;
}

export function statusKey(candidate: MovementCandidate): StatusKey {
  if (candidate.match === "known") return "known";
  return candidate.status === "noteworthy" || candidate.status === "recommended" ? candidate.status : "needs-ratings";
}

/**
 * Candidates on the sky by field of view (decision #49, replacing the density cells of #39):
 * - wider than 80°: none, the view is for finding your way,
 * - 5° to 80°: count circles on a grid fixed to the sky, so they move with the stars while panning,
 * - narrower than 5°: one shape mark per candidate.
 * Test targets, places this browser opened and the selected place are drawn at every level, the selected one even with
 * the candidates switched off (decision #40). Circles and marks fade in and out (decision #50); returns true while a
 * fade is still running, so the sky asks for another frame.
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
): boolean {
  const visible = (candidate: MovementCandidate) =>
    candidate.status !== "excluded" && overlays.statuses[statusKey(candidate)];

  const present = new Map<string, Drawable>();
  if (overlays.candidates && candidates.length > 0 && frame.fov <= GROUPS_FOV) {
    const shown = candidates.filter(visible);
    if (frame.fov > MARKS_FOV) {
      const size = 2 ** Math.round(Math.log2((GROUP_CELL * frame.fov) / frame.width));
      for (const group of groupsFor(shown, size)) present.set(`g ${size} ${group.key}`, { kind: "group", ...group });
    } else if (overlays.marks) {
      for (const candidate of shown) {
        present.set(`m ${candidate.ra} ${candidate.dec}`, {
          kind: "mark",
          ra: candidate.ra,
          dec: candidate.dec,
          status: statusKey(candidate),
          name: candidate.id,
          label: candidate.match === "known" ? "Known mover" : "Unidentified",
        });
      }
    }
  }
  const animating = paintFading(context, frame, present);

  // Test targets: a ring with a dot and the name beside it (Figma "I · Explore", "⊙ Barnard's Star").
  if (overlays.pins) {
    context.save();
    context.font = siteFont(13, "--font-ui-face");
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.shadowColor = "rgba(0, 0, 0, 0.9)";
    context.shadowBlur = 3;
    for (const target of TEST_TARGETS) {
      const pixel = frame.project(target.ra, target.dec);
      if (!pixel || !inside(pixel, frame)) continue;
      const [x, y] = pixel;
      context.setLineDash([]);
      context.strokeStyle = BONE;
      context.lineWidth = 1.25;
      context.beginPath();
      context.arc(x, y, 5.5, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = BONE;
      context.beginPath();
      context.arc(x, y, 1.5, 0, Math.PI * 2);
      context.fill();
      context.fillText(target.name, x + 12, y + 0.5);
    }
    context.restore();
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
  return animating;
}

function inside([x, y]: number[], { width, height }: SkyPaintFrame) {
  return x >= -EDGE_MARGIN && y >= -EDGE_MARGIN && x <= width + EDGE_MARGIN && y <= height + EDGE_MARGIN;
}

/** A group of candidates in one sky cell: the sum of their unit vectors gives the circle its place. */
type SkyGroup = { key: string; ra: number; dec: number; count: number; noteworthy: boolean };
type GroupSum = { key: string; x: number; y: number; z: number; count: number; noteworthy: boolean };

const RAD = Math.PI / 180;

/**
 * Groups candidates into cells fixed on the sky: rows of equal declination `size` apart, each row split into equal RA
 * steps about `size` wide on the sky and shifted half a step on odd rows. Because the cells belong to the sky, a pan
 * moves the circles with the stars instead of candidates hopping between screen cells. `size` is a power of two in
 * degrees, so the grid stays put while panning and changes only when a zoom crosses a step.
 */
function groupOnSky(candidates: MovementCandidate[], size: number): SkyGroup[] {
  const groups = new Map<string, GroupSum>();
  for (const candidate of candidates) {
    const { ra, dec } = candidate;
    const row = Math.round(dec / size);
    const rowDec = Math.max(-89.9, Math.min(89.9, row * size));
    const perRow = Math.max(1, Math.round((360 * Math.cos(rowDec * RAD)) / size));
    const shift = row % 2 === 0 ? 0 : 0.5;
    const column = ((Math.round((ra * perRow) / 360 - shift) % perRow) + perRow) % perRow;
    const key = `${row},${column}`;
    const group = groups.get(key) ?? { key, x: 0, y: 0, z: 0, count: 0, noteworthy: false };
    group.x += Math.cos(dec * RAD) * Math.cos(ra * RAD);
    group.y += Math.cos(dec * RAD) * Math.sin(ra * RAD);
    group.z += Math.sin(dec * RAD);
    group.count += 1;
    group.noteworthy ||= statusKey(candidate) === "noteworthy";
    groups.set(key, group);
  }
  return [...groups.values()].map(({ key, x, y, z, count, noteworthy }) => ({
    key,
    ra: (Math.atan2(y, x) / RAD + 360) % 360,
    dec: Math.atan2(z, Math.hypot(x, y)) / RAD,
    count,
    noteworthy,
  }));
}

// Grouping runs once per grid step and set of shown candidates, not on every frame.
let lastGrouping: { candidates: MovementCandidate[]; size: number; groups: SkyGroup[] } | null = null;

function groupsFor(candidates: MovementCandidate[], size: number) {
  if (
    lastGrouping &&
    lastGrouping.size === size &&
    lastGrouping.candidates.length === candidates.length &&
    lastGrouping.candidates.every((candidate, index) => candidate === candidates[index])
  ) {
    return lastGrouping.groups;
  }
  const groups = groupOnSky(candidates, size);
  lastGrouping = { candidates, size, groups };
  return groups;
}

/** Something the fader draws: a count circle (5–80°) or one candidate's mark (under 5°). */
type Drawable =
  | ({ kind: "group" } & SkyGroup)
  | { kind: "mark"; ra: number; dec: number; status: StatusKey; name: string; label: string };

const FADE_MS = 250;
const fading = new Map<string, { item: Drawable; alpha: number; target: 0 | 1 }>();
let lastFadeAt: number | null = null;

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Smoothstep: the same curve both ways, so a fade-out is as gradual as a fade-in. */
const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * Fades circles and marks in (growing from 85%) and out over 0.25 s, so crossing 80° or 5°, or a change of grouping
 * step, does not snap. Items on their way out keep their sky position, so they still move with the view.
 */
function paintFading(context: CanvasRenderingContext2D, frame: SkyPaintFrame, present: Map<string, Drawable>) {
  const now = performance.now();
  // The first frame of a fade counts as one 60 Hz frame; later ones use the real time since the last.
  const step = reducedMotion() ? 1 : Math.min(1, (lastFadeAt === null ? 16 : now - lastFadeAt) / FADE_MS);
  lastFadeAt = now;
  for (const [key, item] of present) {
    const entry = fading.get(key);
    if (entry) {
      entry.item = item;
      entry.target = 1;
    } else fading.set(key, { item, alpha: 0, target: 1 });
  }
  let animating = false;
  for (const [key, entry] of fading) {
    if (!present.has(key)) entry.target = 0;
    entry.alpha = entry.target === 1 ? Math.min(1, entry.alpha + step) : Math.max(0, entry.alpha - step);
    if (entry.alpha === 0 && entry.target === 0) {
      fading.delete(key);
      continue;
    }
    if (entry.alpha !== entry.target) animating = true;
    const { item } = entry;
    const pixel = frame.project(item.ra, item.dec);
    if (!pixel || !inside(pixel, frame)) continue;
    const shown = ease(entry.alpha);
    context.save();
    context.globalAlpha = shown;
    const grow = 0.85 + 0.15 * shown;
    if (item.kind === "group") paintGroup(context, pixel[0], pixel[1], item, grow);
    else paintMark(context, pixel[0], pixel[1], item, frame.fov, grow);
    context.restore();
  }
  // Forget the clock between fades so the next one starts from its first frame.
  if (!animating) lastFadeAt = null;
  return animating;
}

/** A count circle; one with a noteworthy member gets a signal dot. */
function paintGroup(context: CanvasRenderingContext2D, x: number, y: number, group: SkyGroup, grow: number) {
  const radius = (9 + Math.min(18, Math.log2(group.count) * 3)) * grow;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = "rgba(1, 1, 1, 0.55)";
  context.fill();
  context.strokeStyle = `rgba(${PAPER}, 0.7)`;
  context.lineWidth = 1;
  context.stroke();
  context.font = siteFont(11, "--font-data-face");
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = `rgb(${PAPER})`;
  context.fillText(String(group.count), x, y + 0.5);
  if (group.noteworthy) {
    context.fillStyle = SIGNAL;
    diamond(context, x + radius * 0.75, y - radius * 0.75, 3.5);
    context.fill();
  }
}

/** Marks grow from 1° in, to 1.8× at the deepest zoom, so they stay findable when one star fills the screen. */
function markScale(fov: number) {
  if (fov >= 1) return 1;
  return 1 + 0.8 * Math.min(1, Math.log(1 / fov) / Math.log(1 / MIN_FOV));
}

/** Name and kind beside each mark from this field of view in (Figma "I · Aim, deepest zoom · candidate marks"). */
const LABELS_FOV = 0.5;
const HALO = "rgba(1, 1, 1, 0.75)";

/**
 * The shape marks of decision #39, drawn on the sky (StatusMark draws the same shapes in lists). Each shape is stroked
 * twice, first wide and dark as a halo, so it reads on a bright star; the known-mover plus is paper rather than ash.
 */
function paintMark(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  mark: { status: StatusKey; name: string; label: string },
  fov: number,
  grow: number,
) {
  const scale = markScale(fov) * grow;
  const shape = () => {
    context.beginPath();
    if (mark.status === "noteworthy") diamond(context, x, y, 6 * scale);
    else if (mark.status === "known") {
      context.moveTo(x - 5.5 * scale, y);
      context.lineTo(x + 5.5 * scale, y);
      context.moveTo(x, y - 5.5 * scale);
      context.lineTo(x, y + 5.5 * scale);
    } else context.arc(x, y, 5.5 * scale, 0, Math.PI * 2);
  };
  context.setLineDash([]);
  context.lineCap = "round";
  context.strokeStyle = HALO;
  context.lineWidth = 3 + 1.25 * scale;
  shape();
  context.stroke();
  context.lineCap = "butt";
  context.lineWidth = 1.25 * Math.min(scale, 1.2);
  if (mark.status === "noteworthy") {
    context.fillStyle = SIGNAL;
    shape();
    context.fill();
  } else {
    context.strokeStyle = `rgb(${PAPER})`;
    if (mark.status === "needs-ratings") context.setLineDash([2.5 * scale, 2 * scale]);
    shape();
    context.stroke();
    context.setLineDash([]);
  }
  if (fov <= LABELS_FOV) {
    const left = x + 7 * scale + 8;
    context.shadowColor = "rgba(0, 0, 0, 0.9)";
    context.shadowBlur = 3;
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.font = siteFont(13, "--font-ui-face", 500);
    context.fillStyle = `rgb(${PAPER})`;
    context.fillText(mark.name, left, y - 2);
    context.font = siteFont(11, "--font-ui-face");
    context.fillStyle = ASH;
    context.fillText(mark.label, left, y + 12);
    context.shadowBlur = 0;
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
