import type { SkyLayers } from "./sky-view";

/** Statuses that can be shown or hidden one by one in "Show on sky". */
export type StatusKey = "noteworthy" | "needs-ratings" | "recommended" | "known";

/**
 * Everything "Show on sky" switches (decision #40). `candidates` is the master switch the C key toggles;
 * status marks and the per-status boxes refine what it shows. The selected candidate stays visible regardless.
 */
export type SkyOverlays = SkyLayers & {
  candidates: boolean;
  marks: boolean;
  statuses: Record<StatusKey, boolean>;
  opened: boolean;
};

export const DEFAULT_OVERLAYS: SkyOverlays = {
  candidates: true,
  marks: true,
  // Known movers start on: they are the answer key to compare unidentified pairs with (decision #51). The coordinate
  // grid starts on and leads; constellation names start off (decision #55, Figma "I · Sky lines · C · Grid first").
  statuses: { noteworthy: true, "needs-ratings": true, recommended: true, known: true },
  opened: true,
  pins: true,
  constellations: true,
  constellationNames: false,
  grid: true,
};

/** The part the sky view draws (pins by the painter, lines and grid by sky-lines.ts). */
export function skyLayers({ pins, constellations, constellationNames, grid }: SkyOverlays): SkyLayers {
  return { pins, constellations, constellationNames, grid };
}
