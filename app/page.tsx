import { Button } from "@/components/ui/button";
import { CometBreathDialog } from "./_components/comet-breath/comet-breath-dialog";
import { FakePlanetLabDialog } from "./_components/fake-planet-lab/fake-planet-lab-dialog";
import { NeighborhoodDialog } from "./_components/neighborhood/neighborhood-dialog";
import { SkySonataDialog, type SonataShared } from "./_components/sky-sonata/sky-sonata-dialog";
import { TARGET_FOV } from "./_components/sky/constants";
import { SkyExplorer } from "./_components/sky/sky-explorer";
import { parseSelection } from "./_components/sky/sky-selection";
import { SkyTimeMachineDialog } from "./_components/sky-time-machine/sky-time-machine-dialog";
import type { Target } from "./_components/sky-time-machine/stm-state";

/** Older shared link `?stm=ra,dec,fov` (fov in arcminutes): still opens Sky Time Machine on that field. */
function parseShared(value: string | string[] | undefined): Target | undefined {
  if (typeof value !== "string") return undefined;
  const [ra, dec, fov] = value.split(",").map(Number);
  if (!(ra >= 0 && ra < 360 && Math.abs(dec) <= 90 && [3, 5, 8, 12].includes(fov))) return undefined;
  return { name: "Shared field", ra, dec, fovArcmin: fov, source: "Shared link" };
}

/** `?sonata=ra,dec,fMin,fMax,scanSeconds,mono,fluxLo,fluxHi` opens Sky Sonata with that field and sound rules. */
function parseSonata(value: string | string[] | undefined): SonataShared | undefined {
  if (typeof value !== "string") return undefined;
  const [ra, dec, fMin, fMax, scan, mono, lo, hi] = value.split(",").map(Number);
  if (!(ra >= 0 && ra < 360 && Math.abs(dec) <= 90)) return undefined;
  const ok = (v: number, a: number, b: number) => Number.isFinite(v) && v >= a && v <= b;
  return {
    target: { name: "Shared field", ra, dec, note: "" },
    settings: {
      ...(ok(fMin, 50, 1000) ? { fMin } : {}),
      ...(ok(fMax, 500, 5000) ? { fMax } : {}),
      ...(ok(scan, 1, 30) ? { scanSeconds: scan } : {}),
      mono: mono === 1,
      ...(ok(lo, 1e-6, 1e6) && ok(hi, 1e-6, 1e6) && hi > lo ? { fluxLo: lo, fluxHi: hi } : {}),
    },
  };
}

/**
 * Shared links use `/?ra=&dec=&fov=` (degrees; fov is the sky view), which opens the sky at that point with the
 * analysis panel open. The older `?stm=` link keeps working and also moves the sky to its field.
 */
export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const initialSelection = parseSelection(params);
  const shared = parseShared(params.stm);
  const sonata = parseSonata(params.sonata);
  const initialView =
    initialSelection ?? (shared ? { ra: shared.ra, dec: shared.dec, fov: TARGET_FOV } : undefined);

  return (
    <main className="relative flex flex-1 flex-col">
      <SkyExplorer
        initialSelection={initialSelection}
        initialView={initialView}
        analysisLinks={
          // Additional analyses open as overlays on the sky until they are wired into the analysis panel.
          <nav aria-label="Additional analyses" className="flex flex-wrap gap-2">
            <SkyTimeMachineDialog
              initialTarget={shared}
              defaultOpen={Boolean(shared)}
              trigger={<Button size="sm" variant="secondary">Sky Time Machine</Button>}
            />
            <FakePlanetLabDialog trigger={<Button size="sm" variant="secondary">Fake Planet Lab</Button>} />
            <NeighborhoodDialog trigger={<Button size="sm" variant="secondary">Neighborhood in Motion</Button>} />
            <SkySonataDialog shared={sonata} defaultOpen={Boolean(sonata)} trigger={<Button size="sm" variant="secondary">Sky Sonata</Button>} />
            <CometBreathDialog trigger={<Button size="sm" variant="secondary">Comet Breath · 3I/ATLAS</Button>} />
          </nav>
        }
      />
    </main>
  );
}
