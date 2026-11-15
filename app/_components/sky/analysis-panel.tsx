"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdditionalAnalyses } from "../analyses/additional-analyses";
import { AnalysesProvider, type AutoOpenAnalysis } from "../analyses/analyses-context";
import { PanelViews } from "../analyses/analysis-views";
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
};

/**
 * Overlay over the sky for one point (PLAN.md chapter 5): the blink viewer and opened analyses as tabs on the left;
 * summary, rating and the analysis list on the right. A part that is not connected yet says so plainly instead of
 * showing made-up data.
 */
export function AnalysisPanel({ selection, onClose, autoOpen }: AnalysisPanelProps) {
  // Focus starts on the header, not on its first button: Space then plays the blink instead of pressing "Copy link".
  const headerRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog open={selection !== null} onOpenChange={(open) => !open && onClose()}>
      {/* Inside the frame (56px band on top, 12px at the sides and bottom; Figma "I · Frame states · Analysis open"),
          over the sky the frame darkens by 45%. The panel fills the frame with a 16px inset, so the images get as much
          room as the screen allows. */}
      <DialogContent initialFocus={headerRef} className="dark top-[calc(50%+24px)] grid h-[calc(100dvh-72px)] w-[calc(100vw-16px)] max-w-none sm:top-[calc(50%+22px)] sm:h-[calc(100dvh-100px)] sm:w-[calc(100vw-56px)] grid-rows-[auto_minmax(0,1fr)] gap-0 p-0 sm:max-w-none">
        {/* Keyed by the point: "Next" swaps the place while the panel stays open, and every part starts fresh. */}
        {selection && (
          <PanelBody key={`${selection.ra} ${selection.dec}`} selection={selection} autoOpen={autoOpen} headerRef={headerRef} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PanelBody({
  selection,
  autoOpen,
  headerRef,
}: {
  selection: SkySelection;
  autoOpen?: AutoOpenAnalysis;
  headerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { ra, dec, target } = selection;
  return (
    <>
      <DialogHeader ref={headerRef} tabIndex={-1} className="border-b px-4 pt-4 pb-3 outline-none sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pr-8">
          <DialogTitle className="text-lg">{target?.name ?? "Selected point"}</DialogTitle>
          <RatingBadge point={selection} />
          <div className="ml-auto">
            <CopyLinkButton />
          </div>
        </div>
        <DialogDescription className="font-mono text-xs">
          RA {formatRa(ra)} · Dec {formatDec(dec)} (ICRS) · {ra.toFixed(5)}°, {dec.toFixed(5)}°
          {target && (
            <span className="font-sans">
              {" "}
              · position at epoch {target.epoch} ({target.source}); it moves, so it may sit elsewhere in other years
            </span>
          )}
        </DialogDescription>
      </DialogHeader>

      <BlinkProvider selection={selection}>
        <AnalysesProvider selection={selection} autoOpen={autoOpen}>
          <BlinkGate>
            {/* Wide screens: images left, summary right, each scrolling on its own. Narrower than 1024px: one column
                (images, then summary, rating and analyses) and the whole panel scrolls. */}
            <div className="min-h-0 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)] lg:overflow-hidden">
              <div className="h-[min(calc(100vw+400px),calc(100dvh-140px))] min-h-[560px] border-b lg:h-auto lg:min-h-0 lg:border-r lg:border-b-0">
                <PanelViews blink={<BlinkViewer />} />
              </div>

              <div className="min-h-0 lg:overflow-y-auto">
                <div className="grid gap-6 p-4 sm:p-6">
                  {target && <p className="text-sm">{target.note}</p>}

                  <PanelSection title="Summary">
                    <BlinkSummary />
                  </PanelSection>

                  <PanelSection title="Your assessment">
                    <RatingSection />
                  </PanelSection>

                  <PanelSection title="Additional analyses">
                    <AdditionalAnalyses />
                  </PanelSection>

                  <p className="text-xs text-muted-foreground">
                    Panel images: SPHEREx DR1 cutouts from IRSA. Sky background: {SKY_SURVEY.shortName}, for browsing only.
                  </p>
                </div>
              </div>
            </div>
          </BlinkGate>
        </AnalysesProvider>
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

/** Copies the address, which holds this point (PLAN.md chapter 5, URL state). */
function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        navigator.clipboard.writeText(window.location.href).then(
          () => setCopied(true),
          () => setCopied(false),
        );
      }}
    >
      {copied ? <CheckIcon /> : <LinkIcon />}
      {copied ? "Link copied" : "Copy link"}
    </Button>
  );
}
