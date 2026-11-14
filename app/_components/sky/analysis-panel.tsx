"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CUTOUT_ARCMIN, SKY_SURVEY } from "./constants";
import { formatDec, formatRa } from "./sky-coordinates";
import type { SkySelection } from "./sky-selection";

const RATINGS = ["Moving", "Not moving", "Noise or artifact"];
const ANALYSES = ["Sky Time Machine", "Fake Planet Lab", "Comet Breath", "Neighborhood in Motion", "Sky Sonata"];

type AnalysisPanelProps = {
  selection: SkySelection | null;
  onClose: () => void;
};

/**
 * Overlay over the sky for one point (PLAN.md chapter 5): images on the left, summary, rating and additional analyses
 * on the right. This is the shell; each part says plainly that it is not connected yet instead of showing made-up data.
 */
export function AnalysisPanel({ selection, onClose }: AnalysisPanelProps) {
  return (
    <Dialog open={selection !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="dark grid h-[min(760px,calc(100dvh-4rem))] w-[min(1200px,calc(100vw-4rem))] max-w-none grid-rows-[auto_minmax(0,1fr)] gap-0 p-0 sm:max-w-none">
        {selection && <PanelBody selection={selection} />}
      </DialogContent>
    </Dialog>
  );
}

function PanelBody({ selection }: { selection: SkySelection }) {
  const { ra, dec, target } = selection;
  return (
    <>
      <DialogHeader className="border-b px-6 pt-5 pb-4">
        <DialogTitle className="text-lg">{target?.name ?? "Selected point"}</DialogTitle>
        <DialogDescription className="font-mono text-xs">
          RA {formatRa(ra)} · Dec {formatDec(dec)} (ICRS) · {ra.toFixed(5)}°, {dec.toFixed(5)}°
        </DialogDescription>
        {target && (
          <p className="text-xs text-muted-foreground">
            Position at epoch {target.epoch} ({target.source}). It moves, so it may sit elsewhere in other years.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Panel images: SPHEREx DR1 cutouts from IRSA · Sky background: {SKY_SURVEY.shortName}
        </p>
      </DialogHeader>

      <div className="grid min-h-0 grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
        <section className="flex min-h-0 items-center justify-center border-r p-6">
          <div className="flex aspect-square h-full max-h-full max-w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center">
            <p className="font-medium">Blink viewer not connected yet</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              The SPHEREx cutouts ({CUTOUT_ARCMIN}′ × {CUTOUT_ARCMIN}′) for this point will play here, aligned on a
              fixed sky grid.
            </p>
          </div>
        </section>

        <ScrollArea className="min-h-0">
          <div className="grid gap-6 p-6">
            {target && <p className="text-sm">{target.note}</p>}

            <PanelSection title="Summary">
              <p className="text-muted-foreground">
                Not available yet: the SPHEREx observation lookup is not connected in this build.
              </p>
            </PanelSection>

            <PanelSection title="Your assessment">
              <div className="flex flex-wrap gap-2">
                {RATINGS.map((rating) => (
                  <Button key={rating} variant="outline" size="sm" disabled>
                    {rating}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Rating opens once the images load.</p>
            </PanelSection>

            <PanelSection title="Additional analyses">
              <ul className="grid gap-1 text-muted-foreground">
                {ANALYSES.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">Not connected in this build.</p>
            </PanelSection>

            <PanelSection title="Share">
              <CopyLinkButton />
            </PanelSection>
          </div>
        </ScrollArea>
      </div>
    </>
  );
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      variant="secondary"
      size="sm"
      className="justify-self-start"
      onClick={() => {
        navigator.clipboard.writeText(window.location.href).then(
          () => setCopied(true),
          () => setCopied(false),
        );
      }}
    >
      {copied ? "Link copied" : "Copy link to this point"}
    </Button>
  );
}
