import { SKY_SURVEY } from "../constants";
import type { SkyPaintFrame } from "../sky-view";
import { positionAt, SPHEREX_EPOCH, type StarGuideState } from "./use-star-guide";

/** Same light blue as the constellation lines, so guide marks read as "help", not as candidates (yellow). */
const GUIDE = "168, 200, 255";
const HIGHLIGHT = "#fbde7e";
const BOX = 22;

function dataFont(size: number) {
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font-data-face").trim() || "monospace";
  return `500 ${size}px ${family}`;
}

/**
 * For each guide star: a numbered square where it sits in the background picture (taken about SKY_SURVEY.year) and a
 * line to where Gaia's motion puts it during SPHEREx (2026), ending in a dot. `highlighted` is the card row under the
 * pointer (1-based).
 */
export function paintStarGuide(context: CanvasRenderingContext2D, frame: SkyPaintFrame, state: StarGuideState, highlighted: number | null) {
  if (state.status !== "done") return;
  context.save();
  context.globalAlpha = state.stale ? 0.4 : 1;
  context.font = dataFont(11);
  context.textBaseline = "bottom";
  state.stars.forEach((star, index) => {
    const rank = index + 1;
    const then = frame.project(...positionAt(star, SKY_SURVEY.year));
    const now = frame.project(...positionAt(star, SPHEREX_EPOCH));
    if (!then || !now) return;
    const lit = highlighted === rank;
    const color = lit ? HIGHLIGHT : `rgb(${GUIDE})`;
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = lit ? 2 : 1.25;
    context.strokeRect(Math.round(then[0] - BOX / 2) + 0.5, Math.round(then[1] - BOX / 2) + 0.5, BOX, BOX);
    // The motion since the picture was taken; only drawn when it is visible at this zoom.
    if (Math.hypot(now[0] - then[0], now[1] - then[1]) > 3) {
      context.beginPath();
      context.moveTo(then[0], then[1]);
      context.lineTo(now[0], now[1]);
      context.stroke();
      context.beginPath();
      context.arc(now[0], now[1], 3, 0, Math.PI * 2);
      context.fill();
    }
    const label = String(rank);
    const left = Math.round(then[0] - BOX / 2);
    const top = Math.round(then[1] - BOX / 2) - 2;
    context.fillStyle = "rgba(1, 1, 1, 0.6)";
    context.fillRect(left, top - 14, context.measureText(label).width + 6, 14);
    context.fillStyle = color;
    context.fillText(label, left + 3, top - 1);
  });
  context.restore();
}
