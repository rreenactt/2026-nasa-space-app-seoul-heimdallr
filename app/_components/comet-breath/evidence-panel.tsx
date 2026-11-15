"use client";

import { useMemo, useState } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { APERTURE_BAD_FLAGS } from "@/app/_lib/comet/photometry";
import { LIMITATIONS, PAPERS } from "@/app/_lib/comet/published";
import { useT } from "@/app/_i18n/i18n-provider";
import { formatUtc, useCometState } from "./comet-state";
import { decodeFrame, measure, useFrame, useGeometry } from "./use-comet-data";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-mono break-all">{children}</dd>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2 rounded-md border p-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">
      {children}
      <ExternalLinkIcon className="size-3 shrink-0" />
    </a>
  );
}

export function EvidencePanel() {
  const t = useT();
  const { selected, listSource, aperture } = useCometState();
  const [loadPixels, setLoadPixels] = useState(false);
  const [loadGeometry, setLoadGeometry] = useState(false);
  const center = selected ? { ra: selected.cometRa, dec: selected.cometDec } : undefined;
  const frame = useFrame(loadPixels ? selected : undefined, center);
  const geometry = useGeometry(loadGeometry ? selected?.mjdMid : undefined);
  const decoded = useMemo(() => (frame.data ? decodeFrame(frame.data) : undefined), [frame.data]);
  const phot = useMemo(() => (decoded && selected ? measure(decoded, selected, aperture) : null), [decoded, selected, aperture]);

  if (!selected) return null;

  return (
    <div className="grid gap-3 pt-2 text-xs">
      <Section title={t("comet.evSectionList")}>
        <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">
          <Row label="obs_id / detector">{selected.obsId} / {selected.detector}</Row>
          <Row label="t_min – t_max">{formatUtc(selected.utcStart)} – {formatUtc(selected.utcEnd)} ({selected.exptimeS.toFixed(1)} s)</Row>
          <Row label="comet_ra, comet_dec">{selected.cometRa.toFixed(6)}, {selected.cometDec.toFixed(6)}</Row>
          <Row label={t("comet.evImageCenter")}>{selected.imageRa.toFixed(6)}, {selected.imageDec.toFixed(6)}</Row>
          <Row label="em_min – em_max">{t("comet.evFullRange", { min: selected.emMinUm.toFixed(4), max: selected.emMaxUm.toFixed(4) })}</Row>
          <Row label="obs_collection">{selected.listCollection}</Row>
          <Row label="access_url">{selected.accessUrl}</Row>
          <Row label="access_format">{selected.accessFormat}</Row>
          <Row label={t("comet.evListSource")}>{listSource && <ExtLink href={listSource}>{listSource}</ExtLink>}</Row>
        </dl>
      </Section>

      <Section title={t("comet.evSectionPixels")}>
        {!loadPixels ? (
          <Button size="sm" variant="outline" className="w-fit" onClick={() => setLoadPixels(true)}>
            {t("comet.evCheckFile")}
          </Button>
        ) : frame.isPending ? (
          <span className="flex items-center gap-2 text-muted-foreground"><Spinner /> {t("comet.evCheckingFile")}</span>
        ) : frame.isError ? (
          <span className="text-destructive">{frame.error.message}</span>
        ) : (
          decoded && (
            <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">
              <Row label={t("comet.evRelease")}>{t("comet.evReleaseValue", { release: decoded.payload.release, collection: selected.listCollection })}</Row>
              <Row label="DataLink"><ExtLink href={decoded.payload.datalinkUrl}>{decoded.payload.datalinkUrl}</ExtLink></Row>
              <Row label={t("comet.evSourceFits")}><ExtLink href={decoded.payload.fileUrl}>{decoded.payload.fileUrl}</ExtLink></Row>
              <Row label={t("comet.evRangeRead")}>{decoded.payload.pixelSource}</Row>
              <Row label="DATE-OBS / MJD-AVG">{decoded.payload.header.dateObs} / {decoded.payload.header.mjdAvg}</Row>
              <Row label="DQA (L1 / L2)">{decoded.payload.header.l1Dqa} / {decoded.payload.header.l2Dqa}</Row>
              <Row label="PSF FWHM">{decoded.payload.header.psfFwhmArcsec?.toFixed(2)}″</Row>
              <Row label={t("comet.evUnit")}>{t("comet.evUnitValue", { unit: decoded.payload.header.bunit })}</Row>
            </dl>
          )
        )}
      </Section>

      <Section title={t("comet.evSectionSettings")}>
        <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">
          <Row label={t("comet.evAperture")}>{t("comet.evApertureValue", { r: aperture.rAp })}</Row>
          <Row label={t("comet.evBackground")}>{t(aperture.maskSourcesInAnnulus ? "comet.evBackgroundValueMasked" : "comet.evBackgroundValue", { rIn: aperture.rIn, rOut: aperture.rOut })}</Row>
          <Row label={t("comet.evExcludedFlags")}>{t("comet.evExcludedFlagsValue", { flags: APERTURE_BAD_FLAGS.join(", ") })}</Row>
          <Row label={t("comet.evSolidAngle")}>
            {decoded?.payload.header.omegaMedianArcsec2 != null ? `${decoded.payload.header.omegaMedianArcsec2.toFixed(3)} arcsec² (OMEGA_MEDIAN)` : t("comet.evSolidAnglePending")}
          </Row>
          <Row label={t("comet.evFluxConversion")}>{t("comet.evFluxConversionValue")}</Row>
          <Row label={t("comet.evWavelength")}>{t("comet.evWavelengthValue")}</Row>
          <Row label={t("comet.evDisplayedImage")}>{t("comet.evDisplayedImageValue")}</Row>
          {phot && (
            <Row label={t("comet.evThisPhotometry")}>
              {t("comet.evThisPhotometryValue", {
                wavelength: phot.wavelengthUm?.toFixed(3) ?? "",
                flux: phot.fluxMjy.toFixed(2),
                error: phot.errorMjy.toFixed(2),
                background: phot.backgroundMjySr.toFixed(4),
                n: phot.annulusPixels,
                coverage: (phot.apertureCoverage * 100).toFixed(0),
              })}
            </Row>
          )}
        </dl>
      </Section>

      <Section title={t("comet.evSectionGeometry")}>
        {!loadGeometry ? (
          <Button size="sm" variant="outline" className="w-fit" onClick={() => setLoadGeometry(true)}>
            {t("comet.evLookUpDistances")}
          </Button>
        ) : geometry.isPending ? (
          <span className="flex items-center gap-2 text-muted-foreground"><Spinner /> {t("comet.evQueryingHorizons")}</span>
        ) : geometry.isError ? (
          <span className="text-destructive">{geometry.error.message}</span>
        ) : (
          <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">
            <Row label={t("comet.evSunComet")}>{geometry.data.rHelAu.toFixed(4)} au</Row>
            <Row label={t("comet.evObserverComet")}>{geometry.data.deltaAu.toFixed(4)} au</Row>
            <Row label={t("comet.evReference")}>{geometry.data.center} · MJD {geometry.data.mjd.toFixed(4)} · {geometry.data.source}</Row>
            <Row label={t("comet.evNote")}>{t("comet.evGeometryNote")}</Row>
          </dl>
        )}
      </Section>

      <Section title={t("comet.evSectionReferences")}>
        <ul className="grid gap-1.5">
          {PAPERS.map((p) => (
            <li key={p.id}>
              <ExtLink href={p.url}>{p.shortName}</ExtLink> — {p.title}
              <div className="text-muted-foreground">{p.version} · {p.data}</div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("comet.evSectionLimitations")}>
        <ul className="list-disc pl-4 text-muted-foreground">
          {LIMITATIONS.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
