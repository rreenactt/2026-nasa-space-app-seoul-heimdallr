"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AdditionalAnalyses, type AutoOpenAnalysis } from "../analyses/additional-analyses";
import { BlinkProvider } from "../blink/blink-context";
import { BlinkSummary, BlinkViewer } from "../blink/blink-viewer";
import { SKY_SURVEY } from "./constants";
import { formatDec, formatRa } from "./sky-coordinates";
import type { SkySelection } from "./sky-selection";

const RATINGS = ["Moving", "Not moving", "Noise or artifact"];

type AnalysisPanelProps = {
  selection: SkySelection | null;
  onClose: () => void;
  /** Opens one additional analysis right away (older `?stm=` / `?sonata=` links). */
  autoOpen?: AutoOpenAnalysis;
};

/**
 * Overlay over the sky for one point (PLAN.md chapter 5): images on the left, summary, rating and additional analyses
 * on the right. This is the shell; each part says plainly that it is not connected yet instead of showing made-up data.
 */
export function AnalysisPanel({ selection, onClose, autoOpen }: AnalysisPanelProps) {
  return (
    <Dialog open={selection !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="dark grid h-[min(760px,calc(100dvh-4rem))] w-[min(1200px,calc(100vw-4rem))] max-w-none grid-rows-[auto_minmax(0,1fr)] gap-0 p-0 sm:max-w-none">
        {selection && <PanelBody selection={selection} autoOpen={autoOpen} />}
      </DialogContent>
    </Dialog>
  );
}

function PanelBody({ selection, autoOpen }: { selection: SkySelection; autoOpen?: AutoOpenAnalysis }) {
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

      <BlinkProvider selection={selection}>
      <div className="grid min-h-0 grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
        <section className="flex min-h-0 items-stretch justify-center border-r p-4">
          <BlinkViewer />
        </section>

        <ScrollArea className="min-h-0">
          <div className="grid gap-6 p-6">
            {target && <p className="text-sm">{target.note}</p>}

            <PanelSection title="Summary">
              <BlinkSummary />
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
              <AdditionalAnalyses selection={selection} autoOpen={autoOpen} />
            </PanelSection>

            <PanelSection title="Share">
              <CopyLinkButton />
            </PanelSection>
          </div>
        </ScrollArea>
      </div>
      </BlinkProvider>
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
