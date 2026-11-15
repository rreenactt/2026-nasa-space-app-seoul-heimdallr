import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import skyHero from "./sky-hero.jpg";
import { PageShell } from "../_components/site/page-shell";
import { BlinkDiagram, PlanetXDiagram, RevisitDiagram } from "./_components/about-diagrams";

export const metadata: Metadata = {
  title: "About",
  description: "What SPHEREx is, what Planet X is, and what this site does.",
};

const SECTIONS = [
  {
    title: "What is SPHEREx?",
    body: "SPHEREx is a NASA space telescope launched in March 2025. It maps the whole sky in infrared, splitting light into 102 colors between 0.75 and 5 µm, and goes over every part of the sky again about every six months.",
    why: "Why it matters here: the same patch of sky is photographed at different times, so anything that moves between visits can show up.",
    figure: <RevisitDiagram />,
  },
  {
    title: "What is Planet X?",
    body: "Planet X is a planet that may exist far beyond Neptune. Some distant icy bodies have orbits that line up in a way a large unseen planet could explain. It has not been found.",
    why: "Why it matters here: a planet that far away would be faint and move very slowly, so finding it means comparing the same sky over time, carefully.",
    figure: <PlanetXDiagram />,
  },
  {
    title: "What does this site do?",
    body: "It turns SPHEREx images into a blink: the same spot shown visit after visit, on a fixed sky grid. A program suggests places where something seems to move. Anyone can look, compare and rate: Moving, Not moving, or Noise or artifact.",
    why: "What it does not claim: candidates are not detections, and we have not found Planet X. When nothing is found we say so, with the limits of the search.",
    figure: <BlinkDiagram />,
  },
];

/** About: SPHEREx, Planet X and the purpose of the site in plain words (decision #36). */
export default function AboutPage() {
  return (
    <PageShell>
      {/* Figma "I · About": the sky inset (12px sides, 560px high, 2px corners) with the real sky behind the title. */}
      <section className="relative isolate mx-3 flex min-h-[560px] flex-col justify-end overflow-hidden rounded-[2px] px-14 pt-40 pb-8">
        <Image src={skyHero} alt="" fill priority sizes="100vw" className="-z-10 object-cover object-[50%_35%]" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-t from-ink via-ink/55 to-ink/10" />
        <h1 className="max-w-[640px] text-[length:clamp(40px,4.1vw,64px)] leading-[1.04] font-light tracking-[-0.03em]">
          Find what moves
          <br />
          in SPHEREx images
        </h1>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
          <p className="max-w-[640px] text-lg text-bone">
            A public tool where our team regularly updates moving-object candidates and anyone can check them.
          </p>
          <Link
            href="/"
            className="inline-flex h-10 w-40 items-center justify-center rounded-[2px] bg-paper text-[15px] font-medium text-ink transition-colors duration-300 hover:bg-bone"
          >
            Open the sky
          </Link>
        </div>
      </section>
      <div className="px-14">
        {SECTIONS.map((section, index) => (
          <section key={section.title} className="grid gap-x-6 gap-y-8 border-t border-rule pt-7 pb-[52px] first:mt-14 md:grid-cols-[64px_minmax(0,1fr)] lg:grid-cols-[64px_minmax(0,600px)_minmax(0,1fr)]">
            <p className="pt-2 font-data text-[13px] text-ash">{String(index + 1).padStart(2, "0")}</p>
            <div>
              <h2 className="text-[34px] font-light tracking-[-0.02em]">{section.title}</h2>
              <p className="mt-6 text-[17px] leading-[1.5] text-bone">{section.body}</p>
              <p className="mt-6 text-[15px] leading-[1.5] text-ash">{section.why}</p>
            </div>
            <div className="md:col-start-2 lg:col-start-auto">{section.figure}</div>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
