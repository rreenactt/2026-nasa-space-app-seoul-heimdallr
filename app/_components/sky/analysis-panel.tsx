"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdditionalAnalyses } from "../analyses/additional-analyses";
import { AnalysesProvider, type AutoOpenAnalysis } from "../analyses/analyses-context";
import { PanelViews } from "../analyses/analysis-views";
import { BLINK_FOV_ARCMIN, BlinkProvider } from "../blink/blink-context";
import { BlinkGate, BlinkSummary, BlinkViewer } from "../blink/blink-viewer";
import { useCandidateAt } from "./candidates-context";
import { SKY_SURVEY } from "./constants";
import type { MovementCandidate } from "./review-queue";
import { formatDec, formatRa, type EquatorialCoordinates } from "./sky-coordinates";
import { RatingBadge, RatingSection } from "./rating-section";
import { StatusMark } from "./status-mark";
import type { SkySelection } from "./sky-selection";
import { pinToSpherexArcsec, targetPositionAt, type TestTarget } from "./test-targets";

/** SPHEREx pixel size: a shift below this cannot be seen in the panel images. */
const SPHEREX_PIXEL_ARCSEC = 6.15;

type AnalysisPanelProps = {
  selection: SkySelection | null;
  onClose: () => void;
  /** Opens one additional analysis right away (older `?stm=` / `?sonata=` links). */
  autoOpen?: AutoOpenAnalysis;
  /** Flies to another position of the same test target and opens the panel there. */
  onGoTo?: (point: EquatorialCoordinates, target: TestTarget) => void;
};

/**
 * Overlay over the sky for one point (PLAN.md chapter 5): the blink viewer and opened analyses as tabs on the left;
 * summary, rating and the analysis list on the right. A part that is not connected yet says so plainly instead of
 * showing made-up data.
 */
export function AnalysisPanel({ selection, onClose, autoOpen, onGoTo }: AnalysisPanelProps) {
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
          <PanelBody key={`${selection.ra} ${selection.dec}`} selection={selection} autoOpen={autoOpen} headerRef={headerRef} onGoTo={onGoTo} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PanelBody({
  selection,
  autoOpen,
  headerRef,
  onGoTo,
}: {
  selection: SkySelection;
  autoOpen?: AutoOpenAnalysis;
  headerRef: React.RefObject<HTMLDivElement | null>;
  onGoTo?: AnalysisPanelProps["onGoTo"];
}) {
  const { ra, dec, target } = selection;
  const candidate = useCandidateAt(target ? null : selection);
  const position = target ? targetPositionAt(target, selection) : null;
  const later = target?.spherexPosition;
  // How far the catalog proper motion has carried the object from its pin by the SPHEREx observations.
  const movedArcsec = target ? pinToSpherexArcsec(target) : null;
  const moved = movedArcsec == null ? "" : movedArcsec >= 60 ? `${(movedArcsec / 60).toFixed(1)}′` : `${movedArcsec.toFixed(movedArcsec < 10 ? 2 : 0)}″`;
  const outsideField = movedArcsec != null && movedArcsec > (BLINK_FOV_ARCMIN * 60) / 2;
  return (
    <>
      <DialogHeader ref={headerRef} tabIndex={-1} className="border-b px-4 pt-4 pb-3 outline-none sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pr-8">
          <DialogTitle className="text-lg">{target?.name ?? candidate?.id ?? "Selected point"}</DialogTitle>
          <RatingBadge point={selection} />
          <div className="ml-auto">
            <CopyLinkButton />
          </div>
        </div>
        <DialogDescription className="font-mono text-xs">
          RA {formatRa(ra)} · Dec {formatDec(dec)} (ICRS) · {ra.toFixed(5)}°, {dec.toFixed(5)}°
          {target && position && (
            <span className="font-sans">
              {" "}
              · {position.atSpherexPosition ? "predicted position" : "position"} at epoch {position.epoch} ({position.source}); it
              moves, so it may sit elsewhere in other years
            </span>
          )}
        </DialogDescription>
        {target && later && movedArcsec != null && position && !position.atSpherexPosition && movedArcsec >= SPHEREX_PIXEL_ARCSEC && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
            <span className="min-w-0 flex-1">
              This pin marks where {target.name} was at {target.epoch}. Its catalog proper motion puts it about {moved} away
              by the SPHEREx observations ({later.epoch}):{" "}
              {outsideField
                ? `outside the ${BLINK_FOV_ARCMIN}′ images below, so they do not contain it.`
                : `in the ${BLINK_FOV_ARCMIN}′ images below it sits that far from the centre mark.`}
            </span>
            {onGoTo && (
              <Button variant="outline" size="sm" onClick={() => onGoTo({ ra: later.ra, dec: later.dec }, target)}>
                Open at the {later.epoch} position
              </Button>
            )}
          </div>
        )}
        {target && later && movedArcsec != null && movedArcsec < SPHEREX_PIXEL_ARCSEC && (
          <p className="text-xs text-muted-foreground">
            Its catalog proper motion moves it {moved} between {target.epoch} and {later.epoch}, far below one{" "}
            {SPHEREX_PIXEL_ARCSEC}″ SPHEREx pixel, so the images below cannot show that motion.
          </p>
        )}
        {target?.defaultDetector && (
          <p className="text-xs text-muted-foreground">
            Opens on detector {target.defaultDetector.detector} instead of the usual default: {target.defaultDetector.reason}.
          </p>
        )}
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
                  {candidate && <CandidateNote candidate={candidate} />}

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

const arcsec = (value: number) => `${value.toFixed(value < 10 ? 1 : 0)}″`;
const masPerYear = (value: number) => `${Math.round(value).toLocaleString("en-US")} mas/yr`;

/**
 * What the survey found here and what the reviewer is asked to do. A known mover is the answer key: Gaia DR3 already
 * explains its motion. An unidentified pair has no catalog explanation, so the rating is the reviewer's call; it stays a
 * candidate, never a detection (absolute principle 1). SPHEREx visits are months apart, so the motion shows against
 * 2MASS (about 25 years earlier), not between the blink frames.
 */
function CandidateNote({ candidate }: { candidate: MovementCandidate }) {
  const known = candidate.match === "known";
  const years = candidate.baselineYears.toFixed(0);
  return (
    <section className="grid gap-1.5 text-sm">
      <h3 className="flex items-center gap-2 font-medium">
        <StatusMark kind={known ? "known" : "needs-ratings"} className="size-2.5" />
        {known ? "Known mover · answer key" : "Unidentified · your call"}
        {candidate.synthetic && <span className="text-xs font-normal text-muted-foreground">(synthetic)</span>}
      </h3>
      {known ? (
        <p>
          Gaia DR3 {candidate.gaiaSourceId} already explains this star&apos;s motion
          {candidate.gaiaPmMasYr != null && <> ({masPerYear(candidate.gaiaPmMasYr)})</>}: it accounts for both the 2MASS
          position ({candidate.tmassDesignation}) and the SPHEREx one, {arcsec(candidate.separationArcsec)} apart over{" "}
          {years} years. Use it to check what a real mover looks like before judging unidentified ones.
        </p>
      ) : (
        <p>
          A SPHEREx source with no 2MASS star in place, paired with {candidate.tmassDesignation}{" "}
          {arcsec(candidate.separationArcsec)} away that has no SPHEREx match either. No Gaia DR3 star explains the pair.
          If it is one object it moved about {masPerYear(candidate.pmTotalMasYr)} over {years} years; it may also be a
          chance pair or an artifact. Your rating decides.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        The SPHEREx visits are months apart, so the blink may show little motion. Compare with the 2MASS image in Sky
        Time Machine below.
        {candidate.detections === 1 && " SPHEREx found this source in one visit only: needs further analysis."}
      </p>
    </section>
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
