import { SkyExplorer } from "./_components/sky/sky-explorer";
import { parseSelection } from "./_components/sky/sky-selection";

/** `/?ra=&dec=&fov=` (a shared link) opens the sky at that point with the analysis panel open. */
export default async function Home({ searchParams }: PageProps<"/">) {
  const initialSelection = parseSelection(await searchParams);
  return (
    <main className="flex flex-1 flex-col">
      <SkyExplorer initialSelection={initialSelection} />
    </main>
  );
}
