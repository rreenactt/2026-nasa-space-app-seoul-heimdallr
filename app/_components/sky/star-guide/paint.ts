import type { GaiaStar } from "@/app/_lib/sky/types";
import { SKY_SURVEY } from "../constants";
import type { SkyPaintFrame } from "../sky-view";
import { GUIDE_DRAW_FOV, GUIDE_STARS, lightYears, positionAt, SPHEREX_EPOCH, type StarGuideState, totalPm } from "./use-star-guide";

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
/** Entrance: square, motion line, leader, then label. Numbered stars that appear together follow one another. */
const APPEAR_MS = 520;
const STAGGER_MS = 80;
/** Exit when zooming out past GUIDE_DRAW_FOV: the entrance played backwards. */
const DISAPPEAR_MS = 360;

function font(variable: "--font-ui-face" | "--font-data-face", size: number, weight = 400) {
  const family = getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || "sans-serif";
  return `${weight} ${size}px ${family}`;
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);

/**
 * Animation memory (one sky screen at a time):
 * - `appearAt`: when each star started its entrance. A star gets one the first time it is drawn, so only stars the
 *   viewer has not seen yet animate; panning back to a star already shown draws it at once.
 * - Zooming out past GUIDE_DRAW_FOV plays the exit once; zooming back in (or switching the guide on again) clears
 *   `appearAt`, so every star on screen plays its entrance again.
 */
const appearAt = new Map<string, number>();
let hidden = true;
let hiddenAt = 0;

type Rect = { x: number; y: number; w: number; h: number };
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Every collected star on screen gets a square where it sits in the background picture (taken about SKY_SURVEY.year)
 * and a line to where Gaia's motion puts it during SPHEREx (2026). The fastest five also get a number and a callout
 * (leader line and label): the card's five once the view is still, the fastest on screen while it moves. Callouts
 * always point up and to the right; the screen edge simply cuts them off. Returns true while an entrance or exit is
 * running, so the view repaints next frame. `highlighted` is the card row under the pointer (1-based).
 */
export function paintStarGuide(
  context: CanvasRenderingContext2D,
  frame: SkyPaintFrame,
  state: StarGuideState,
  highlighted: number | null,
): boolean {
  const now = performance.now();
  if (state.status !== "on" || state.known.length === 0) {
    hidden = true;
    hiddenAt = 0; // switched off: no exit animation, and the next showing plays the entrance for all
    appearAt.clear();
    return false;
  }
  const tooWide = frame.fov > GUIDE_DRAW_FOV;
  if (tooWide && !hidden) {
    hidden = true;
    hiddenAt = now;
  } else if (!tooWide && hidden) {
    hidden = false;
    appearAt.clear();
  }
  const exit = hidden ? 1 - clamp01((now - hiddenAt) / DISAPPEAR_MS) : 1;
  if (exit <= 0) return false;

  const visible = state.known.filter((star) => {
    const point = frame.project(...positionAt(star, SPHEREX_EPOCH));
    return point !== null && point[0] >= 0 && point[1] >= 0 && point[0] <= frame.width && point[1] <= frame.height;
  });
  const numbered = !state.moving && state.listed.length > 0 ? state.listed : visible.slice(0, GUIDE_STARS);
  const numberedIds = new Set(numbered.map((star) => star.sourceId));

  // Stars drawn for the first time start their entrance now; numbered ones one after another, fastest first.
  if (!hidden) {
    let next = 0;
    for (const star of numbered) {
      if (!appearAt.has(star.sourceId)) appearAt.set(star.sourceId, now + STAGGER_MS * next++);
    }
    for (const star of visible) if (!appearAt.has(star.sourceId)) appearAt.set(star.sourceId, now);
  }
  let animating = hidden; // an exit in progress
  const progressOf = (star: GaiaStar) => {
    const entrance = clamp01((now - (appearAt.get(star.sourceId) ?? now)) / APPEAR_MS);
    if (entrance < 1) animating = true;
    return Math.min(easeOut(entrance), exit);
  };

  context.save();
  // The rest of the collection on screen: small faint squares and motion lines, no labels.
  context.strokeStyle = `rgba(${GUIDE}, 0.45)`;
  context.lineWidth = 1;
  for (const star of visible) {
    if (numberedIds.has(star.sourceId)) continue;
    const own = progressOf(star);
    if (own <= 0) continue;
    const then = frame.project(...positionAt(star, SKY_SURVEY.year));
    const later = frame.project(...positionAt(star, SPHEREX_EPOCH));
    if (!then || !later) continue;
    context.globalAlpha = clamp01(own * 2);
    context.strokeRect(Math.round(then[0] - SMALL_BOX / 2) + 0.5, Math.round(then[1] - SMALL_BOX / 2) + 0.5, SMALL_BOX, SMALL_BOX);
    if (Math.hypot(later[0] - then[0], later[1] - then[1]) > 3) {
      context.beginPath();
      context.moveTo(then[0], then[1]);
      context.lineTo(then[0] + (later[0] - then[0]) * own, then[1] + (later[1] - then[1]) * own);
      context.stroke();
    }
  }

  const placed: Rect[] = [];
  numbered.forEach((star, index) => {
    const rank = index + 1;
    const then = frame.project(...positionAt(star, SKY_SURVEY.year));
    const later = frame.project(...positionAt(star, SPHEREX_EPOCH));
    if (!then || !later) return;
    const own = progressOf(star);
    if (own <= 0) return;
    const lit = highlighted === rank;
    const color = lit ? HIGHLIGHT : `rgb(${GUIDE})`;

    // Square and the motion since the picture was taken (the line only when it is visible at this zoom).
    context.globalAlpha = clamp01(own * 2);
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = lit ? 2 : 1.25;
    const left = Math.round(then[0] - BOX / 2) + 0.5;
    const top = Math.round(then[1] - BOX / 2) + 0.5;
    context.strokeRect(left, top, BOX, BOX);
    if (Math.hypot(later[0] - then[0], later[1] - then[1]) > 3) {
      context.beginPath();
      context.moveTo(then[0], then[1]);
      context.lineTo(then[0] + (later[0] - then[0]) * own, then[1] + (later[1] - then[1]) * own);
      context.stroke();
      if (own === 1) {
        context.beginPath();
        context.arc(later[0], later[1], 3, 0, Math.PI * 2);
        context.fill();
      }
    }

    // Callout text and size.
    const pm = totalPm(star) / 1000;
    const ly = lightYears(star.parallax);
    const title = `${rank}  ${pm.toFixed(pm >= 1 ? 1 : 2)}″ a year${ly ? ` · ${ly < 100 ? ly.toFixed(ly < 10 ? 1 : 0) : Math.round(ly / 10) * 10} ly` : ""}`;
    const detail = `moved ${(pm * (SPHEREX_EPOCH - SKY_SURVEY.year)).toFixed(0)}″ since ${SKY_SURVEY.year}`;
    context.font = font("--font-ui-face", 12, 500);
    const w1 = context.measureText(title).width;
    context.font = font("--font-data-face", 10.5);
    const w2 = context.measureText(detail).width;
    const width = Math.max(w1, w2) + LABEL_PAD * 2;
    const height = LINE_1 + LINE_2 + 6;

    // Up and to the right of the square, lifted until it clears the labels already placed.
    const cornerX = left + BOX;
    const cornerY = top;
    let elbowY = cornerY - LEADER_RISE;
    let rect: Rect = { x: 0, y: 0, w: width, h: height };
    for (let attempt = 0; attempt < 8; attempt++) {
      const elbowX = cornerX + (cornerY - elbowY);
      rect = { x: elbowX + LEADER_RUN, y: elbowY - height / 2, w: width, h: height };
      if (!placed.some((other) => overlaps(rect, other))) break;
      elbowY -= height + 4;
    }
    placed.push(rect);
    const elbowX = cornerX + (cornerY - elbowY);

    // The leader grows out of the square, then the label fades in (and the reverse on exit).
    const diagonal = Math.hypot(elbowX - cornerX, elbowY - cornerY);
    const drawn = (diagonal + LEADER_RUN) * clamp01(own / 0.6);
    context.globalAlpha = 1;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(cornerX, cornerY);
    if (drawn <= diagonal) {
      context.lineTo(cornerX + ((elbowX - cornerX) * drawn) / diagonal, cornerY + ((elbowY - cornerY) * drawn) / diagonal);
    } else {
      context.lineTo(elbowX, elbowY);
      context.lineTo(elbowX + (drawn - diagonal), elbowY);
    }
    context.stroke();

    const labelAlpha = clamp01((own - 0.6) / 0.4);
    if (labelAlpha <= 0) return;
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
  });
  context.restore();
  return animating;
}
