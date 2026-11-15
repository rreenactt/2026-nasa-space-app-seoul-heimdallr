import { SKY_SURVEY } from "../constants";
import type { SkyPaintFrame } from "../sky-view";
import type { GaiaStar } from "@/app/_lib/sky/types";
import {
  GUIDE_MAX_FOV,
  GUIDE_STARS,
  lightYears,
  positionAt,
  SPHEREX_EPOCH,
  type StarGuideState,
  starsOnScreen,
  totalPm,
} from "./use-star-guide";

/** Same light blue as the constellation lines, so guide marks read as "help", not as candidates (yellow). */
const GUIDE = "168, 200, 255";
const HIGHLIGHT = "#fbde7e";
const BOX = 22;
const SMALL_BOX = 14;
/** Callout: a diagonal leader from the square's corner up and to the right, then a short level run into the label. */
const LEADER_RISE = 22;
const LEADER_RUN = 14;
const LABEL_PAD = 6;
const LINE_1 = 15;
const LINE_2 = 13;
/** Time for a square (with its motion line) to draw in or out. */
const MARK_MS = 420;
/** Time for a callout (leader, then label) to draw in or out. */
const CALLOUT_MS = 460;
/** Callouts that start together follow one another by this share of CALLOUT_MS, fastest star first. */
const CALLOUT_STAGGER = 0.18;
/** Shortest motion line (CSS px) that gets its start and end years written at its ends. */
const YEAR_MIN_PX = 36;
/** Longest frame step the animation takes, so a pause between repaints does not skip an animation. */
const MAX_STEP_MS = 50;

/** Site font families, read once: canvas cannot use CSS variables, and reading styles every frame is slow. */
const families = new Map<string, string>();
function font(variable: "--font-ui-face" | "--font-data-face", size: number, weight = 400) {
  let family = families.get(variable);
  if (!family) {
    family = getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || "sans-serif";
    families.set(variable, family);
  }
  return `${weight} ${size}px ${family}`;
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);

/**
 * Animated presence of each star's marks, 0 (gone) to 1 (fully drawn). Every paint moves each value toward its
 * target: the square toward 1 while the star is on screen (and the view is not zoomed out past GUIDE_MAX_FOV), the
 * callout toward 1 while the star is one of the numbered five. So marks draw in when a star is first found, when it
 * pans into view or when the view zooms back in, and draw out (the entrance backwards) when it pans away, loses its
 * number or the view zooms out. A callout value below 0 is a stagger delay. One sky screen at a time.
 */
type Presence = { star: GaiaStar; mark: number; callout: number; rank: number; numbered: boolean };
const presence = new Map<string, Presence>();
let lastPaint = 0;

type Rect = { x: number; y: number; w: number; h: number };
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function step(value: number, target: number, amount: number) {
  return target > value ? Math.min(value + amount, target) : Math.max(value - amount, target);
}

/**
 * Every collected star on screen gets a square where it sits in the background picture (taken about SKY_SURVEY.year)
 * and a line to where Gaia's motion puts it during SPHEREx (2026). The fastest five also get a number and a callout
 * (leader line and label): the card's five once the view is still, the fastest on screen while it moves. Callouts
 * always point up and to the right; the screen edge simply cuts them off. Returns true while anything is still
 * animating, so the view repaints next frame. `highlighted` is the card row under the pointer (1-based).
 */
export function paintStarGuide(
  context: CanvasRenderingContext2D,
  frame: SkyPaintFrame,
  state: StarGuideState,
  highlighted: number | null,
): boolean {
  const now = performance.now();
  const dt = Math.min(now - lastPaint, MAX_STEP_MS);
  lastPaint = now;
  if (state.status !== "on" || !state.catalog) {
    presence.clear(); // switched off: gone at once, and the next showing draws everything in
    return false;
  }

  const zoomedOut = frame.fov > GUIDE_MAX_FOV;
  // Picked from the catalog around the current center on every frame (well under a millisecond), so a fast pan is
  // followed at once; the same on-screen test as the card's list.
  const visible = zoomedOut ? [] : starsOnScreen(state.catalog, frame);
  const numbered = zoomedOut ? [] : !state.moving && state.listed.length > 0 ? state.listed : visible.slice(0, GUIDE_STARS);
  const visibleIds = new Set(visible.map((star) => star.sourceId));
  const rankOf = new Map(numbered.map((star, index) => [star.sourceId, index + 1]));

  // Move every value toward its target.
  let delay = 0;
  let animating = false;
  // Stars on screen now, plus stars still fading out after leaving it.
  const candidates = new Map([...visible, ...numbered].map((star) => [star.sourceId, star]));
  for (const [id, p] of presence) if (!candidates.has(id)) candidates.set(id, p.star);
  for (const [id, star] of candidates) {
    const rank = rankOf.get(id);
    const markTarget = visibleIds.has(id) || rank !== undefined ? 1 : 0;
    let p = presence.get(id);
    if (!p) {
      if (markTarget === 0) continue;
      p = { star, mark: 0, callout: 0, rank: rank ?? 0, numbered: false };
      presence.set(id, p);
    }
    const calloutTarget = rank !== undefined ? 1 : 0;
    // A callout starting from nothing waits its turn behind others starting in the same frame.
    if (calloutTarget === 1 && !p.numbered && p.callout <= 0) p.callout = -CALLOUT_STAGGER * delay++;
    p.numbered = calloutTarget === 1;
    if (rank !== undefined) p.rank = rank;
    p.mark = step(p.mark, markTarget, dt / MARK_MS);
    p.callout = step(p.callout, calloutTarget, dt / CALLOUT_MS);
    if (p.mark !== markTarget || p.callout !== calloutTarget) animating = true;
    if (p.mark === 0 && p.callout <= 0 && markTarget === 0) presence.delete(id);
  }

  const drawn = [...presence.values()].map((p) => p.star);
  context.save();

  // Squares and motion lines. Numbered stars get the larger square, the dot at 2026 and their own color.
  for (const star of drawn) {
    const p = presence.get(star.sourceId)!;
    const own = easeOut(p.mark);
    if (own <= 0) continue;
    const then = frame.project(...positionAt(star, SKY_SURVEY.year));
    const later = frame.project(...positionAt(star, SPHEREX_EPOCH));
    if (!then || !later) continue;
    const big = p.callout > 0;
    const lit = big && highlighted === p.rank;
    const color = lit ? HIGHLIGHT : big ? `rgb(${GUIDE})` : `rgba(${GUIDE}, 0.45)`;
    const size = big ? BOX : SMALL_BOX;
    context.globalAlpha = clamp01(own * 2);
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = lit ? 2 : big ? 1.25 : 1;
    context.strokeRect(Math.round(then[0] - size / 2) + 0.5, Math.round(then[1] - size / 2) + 0.5, size, size);
    const length = Math.hypot(later[0] - then[0], later[1] - then[1]);
    if (length > 3) {
      context.beginPath();
      context.moveTo(then[0], then[1]);
      context.lineTo(then[0] + (later[0] - then[0]) * own, then[1] + (later[1] - then[1]) * own);
      context.stroke();
      if (big && own === 1) {
        context.beginPath();
        context.arc(later[0], later[1], 3, 0, Math.PI * 2);
        context.fill();
      }
      // Years at both ends, once the path is long enough to read them against: the start year behind the square
      // (opposite the motion), the end year past the dot.
      if (big && length >= YEAR_MIN_PX) {
        const ux = (later[0] - then[0]) / length;
        const uy = (later[1] - then[1]) / length;
        context.globalAlpha = clamp01((own - 0.7) / 0.3) * 0.85;
        context.font = font("--font-data-face", 10);
        context.textBaseline = "middle";
        const reach = BOX / 2 + 6;
        context.textAlign = ux > 0 ? "right" : "left";
        context.fillText(String(SKY_SURVEY.year), then[0] - ux * reach, then[1] - uy * reach);
        context.textAlign = ux > 0 ? "left" : "right";
        context.fillText(SPHEREX_EPOCH.toFixed(0), later[0] + ux * 9, later[1] + uy * 9);
        context.textAlign = "left";
      }
    }
  }

  // Callouts, fastest first so they claim the nearest spot.
  const placed: Rect[] = [];
  const callouts = drawn
    .filter((star) => presence.get(star.sourceId)!.callout > 0)
    .sort((a, b) => presence.get(a.sourceId)!.rank - presence.get(b.sourceId)!.rank);
  for (const star of callouts) {
    const p = presence.get(star.sourceId)!;
    const own = easeOut(clamp01(p.callout)) * clamp01(p.mark * 2);
    const then = frame.project(...positionAt(star, SKY_SURVEY.year));
    if (!then || own <= 0) continue;
    const lit = highlighted === p.rank;
    const color = lit ? HIGHLIGHT : `rgb(${GUIDE})`;

    const pm = totalPm(star) / 1000;
    const ly = lightYears(star.parallax);
    const title = `${p.rank}  ${pm.toFixed(pm >= 1 ? 1 : 2)}″ a year${ly ? ` · ${ly < 100 ? ly.toFixed(ly < 10 ? 1 : 0) : Math.round(ly / 10) * 10} ly` : ""}`;
    const detail = `moved ${(pm * (SPHEREX_EPOCH - SKY_SURVEY.year)).toFixed(0)}″ since ${SKY_SURVEY.year}`;
    context.font = font("--font-ui-face", 12, 500);
    const w1 = context.measureText(title).width;
    context.font = font("--font-data-face", 10.5);
    const w2 = context.measureText(detail).width;
    const width = Math.max(w1, w2) + LABEL_PAD * 2;
    const height = LINE_1 + LINE_2 + 6;

    // Up and to the right of the square, lifted until it clears the labels already placed.
    const cornerX = Math.round(then[0] - BOX / 2) + 0.5 + BOX;
    const cornerY = Math.round(then[1] - BOX / 2) + 0.5;
    let elbowY = cornerY - LEADER_RISE;
    let rect: Rect = { x: 0, y: 0, w: width, h: height };
    for (let attempt = 0; attempt < 8; attempt++) {
      rect = { x: cornerX + (cornerY - elbowY) + LEADER_RUN, y: elbowY - height / 2, w: width, h: height };
      if (!placed.some((other) => overlaps(rect, other))) break;
      elbowY -= height + 4;
    }
    placed.push(rect);
    const elbowX = cornerX + (cornerY - elbowY);

    // The leader grows out of the square, then the label fades in (and the reverse on the way out).
    const diagonal = Math.hypot(elbowX - cornerX, elbowY - cornerY);
    const length = (diagonal + LEADER_RUN) * clamp01(own / 0.6);
    context.globalAlpha = 1;
    context.strokeStyle = color;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(cornerX, cornerY);
    if (length <= diagonal) {
      context.lineTo(cornerX + ((elbowX - cornerX) * length) / diagonal, cornerY + ((elbowY - cornerY) * length) / diagonal);
    } else {
      context.lineTo(elbowX, elbowY);
      context.lineTo(elbowX + (length - diagonal), elbowY);
    }
    context.stroke();

    const labelAlpha = clamp01((own - 0.6) / 0.4);
    if (labelAlpha <= 0) continue;
    context.globalAlpha = labelAlpha;
    context.fillStyle = "rgba(1, 1, 1, 0.72)";
    context.fillRect(rect.x, rect.y, rect.w, rect.h);
    context.strokeStyle = lit ? HIGHLIGHT : `rgba(${GUIDE}, 0.5)`;
    context.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
    context.textBaseline = "top";
    context.fillStyle = lit ? HIGHLIGHT : "#f0f0fa";
    context.font = font("--font-ui-face", 12, 500);
    context.fillText(title, rect.x + LABEL_PAD, rect.y + 3);
    context.fillStyle = "#b0b0a9";
    context.font = font("--font-data-face", 10.5);
    context.fillText(detail, rect.x + LABEL_PAD, rect.y + 3 + LINE_1);
  }
  context.restore();
  return animating;
}
