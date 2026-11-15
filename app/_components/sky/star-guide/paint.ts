import type { SkyPaintFrame } from "../sky-view";
import type { StarGuideState } from "./use-star-guide";

/** The brightest this many stars get a number and a label in the guide card. */
export const NUMBERED_STARS = 5;

/** Same light blue as the constellation lines, so guide marks read as "help", not as candidates (yellow). */
const GUIDE = "168, 200, 255";
const HIGHLIGHT = "#fbde7e";

function dataFont(size: number) {
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font-data-face").trim() || "monospace";
  return `500 ${size}px ${family}`;
}

/**
 * Squares around the stars the guide measured, placed on the sky so they follow a drag. The five brightest are
 * numbered to match the guide card; `highlighted` is the star under the pointer in the card.
 */
export function paintStarGuide(context: CanvasRenderingContext2D, frame: SkyPaintFrame, state: StarGuideState, highlighted: number | null) {
  if (state.status !== "done") return;
  const pxPerArcsec = frame.width / (frame.fov * 3600);
  context.save();
  context.globalAlpha = state.stale ? 0.35 : 1;
  context.font = dataFont(11);
  context.textBaseline = "bottom";
  // Faintest first, so the numbered ones sit on top.
  for (const star of [...state.result.stars].reverse()) {
    const point = frame.project(star.ra, star.dec);
    if (!point) continue;
    const [x, y] = point;
    const side = Math.max(2 * star.radiusArcsec * pxPerArcsec + 8, 12);
    if (x < -side || y < -side || x > frame.width + side || y > frame.height + side) continue;
    const numbered = star.rank <= NUMBERED_STARS;
    const lit = highlighted === star.rank;
    context.lineWidth = lit ? 2 : numbered ? 1.25 : 1;
    context.strokeStyle = lit ? HIGHLIGHT : numbered ? `rgba(${GUIDE}, 0.95)` : `rgba(${GUIDE}, 0.45)`;
    context.strokeRect(Math.round(x - side / 2) + 0.5, Math.round(y - side / 2) + 0.5, Math.round(side), Math.round(side));
    if (!numbered) continue;
    const label = String(star.rank);
    const left = Math.round(x - side / 2);
    const top = Math.round(y - side / 2) - 2;
    const width = context.measureText(label).width + 6;
    context.fillStyle = "rgba(1, 1, 1, 0.6)";
    context.fillRect(left, top - 14, width, 14);
    context.fillStyle = lit ? HIGHLIGHT : `rgb(${GUIDE})`;
    context.fillText(label, left + 3, top - 1);
  }
  context.restore();
}
