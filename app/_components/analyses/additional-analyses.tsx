"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SoundSettings } from "@/app/_lib/sonata/mapping";
import { CometBreathDialog } from "../comet-breath/comet-breath-dialog";
import { FakePlanetLabDialog } from "../fake-planet-lab/fake-planet-lab-dialog";
import { NeighborhoodDialog } from "../neighborhood/neighborhood-dialog";
import type { SkySelection } from "../sky/sky-selection";
import { SkySonataDialog } from "../sky-sonata/sky-sonata-dialog";
import { SkyTimeMachineDialog } from "../sky-time-machine/sky-time-machine-dialog";

/** Opens one analysis right away (older `?stm=` / `?sonata=` links). */
export type AutoOpenAnalysis =
  | { analysis: "sky-time-machine"; fovArcmin: number }
  | { analysis: "sky-sonata"; settings: Partial<SoundSettings> };

/** Test targets that are in the Neighborhood in Motion catalog (pin ids from sky/test-targets.ts). */
const NEARBY_PINS = new Set(["barnard", "eps-ind-b", "wise0855"]);

type Availability = { label: string; tone: "ready" | "limited" | "special" };

function Status({ a }: { a: Availability }) {
  return (
    <Badge variant={a.tone === "ready" ? "secondary" : "outline"} className="ml-auto shrink-0">
      {a.label}
    </Badge>
  );
}

/**
 * The five additional analyses (PLAN.md chapter 6) as toggles in the analysis panel. Each opens on the panel's
 * point: name, RA/Dec (ICRS, degrees) and, for test targets, their source and epoch.
 */
export function AdditionalAnalyses({ selection, autoOpen }: { selection: SkySelection; autoOpen?: AutoOpenAnalysis }) {
  const { ra, dec, target } = selection;
  const name = target?.name ?? "Selected point";
  const source = target ? `${target.source} (epoch ${target.epoch})` : "Point chosen on the sky";
  const nearby = target ? NEARBY_PINS.has(target.id) : false;
  const isComet = /3I\/ATLAS/i.test(target?.name ?? "");
  const stmFov = autoOpen?.analysis === "sky-time-machine" ? autoOpen.fovArcmin : 8;

  const items: {
    id: string;
    title: string;
    summary: string;
    availability: Availability;
    details: string[];
    open: React.ReactElement;
  }[] = [
    {
      id: "sky-time-machine",
      title: "Sky Time Machine",
      summary: "The same patch of sky from 2MASS (≈2000), WISE/NEOWISE (2010–2024) and SPHEREx, in real observation order.",
      availability: { label: "Any position", tone: "ready" },
      details: [
        `Opens an ${stmFov}′ field centred on this point; change it inside.`,
        "Positions only: brightness is not compared across telescopes. Gaia predicted paths can be overlaid.",
      ],
      open: (
        <SkyTimeMachineDialog
          initialTarget={{ name, ra, dec, fovArcmin: stmFov, source }}
          defaultOpen={autoOpen?.analysis === "sky-time-machine"}
          trigger={<Button size="sm">Open Sky Time Machine here</Button>}
        />
      ),
    },
    {
      id: "fake-planet-lab",
      title: "Fake Planet Lab",
      summary: "Is a dot real or a defect? Quality flags, uncertainty and other observations for any spot you click.",
      availability: { label: "Any position", tone: "ready" },
      details: ["Opens the SPHEREx exposures covering this point. Click a dot to run the checks; records can be downloaded."],
      open: (
        <FakePlanetLabDialog
          initialTarget={{ name, ra, dec, note: target?.note ?? "" }}
          trigger={<Button size="sm">Open Fake Planet Lab here</Button>}
        />
      ),
    },
    {
      id: "neighborhood-in-motion",
      title: "Neighborhood in Motion",
      summary: "Nearby stars and brown dwarfs in 3D from measured distance and motion, past and future paths, linked to SPHEREx.",
      availability: nearby ? { label: "Object in the map", tone: "ready" } : { label: "Nearby objects only", tone: "limited" },
      details: [
        nearby
          ? `${name} is in the map (within about 3.6 pc); it will be selected.`
          : "Works for objects with a known parallax within about 3.6 pc. This point will be matched to the nearest one, and the map says if none is close.",
      ],
      open: <NeighborhoodDialog focus={{ ra, dec, name }} trigger={<Button size="sm">Open Neighborhood in Motion</Button>} />,
    },
    {
      id: "sky-sonata",
      title: "Sky Sonata",
      summary: "Hear the sky: position becomes left/right and pitch, brightness becomes loudness. Keyboard-first.",
      availability: { label: "Any position", tone: "ready" },
      details: ["Opens SPHEREx observations of this point. Sound starts only after you press Start sound."],
      open: (
        <SkySonataDialog
          shared={{ target: { name, ra, dec, note: target?.note ?? "" }, settings: autoOpen?.analysis === "sky-sonata" ? autoOpen.settings : undefined }}
          defaultOpen={autoOpen?.analysis === "sky-sonata"}
          trigger={<Button size="sm">Open Sky Sonata here</Button>}
        />
      ),
    },
    {
      id: "comet-breath",
      title: "Comet Breath · 3I/ATLAS",
      summary: "Water, CO₂ and CO from the interstellar comet 3I/ATLAS, before and after perihelion.",
      availability: isComet ? { label: "This target", tone: "ready" } : { label: "3I/ATLAS only", tone: "special" },
      details: [
        "Uses the dedicated 3I/ATLAS dataset, not this point: the comet moves, so it cannot be found by fixed coordinates.",
      ],
      open: <CometBreathDialog trigger={<Button size="sm" variant="outline">Open Comet Breath</Button>} />,
    },
  ];

  return (
    <Accordion defaultValue={autoOpen ? [autoOpen.analysis] : []} multiple className="rounded-md border">
      {items.map((it) => (
        <AccordionItem key={it.id} value={it.id} className="px-3">
          <AccordionTrigger className="gap-2 py-2.5 text-sm">
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate font-medium">{it.title}</span>
              <Status a={it.availability} />
            </span>
          </AccordionTrigger>
          {/* keepMounted: collapsing a toggle must not close an analysis that is open. */}
          <AccordionContent keepMounted className="grid gap-2 pb-3 text-xs">
            <p>{it.summary}</p>
            <ul className="list-disc pl-4 text-muted-foreground">
              {it.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            <div>{it.open}</div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
