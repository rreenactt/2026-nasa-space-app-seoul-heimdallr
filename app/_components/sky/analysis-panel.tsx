"use client";

import { useEffect, useState } from "react";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AdditionalAnalyses, type AutoOpenAnalysis } from "../analyses/additional-analyses";
import { BlinkProvider } from "../blink/blink-context";
import { BlinkGate, BlinkSummary, BlinkViewer } from "../blink/blink-viewer";
import { SKY_SURVEY } from "./constants";
import { formatDec, formatRa } from "./sky-coordinates";
import { RatingBadge, RatingSection } from "./rating-section";
import type { SkySelection } from "./sky-selection";

type AnalysisPanelProps = {
  selection: SkySelection | null;
  onClose: () => void;
  /** Opens one additional analysis right away (older `?stm=` / `?sonata=` links). */
  autoOpen?: AutoOpenAnalysis;
  /** The next place in the review order (test targets, then movement candidates), if any. */
  next?: { name: string; go: () => void };
};

/**
 * Overlay over the sky for one point (PLAN.md chapter 5): images on the left, summary, rating and additional analyses
 * on the right. A part that is not connected yet says so plainly instead of showing made-up data.
 */
export function AnalysisPanel({ selection, onClose, autoOpen, next }: AnalysisPanelProps) {
  return (
    <Dialog open={selection !== null} onOpenChange={(open) => !open && onClose()}>
      {/* Inside the frame (56px band on top, 12px at the sides and bottom; Figma "I · Frame states · Analysis open"),
          over the sky the frame darkens by 45%. Only the placement is set here; the panel body is unchanged. */}
      <DialogContent className="dark top-[calc(50%+22px)] grid h-[min(760px,calc(100dvh-100px))] w-[min(1200px,calc(100vw-56px))] max-w-none grid-rows-[auto_minmax(0,1fr)] gap-0 p-0 sm:max-w-none">
        {/* Keyed by the point: "Next" swaps the place while the panel stays open, and every part starts fresh. */}
        {selection && (
          <PanelBody key={`${selection.ra} ${selection.dec}`} selection={selection} autoOpen={autoOpen} next={next} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PanelBody({
  selection,
  autoOpen,
  next,
}: {
  selection: SkySelection;
  autoOpen?: AutoOpenAnalysis;
  next?: AnalysisPanelProps["next"];
}) {
  const { ra, dec, target } = selection;
  return (
    <>
      <DialogHeader className="border-b px-6 pt-5 pb-4">
        <div className="flex items-center gap-3 pr-8">
          <DialogTitle className="text-lg">{target?.name ?? "Selected point"}</DialogTitle>
          <RatingBadge point={selection} />
          {next && (
            <Button variant="outline" size="sm" className="ml-auto" onClick={next.go}>
              Next: {next.name}
              <ArrowRightIcon />
            </Button>
          )}
        </div>
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
      <BlinkGate>
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
              <RatingSection />
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
      </BlinkGate>
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
