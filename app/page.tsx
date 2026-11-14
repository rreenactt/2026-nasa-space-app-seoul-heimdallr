import { Button } from "@/components/ui/button";
import { CometBreathDialog } from "./_components/comet-breath/comet-breath-dialog";
import { FakePlanetLabDialog } from "./_components/fake-planet-lab/fake-planet-lab-dialog";
import { SkyExplorer } from "./_components/sky/sky-explorer";
import { SkyTimeMachineDialog } from "./_components/sky-time-machine/sky-time-machine-dialog";
import type { Target } from "./_components/sky-time-machine/stm-state";

/** `?stm=ra,dec,fov` (shared link) opens Sky Time Machine on that field. */
function parseShared(value: string | string[] | undefined): Target | undefined {
  if (typeof value !== "string") return undefined;
  const [ra, dec, fov] = value.split(",").map(Number);
  if (!(ra >= 0 && ra < 360 && Math.abs(dec) <= 90 && [3, 5, 8, 12].includes(fov))) return undefined;
  return { name: "Shared field", ra, dec, fovArcmin: fov, source: "Shared link" };
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const shared = parseShared((await searchParams).stm);
  return (
    <main className="relative flex flex-1 flex-col">
      <SkyExplorer />
      {/* Additional analyses open as overlays on the sky (until they are wired into the analysis panel). */}
      <nav aria-label="Additional analyses" className="absolute top-4 left-4 z-10 flex flex-wrap gap-2">
        <SkyTimeMachineDialog
          initialTarget={shared}
          defaultOpen={Boolean(shared)}
          trigger={<Button size="sm" variant="secondary">Sky Time Machine</Button>}
        />
        <FakePlanetLabDialog trigger={<Button size="sm" variant="secondary">Fake Planet Lab</Button>} />
        <CometBreathDialog trigger={<Button size="sm" variant="secondary">Comet Breath · 3I/ATLAS</Button>} />
      </nav>
    </main>
  );
}
