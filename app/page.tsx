import { CometBreathDialog } from "./_components/comet-breath/comet-breath-dialog";
import { FakePlanetLabDialog } from "./_components/fake-planet-lab/fake-planet-lab-dialog";
import { SkyTimeMachineDialog } from "./_components/sky-time-machine/sky-time-machine-dialog";
import type { Target } from "./_components/sky-time-machine/stm-state";

/** `?stm=ra,dec,fov` (shared link) opens Sky Time Machine on that field. */
function parseShared(value: string | string[] | undefined): Target | undefined {
  if (typeof value !== "string") return undefined;
  const [ra, dec, fov] = value.split(",").map(Number);
  if (!(ra >= 0 && ra < 360 && Math.abs(dec) <= 90 && [3, 5, 8, 12].includes(fov))) return undefined;
  return { name: "공유된 좌표", ra, dec, fovArcmin: fov, source: "공유 링크" };
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const shared = parseShared((await searchParams).stm);
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-24">
      <section className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sky Time Machine</h1>
        <p className="text-muted-foreground">
          2MASS(2000년경)·WISE·NEOWISE(2010–2024)·SPHEREx(2025–)가 찍은 같은 하늘을 실제 관측 순서대로 넘겨보며 움직이는 천체를 찾습니다.
        </p>
        <div>
          <SkyTimeMachineDialog initialTarget={shared} defaultOpen={Boolean(shared)} trigger={undefined} />
        </div>
      </section>
      <section className="grid gap-2">
        <h2 className="text-xl font-semibold tracking-tight">Fake Planet Lab</h2>
        <p className="text-muted-foreground">
          Is a moving-looking dot a real signal or an image defect? Inspect SPHEREx quality flags, uncertainty and other observations at any position, and keep the evidence.
        </p>
        <div>
          <FakePlanetLabDialog />
        </div>
      </section>
      <section className="grid gap-2">
        <h2 className="text-xl font-semibold tracking-tight">Comet Breath</h2>
        <p className="text-muted-foreground">
          SPHEREx가 2025년 8월과 12월에 관측한 성간 혜성 3I/ATLAS의 영상·스펙트럼·기체 방출률을 관측 근거와 함께 탐색합니다.
        </p>
        <div>
          <CometBreathDialog />
        </div>
      </section>
    </main>
  );
}
