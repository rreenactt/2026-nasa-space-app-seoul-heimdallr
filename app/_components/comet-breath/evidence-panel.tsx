"use client";

import { useMemo, useState } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { APERTURE_BAD_FLAGS } from "@/app/_lib/comet/photometry";
import { LIMITATIONS, PAPERS } from "@/app/_lib/comet/published";
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
      <Section title="① Observation list entry (comet-specific list)">
        <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">
          <Row label="obs_id / detector">{selected.obsId} / {selected.detector}</Row>
          <Row label="t_min – t_max">{formatUtc(selected.utcStart)} – {formatUtc(selected.utcEnd)} ({selected.exptimeS.toFixed(1)} s)</Row>
          <Row label="comet_ra, comet_dec">{selected.cometRa.toFixed(6)}, {selected.cometDec.toFixed(6)}</Row>
          <Row label="s_ra, s_dec (image center)">{selected.imageRa.toFixed(6)}, {selected.imageDec.toFixed(6)}</Row>
          <Row label="em_min – em_max">{selected.emMinUm.toFixed(4)} – {selected.emMaxUm.toFixed(4)} µm (full detector range)</Row>
          <Row label="obs_collection">{selected.listCollection}</Row>
          <Row label="access_url">{selected.accessUrl}</Row>
          <Row label="access_format">{selected.accessFormat}</Row>
          <Row label="List source">{listSource && <ExtLink href={listSource}>{listSource}</ExtLink>}</Row>
        </dl>
      </Section>

      <Section title="② Pixel file actually used">
        {!loadPixels ? (
          <Button size="sm" variant="outline" className="w-fit" onClick={() => setLoadPixels(true)}>
            Check the source file (reads only the needed rows)
          </Button>
        ) : frame.isPending ? (
          <span className="flex items-center gap-2 text-muted-foreground"><Spinner /> Checking the matching DR1 file through DataLink…</span>
        ) : frame.isError ? (
          <span className="text-destructive">{frame.error.message}</span>
        ) : (
          decoded && (
            <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">
              <Row label="Release">{decoded.payload.release} (the list’s {selected.listCollection} DataLink returns no file → looked up the same obs_id and detector through the {decoded.payload.release} DataLink, #this image confirmed)</Row>
              <Row label="DataLink"><ExtLink href={decoded.payload.datalinkUrl}>{decoded.payload.datalinkUrl}</ExtLink></Row>
              <Row label="L2b source FITS"><ExtLink href={decoded.payload.fileUrl}>{decoded.payload.fileUrl}</ExtLink></Row>
              <Row label="Range actually read">{decoded.payload.pixelSource}</Row>
              <Row label="DATE-OBS / MJD-AVG">{decoded.payload.header.dateObs} / {decoded.payload.header.mjdAvg}</Row>
              <Row label="DQA (L1 / L2)">{decoded.payload.header.l1Dqa} / {decoded.payload.header.l2Dqa}</Row>
              <Row label="PSF FWHM">{decoded.payload.header.psfFwhmArcsec?.toFixed(2)}″</Row>
              <Row label="Unit">{decoded.payload.header.bunit} (surface brightness)</Row>
            </dl>
          )
        )}
      </Section>

      <Section title="③ Processing settings">
        <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">
          <Row label="Aperture">Radius {aperture.rAp} px (paper 12″ ≈ 2 px)</Row>
          <Row label="Background">{aperture.rIn}–{aperture.rOut} px annulus, 3σ-clipped median{aperture.maskSourcesInAnnulus ? ", SOURCE flag excluded" : ""}</Row>
          <Row label="Excluded flags">Aperture: {APERTURE_BAD_FLAGS.join(", ")} · Background annulus: the same plus OUTLIER (the pipeline flags the moving comet nucleus as OUTLIER, so the aperture does not exclude it)</Row>
          <Row label="Pixel solid angle">
            {decoded?.payload.header.omegaMedianArcsec2 != null ? `${decoded.payload.header.omegaMedianArcsec2.toFixed(3)} arcsec² (OMEGA_MEDIAN)` : "OMEGA_MEDIAN (shown after checking the pixel file)"}
          </Row>
          <Row label="Flux conversion">Σ(I − B)·Ω, MJy/sr → mJy; error = √(ΣVAR + A²σ_B²/N)·Ω</Row>
          <Row label="Wavelength">Approximate WCS-WAVE lookup table, bilinear interpolation at the comet pixel</Row>
          <Row label="Displayed image">Stretch and ZODI subtraction are for display only and are not used in photometry</Row>
          {phot && (
            <Row label="Photometry for this observation">
              λ {phot.wavelengthUm?.toFixed(3)} µm · {phot.fluxMjy.toFixed(2)} ± {phot.errorMjy.toFixed(2)} mJy · background {phot.backgroundMjySr.toFixed(4)} MJy/sr (N={phot.annulusPixels}) · aperture pixels used {(phot.apertureCoverage * 100).toFixed(0)}%
            </Row>
          )}
        </dl>
      </Section>

      <Section title="④ Observing geometry (JPL Horizons)">
        {!loadGeometry ? (
          <Button size="sm" variant="outline" className="w-fit" onClick={() => setLoadGeometry(true)}>
            Look up distances
          </Button>
        ) : geometry.isPending ? (
          <span className="flex items-center gap-2 text-muted-foreground"><Spinner /> Querying Horizons…</span>
        ) : geometry.isError ? (
          <span className="text-destructive">{geometry.error.message}</span>
        ) : (
          <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">
            <Row label="rₕ (Sun–comet)">{geometry.data.rHelAu.toFixed(4)} au</Row>
            <Row label="Δ (observer–comet)">{geometry.data.deltaAu.toFixed(4)} au</Row>
            <Row label="Reference">{geometry.data.center} · MJD {geometry.data.mjd.toFixed(4)} · {geometry.data.source}</Row>
            <Row label="Note">Distances are geocentric. The comet position in the image uses only comet_ra/dec from the list.</Row>
          </dl>
        )}
      </Section>

      <Section title="⑤ References">
        <ul className="grid gap-1.5">
          {PAPERS.map((p) => (
            <li key={p.id}>
              <ExtLink href={p.url}>{p.shortName}</ExtLink> — {p.title}
              <div className="text-muted-foreground">{p.version} · {p.data}</div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="⑥ Limitations">
        <ul className="list-disc pl-4 text-muted-foreground">
          {LIMITATIONS.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
