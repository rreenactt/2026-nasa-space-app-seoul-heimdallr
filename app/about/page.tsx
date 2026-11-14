import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../_components/site/page-shell";

export const metadata: Metadata = {
  title: "About",
  description: "What SPHEREx is, what Planet X is, and what this site does.",
};

const SECTIONS = [
  {
    title: "What is SPHEREx?",
    body: "SPHEREx is a NASA space telescope launched in March 2025. It maps the whole sky in infrared, splitting light into 102 colors between 0.75 and 5 µm, and goes over every part of the sky again about every six months.",
    why: "Why it matters here: the same patch of sky is photographed at different times, so anything that moves between visits can show up.",
  },
  {
    title: "What is Planet X?",
    body: "Planet X is a planet that may exist far beyond Neptune. Some distant icy bodies have orbits that line up in a way a large unseen planet could explain. It has not been found.",
    why: "Why it matters here: a planet that far away would be faint and move very slowly, so looking for it means comparing the same sky over time, carefully.",
  },
  {
    title: "What does this site do?",
    body: "It turns SPHEREx images into a blink: the same spot shown visit after visit, on a fixed sky grid. A program suggests places where something seems to move. Anyone can look, compare and rate each one: Moving, Not moving, or Noise or artifact.",
    why: "What it does not claim: candidates are not detections, and we have not found Planet X. When nothing is found we say so, with the limits of the search.",
  },
];

/** About: SPHEREx, Planet X and the purpose of the site in plain words (decision #36). */
export default function AboutPage() {
  return (
    <PageShell>
      <section className="mx-3 flex min-h-[560px] flex-col justify-end rounded-xs border border-rule bg-[radial-gradient(ellipse_at_70%_20%,rgb(240_240_250/0.08),transparent_60%)] px-14 pt-40 pb-14">
        <h1 className="max-w-3xl text-6xl leading-[1.04] font-light tracking-[-0.03em]">
          Find what moves in SPHEREx images
        </h1>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <p className="max-w-xl text-lg text-bone">
            A public tool where a program suggests moving-object candidates and people check them.
          </p>
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-xs bg-paper px-6 text-[15px] font-medium text-ink transition-colors duration-300 hover:bg-bone"
          >
            Open the sky
          </Link>
        </div>
      </section>
      <div className="px-14">
        {SECTIONS.map((section, index) => (
          <section key={section.title} className="grid gap-6 border-t border-rule py-10 first:mt-20 md:grid-cols-[64px_minmax(0,600px)]">
            <p className="pt-2 font-data text-[13px] text-ash">{String(index + 1).padStart(2, "0")}</p>
            <div>
              <h2 className="text-[34px] font-light tracking-[-0.02em]">{section.title}</h2>
              <p className="mt-6 text-[17px] leading-[1.5] text-bone">{section.body}</p>
              <p className="mt-6 text-[15px] leading-[1.5] text-ash">{section.why}</p>
            </div>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
