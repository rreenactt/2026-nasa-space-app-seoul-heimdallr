import "client-only";

import { useCallback, useRef, useState } from "react";
import type { SettledSky } from "../sky-view";
import { type DetectedStar, detectStars } from "./detect";

/** A star found on screen, placed on the sky so its mark follows the view. */
export type GuideStar = DetectedStar & {
  ra: number;
  dec: number;
  /** 1 = brightest on this screen. */
  rank: number;
  /** Brightness as a share of the brightest star on this screen (1 = the brightest). */
  relative: number;
  /** Size on screen converted to the sky at the zoom of the measurement, arcseconds. */
  fwhmArcsec: number;
  radiusArcsec: number;
};

export type StarGuideResult = {
  stars: GuideStar[];
  /** Stars found before the cut to the brightest ones. */
  found: number;
  /** `found` is an estimate (a crowded screen). */
  approximate: boolean;
  /** Field of view of the measured screen, degrees. */
  fov: number;
  /** Sky size of one CSS pixel at the center of the measured screen, arcseconds. */
  arcsecPerPx: number;
};

export type StarGuideState =
  | { status: "off" }
  /** On, waiting for the view to hold still. */
  | { status: "waiting" }
  | { status: "measuring" }
  /** `stale`: the view moved since; the marks stay (dimmed) until the next measurement. */
  | { status: "done"; result: StarGuideResult; stale: boolean }
  | { status: "unreadable" };

/** The star guide: measures the screen each time the view settles while it is on. */
export function useStarGuide(enabled: boolean) {
  const [state, setState] = useState<StarGuideState>({ status: "waiting" });
  const run = useRef(0);

  const onSettle = useCallback((settled: SettledSky | null) => {
    const id = ++run.current;
    if (!settled) {
      setState((previous) => (previous.status === "done" ? { ...previous, stale: true } : { status: "waiting" }));
      return;
    }
    setState((previous) => (previous.status === "done" ? { ...previous, stale: true } : { status: "measuring" }));
    void settled.capture().then((picture) => {
      if (id !== run.current) return; // the view moved while the picture was read
      if (!picture || isBlank(picture.data)) {
        setState({ status: "unreadable" });
        return;
      }
      const detection = detectStars(picture.data, picture.width, picture.height);
      const arcsecPerPx = (settled.fov * 3600) / settled.width;
      const brightest = detection.stars[0]?.brightness ?? 1;
      const stars: GuideStar[] = [];
      for (const star of detection.stars) {
        const sky = settled.toSky(star.x, star.y);
        if (!sky) continue;
        stars.push({
          ...star,
          ...sky,
          rank: stars.length + 1,
          relative: star.brightness / brightest,
          fwhmArcsec: star.fwhmPx * arcsecPerPx,
          radiusArcsec: star.radiusPx * arcsecPerPx,
        });
      }
      setState({ status: "done", result: { stars, found: detection.found, approximate: detection.approximate, fov: settled.fov, arcsecPerPx }, stale: false });
    });
  }, []);

  return { state: enabled ? state : ({ status: "off" } as const), onSettle: enabled ? onSettle : undefined };
}

/** An all-black picture: WebGL gave back an empty buffer. */
function isBlank(data: Uint8ClampedArray) {
  for (let p = 0; p < data.length; p += 4 * 97) if (data[p] || data[p + 1] || data[p + 2]) return false;
  return true;
}
