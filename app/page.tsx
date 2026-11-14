import type { AutoOpenAnalysis } from "./_components/analyses/additional-analyses";
import { TARGET_FOV } from "./_components/sky/constants";
import { SkyExplorer } from "./_components/sky/sky-explorer";
import { parseSelection, type SkySelection } from "./_components/sky/sky-selection";
import { findTestTarget } from "./_components/sky/test-targets";
import type { SoundSettings } from "./_lib/sonata/mapping";

/** Older Sky Time Machine link `?stm=ra,dec,fov` (fov = cutout field in arcminutes). */
function parseStm(value: string | string[] | undefined) {
  if (typeof value !== "string") return undefined;
  const [ra, dec, fov] = value.split(",").map(Number);
  if (!(ra >= 0 && ra < 360 && Math.abs(dec) <= 90 && [3, 5, 8, 12].includes(fov))) return undefined;
  return { ra, dec, fovArcmin: fov };
}

/** Older Sky Sonata link `?sonata=ra,dec,fMin,fMax,scanSeconds,mono,fluxLo,fluxHi`. */
function parseSonata(value: string | string[] | undefined) {
  if (typeof value !== "string") return undefined;
  const [ra, dec, fMin, fMax, scan, mono, lo, hi] = value.split(",").map(Number);
  if (!(ra >= 0 && ra < 360 && Math.abs(dec) <= 90)) return undefined;
  const ok = (v: number, a: number, b: number) => Number.isFinite(v) && v >= a && v <= b;
  const settings: Partial<SoundSettings> = {
    ...(ok(fMin, 50, 1000) ? { fMin } : {}),
    ...(ok(fMax, 500, 5000) ? { fMax } : {}),
    ...(ok(scan, 1, 30) ? { scanSeconds: scan } : {}),
    mono: mono === 1,
    ...(ok(lo, 1e-6, 1e6) && ok(hi, 1e-6, 1e6) && hi > lo ? { fluxLo: lo, fluxHi: hi } : {}),
  };
  return { ra, dec, settings };
}

/**
 * Shared links use `/?ra=&dec=&fov=` (degrees; fov is the sky view): the sky opens at that point with the analysis
 * panel, where the additional analyses are. Older `?stm=` and `?sonata=` links open the panel at their point and
 * then that analysis.
 */
export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const standard = parseSelection(params);
  const stm = parseStm(params.stm);
  const sonata = parseSonata(params.sonata);

  let initialSelection: SkySelection | null = standard;
  let autoOpen: AutoOpenAnalysis | undefined;
  if (!standard && stm) {
    initialSelection = { ra: stm.ra, dec: stm.dec, fov: TARGET_FOV, target: findTestTarget(stm) };
    autoOpen = { analysis: "sky-time-machine", fovArcmin: stm.fovArcmin };
  } else if (!standard && sonata) {
    initialSelection = { ra: sonata.ra, dec: sonata.dec, fov: TARGET_FOV, target: findTestTarget(sonata) };
    autoOpen = { analysis: "sky-sonata", settings: sonata.settings };
  }

  return (
    <main className="relative flex flex-1 flex-col">
      <SkyExplorer
        initialSelection={initialSelection}
        initialView={initialSelection ? { ra: initialSelection.ra, dec: initialSelection.dec, fov: initialSelection.fov } : undefined}
        autoOpen={autoOpen}
      />
    </main>
  );
}
