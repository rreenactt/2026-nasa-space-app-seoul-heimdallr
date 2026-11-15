import type { Metadata } from "next";
import { PageShell } from "../_components/site/page-shell";
import { MethodNav } from "./_components/method-nav";

export const metadata: Metadata = {
  title: "Method",
  description: "How the comparison works, what it can find and what it cannot.",
};

const SECTIONS = [
  {
    id: "fixed-grid",
    title: "Blink on a fixed sky grid",
    body: "Every visit is cut out on the same sky grid, set by the coordinates you chose. We never re-center on the target, because that would hide the motion. Coordinates of moving objects are always given with the time they were observed.",
  },
  {
    id: "same-detector",
    title: "Same detector, close wavelengths",
    body: "SPHEREx uses a linear variable filter, so the wavelength changes across one image. We compare only images from the same detector at close wavelengths. Brightness and difference images stay within SPHEREx.",
  },
  {
    id: "one-visit",
    title: "When there is only one visit",
    body: "One SPHEREx visit cannot show motion by itself. We mark it as needing more analysis and offer comparisons with other surveys (2MASS, WISE, Gaia), by position only.",
  },
  {
    id: "rating",
    title: "From candidate to rating",
    body: "A program suggests candidates in batches. People rate them, and other ratings stay hidden until you rate. Candidates with low ratings leave the list but are never deleted.",
  },
  {
    id: "limits",
    title: "Limits of the search",
    body: "Detection limits by field and brightness will be listed here once the candidate pipeline reports them. If nothing is found, this section says so.",
  },
  {
    id: "sources",
    title: "Data sources and credits",
    body: "SPHEREx images from IRSA (DR1, else QR3). Background sky from CDS HiPS, currently the 2MASS color HiPS mirrored by IRSA while the SPHEREx tiles are unavailable. Gaia DR3; JPL and the Minor Planet Center for known asteroids. Original FITS files are linked, not stored.",
  },
];

/** Method: how the comparison works and its limits (AGENTS.md principles, PLAN.md chapters 4 and 7). */
export default function MethodPage() {
  return (
    <PageShell>
      <div className="px-14 pt-16">
        <h1 className="text-[56px] font-light tracking-[-0.03em]">Method</h1>
        <p className="mt-3 max-w-2xl text-lg text-ash">How the comparison works, what it can find and what it cannot.</p>
      </div>
      <div className="mt-20 grid gap-10 px-14 md:grid-cols-[300px_minmax(0,760px)] md:gap-14">
        <MethodNav sections={SECTIONS.map(({ id, title }) => ({ id, title }))} />
        <div className="grid gap-20 border-rule md:border-l md:pl-14">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="text-[26px] font-light tracking-[-0.02em]">{section.title}</h2>
              <p className="mt-4 text-base leading-[1.55] text-bone">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
