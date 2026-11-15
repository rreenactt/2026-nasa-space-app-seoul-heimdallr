import { SKY_SURVEY } from "../constants";
import type { SkyPaintFrame } from "../sky-view";
import { GUIDE_DRAW_FOV, GUIDE_STARS, lightYears, positionAt, SPHEREX_EPOCH, type StarGuideState, totalPm } from "./use-star-guide";

/** Same light blue as the constellation lines, so guide marks read as "help", not as candidates (yellow). */
const GUIDE = "168, 200, 255";
const HIGHLIGHT = "#fbde7e";
const BOX = 22;
/** Callout: a diagonal leader from the square's corner, then a short level run into the label. */
const LEADER_RISE = 22;
const LEADER_RUN = 14;
const LABEL_PAD = 6;
const LINE_1 = 15;
const LINE_2 = 13;
/** How long a new set of callouts takes to draw itself in. */
const APPEAR_MS = 520;

function font(variable: "--font-ui-face" | "--font-data-face", size: number, weight = 400) {
  const family = getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || "sans-serif";
  return `${weight} ${size}px ${family}`;
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

// The answer on screen and when it first appeared, so each new answer animates once.
let shownKey = "";
let shownAt = 0;

type Rect = { x: number; y: number; w: number; h: number };
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Every collected star on screen gets a square where it sits in the background picture (taken about SKY_SURVEY.year)
 * and a line to where Gaia's motion puts it during SPHEREx (2026). The fastest five also get a number and a callout
 * (leader line and label): the card's five once the view is still, the fastest on screen while it moves. A new set
 * draws itself in over APPEAR_MS; returns true while that runs so the view repaints next frame. `highlighted` is the
 * card row under the pointer (1-based).
 */
export function paintStarGuide(
  context: CanvasRenderingContext2D,
  frame: SkyPaintFrame,
  state: StarGuideState,
  highlighted: number | null,
): boolean {
  if (state.status !== "on" || frame.fov > GUIDE_DRAW_FOV || state.known.length === 0) return false;
  const visible = state.known.filter((star) => {
    const point = frame.project(...positionAt(star, SPHEREX_EPOCH));
    return point !== null && point[0] >= 0 && point[1] >= 0 && point[0] <= frame.width && point[1] <= frame.height;
  });
  const numbered = !state.moving && state.listed.length > 0 ? state.listed : visible.slice(0, GUIDE_STARS);
  const numberedIds = new Set(numbered.map((star) => star.sourceId));
  const key = numbered.map((star) => star.sourceId).join(" ");
  if (key !== shownKey && !state.moving) {
    shownKey = key;
    shownAt = performance.now();
  }
  const progress = key === shownKey ? Math.min((performance.now() - shownAt) / APPEAR_MS, 1) : 1;

  context.save();
  // The rest of the collection on screen: small faint squares and motion lines, no labels.
  context.strokeStyle = `rgba(${GUIDE}, 0.45)`;
  context.lineWidth = 1;
  for (const star of visible) {
    if (numberedIds.has(star.sourceId)) continue;
    const then = frame.project(...positionAt(star, SKY_SURVEY.year));
    const now = frame.project(...positionAt(star, SPHEREX_EPOCH));
    if (!then || !now) continue;
    context.strokeRect(Math.round(then[0] - 7) + 0.5, Math.round(then[1] - 7) + 0.5, 14, 14);
    if (Math.hypot(now[0] - then[0], now[1] - then[1]) > 3) {
      context.beginPath();
      context.moveTo(then[0], then[1]);
      context.lineTo(now[0], now[1]);
      context.stroke();
    }
  }

  const placed: Rect[] = [];
  numbered.forEach((star, index) => {
    const rank = index + 1;
    const then = frame.project(...positionAt(star, SKY_SURVEY.year));
    const now = frame.project(...positionAt(star, SPHEREX_EPOCH));
    if (!then || !now) return;
    const lit = highlighted === rank;
    const color = lit ? HIGHLIGHT : `rgb(${GUIDE})`;
    // Stars appear one after another, brightest motion first.
    const own = easeOut(Math.min(Math.max(progress * 1.6 - index * 0.15, 0), 1));
    if (own <= 0) return;

    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = lit ? 2 : 1.25;
    const left = Math.round(then[0] - BOX / 2) + 0.5;
    const top = Math.round(then[1] - BOX / 2) + 0.5;
    context.globalAlpha = Math.min(own * 2, 1);
    context.strokeRect(left, top, BOX, BOX);
    // The motion since the picture was taken; only drawn when it is visible at this zoom.
    if (Math.hypot(now[0] - then[0], now[1] - then[1]) > 3) {
      context.beginPath();
      context.moveTo(then[0], then[1]);
      context.lineTo(then[0] + (now[0] - then[0]) * own, then[1] + (now[1] - then[1]) * own);
      context.stroke();
      if (own === 1) {
        context.beginPath();
        context.arc(now[0], now[1], 3, 0, Math.PI * 2);
        context.fill();
      }
    }

    // Callout text.
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

    // Up and to the right of the square; to the left near the right edge; lifted until it clears earlier labels.
    const toLeft = then[0] + BOX / 2 + LEADER_RISE + LEADER_RUN + width > frame.width - 56;
    const cornerX = toLeft ? left : left + BOX;
    const cornerY = top;
    let elbowY = cornerY - LEADER_RISE;
    let rect: Rect = { x: 0, y: 0, w: width, h: height };
    for (let attempt = 0; attempt < 8; attempt++) {
      const elbowX = cornerX + (toLeft ? -1 : 1) * (cornerY - elbowY);
      const endX = elbowX + (toLeft ? -LEADER_RUN : LEADER_RUN);
      rect = { x: toLeft ? endX - width : endX, y: elbowY - height / 2, w: width, h: height };
      if (!placed.some((other) => overlaps(rect, other)) && rect.y > 4) break;
      elbowY -= height + 4;
    }
    placed.push(rect);
    const elbowX = cornerX + (toLeft ? -1 : 1) * (cornerY - elbowY);
    const endX = toLeft ? rect.x + rect.w : rect.x;

    // The leader grows out of the square, then the label fades in.
    const leaderShare = Math.min(own / 0.6, 1);
    const diagonal = Math.hypot(elbowX - cornerX, elbowY - cornerY);
    const total = diagonal + LEADER_RUN;
    const drawn = total * leaderShare;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(cornerX, cornerY);
    if (drawn <= diagonal) {
      context.lineTo(cornerX + ((elbowX - cornerX) * drawn) / diagonal, cornerY + ((elbowY - cornerY) * drawn) / diagonal);
    } else {
      context.lineTo(elbowX, elbowY);
      context.lineTo(elbowX + (endX - elbowX) * ((drawn - diagonal) / LEADER_RUN), elbowY);
    }
    context.stroke();

    const labelAlpha = Math.max((own - 0.6) / 0.4, 0);
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
  return progress < 1;
}
