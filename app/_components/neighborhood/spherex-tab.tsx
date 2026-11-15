"use client";

import { useMemo, useState } from "react";
import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { CHECK_PARAMS } from "@/app/_lib/fpl/checks";
import type { FplExposure } from "@/app/_lib/fpl/types";
import { compareModelWithImage } from "@/app/_lib/nim/measure";
import { mjdToDecimalYear, skyAt } from "@/app/_lib/nim/motion";
import type { SkyGrid } from "@/app/_lib/sky/types";
import { LayeredCanvas } from "../fake-planet-lab/layered-canvas";
import { sharedDisplayRange, toNative, useFrames, type useSpherexSearch } from "../fake-planet-lab/use-fpl-data";
import { mjdIso, visitsOf } from "../fake-planet-lab/fpl-state";
import { useNim } from "./nim-state";

/**
 * Default detector D6 (4.4–5.0 µm): these neighbours are so bright that the short-wavelength detectors
 * saturate their cores (checked on Barnard's Star and Ross 128 in D2), and brown dwarfs peak here anyway.
 */
const DEFAULT_DETECTOR = "D6";

export function SpherexTab({ search, predicted }: { search: ReturnType<typeof useSpherexSearch>; predicted: { ra: number; dec: number } | null }) {
  const { selected, models } = useNim();
  const [detectorChoice, setDetectorChoice] = useState<string | null>(null);
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const exposures = useMemo(() => search.data?.exposures ?? [], [search.data]);
  const m = selected ? models.get(selected.id) : undefined;
  const dets = [...new Set(exposures.map((e) => e.detector))].sort();
  const detector = detectorChoice && dets.includes(detectorChoice) ? detectorChoice : dets.includes(DEFAULT_DETECTOR) ? DEFAULT_DETECTOR : dets[0];
  const visits = visitsOf(exposures.filter((e) => e.detector === detector));
  const picked: FplExposure | undefined = exposures.find((e) => e.key === pickedKey && e.detector === detector) ?? visits[0]?.[Math.floor(visits[0].length / 2)];

  // Model position at the exposure's own time; the cutout is centred there.
  const atExposure = m && picked ? skyAt(m, mjdToDecimalYear((picked.tStart + picked.tEnd) / 2)) : null;
  const frames = useFrames(picked ? [picked] : [], atExposure?.ra ?? 0, atExposure?.dec ?? 0);
  const frame = frames[0]?.data ? toNative(frames[0].data) : null;
  const grid = useMemo<SkyGrid | null>(() => (atExposure ? { ra: atExposure.ra, dec: atExposure.dec, fovArcmin: 3, n: 150 } : null), [atExposure?.ra, atExposure?.dec]); // eslint-disable-line react-hooks/exhaustive-deps
  const range = useMemo(() => (frame ? sharedDisplayRange([frame]) : { lo: 0, hi: 1 }), [frame]);
  const cmp = useMemo(() => (frame && atExposure ? compareModelWithImage(frame, atExposure.ra, atExposure.dec) : null), [frame, atExposure?.ra, atExposure?.dec]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!selected || !predicted) return <p className="pt-2 text-sm text-muted-foreground">Select an object.</p>;
  if (search.isPending) return <p className="flex items-center gap-2 pt-2 text-sm text-muted-foreground"><Spinner /> Searching SPHEREx DR1 at the model position for 2025.8…</p>;
  if (search.isError) return <p className="pt-2 text-sm text-destructive">{search.error.message}</p>;
  if (!exposures.length) return <p className="pt-2 text-sm text-muted-foreground">No SPHEREx DR1 exposure covers the model position of {selected.name}.</p>;

  return (
    <div className="grid gap-3 pt-2 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Label className="text-xs">Detector</Label>
        <NativeSelect size="sm" value={detector} onChange={(e) => { setDetectorChoice(e.target.value); setPickedKey(null); }}>
          {dets.map((d) => (
            <NativeSelectOption key={d} value={d}>{d} · {visitsOf(exposures.filter((e) => e.detector === d)).length} visit(s)</NativeSelectOption>
          ))}
        </NativeSelect>
        <span className="text-muted-foreground">{exposures.length} exposures found at the 2025.8 model position (DR1). D6 is the default: shorter-wavelength detectors usually saturate on these bright neighbours.</span>
      </div>
      {visits.length === 1 && (
        <Alert>
          <AlertCircleIcon />
          <AlertDescription>Additional analysis needed: one SPHEREx visit only. Compare with the model path and with Sky Time Machine (2MASS/WISE) for a longer baseline.</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-1 text-xs">
        {visits.map((v, i) => (
          <div key={v[0].key} className="flex flex-wrap items-center gap-1">
            <span className="w-36 text-muted-foreground">Visit {i + 1} · {mjdIso(v[0].tStart).slice(0, 10)}</span>
            {v.map((e) => (
              <button
                key={e.key}
                type="button"
                onClick={() => setPickedKey(e.key)}
                className={`rounded border px-1.5 py-0.5 font-mono ${picked?.key === e.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {mjdIso(e.tStart).slice(11, 16)}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,22rem)_1fr]">
        {frames[0]?.isPending ? (
          <div className="flex aspect-square items-center justify-center gap-2 rounded-md border border-dashed text-xs text-muted-foreground"><Spinner /> Reading the exposure…</div>
        ) : frame && grid && atExposure ? (
          <LayeredCanvas
            frame={frame}
            grid={grid}
            layers={{}}
            opacity={0}
            candidate={atExposure}
            apertureArcsec={CHECK_PARAMS.apertureRadiusPx * (cmp?.pixelScaleArcsec ?? 6.15)}
            range={range}
            label={`${picked?.detector} · ${picked ? mjdIso(picked.tStart) : ""}`}
            markers={cmp?.measured ? [{ ra: cmp.measured.ra, dec: cmp.measured.dec, color: "#facc15", shape: "plus" }] : []}
          />
        ) : (
          <div className="flex aspect-square flex-col items-center justify-center gap-2 rounded-md border border-dashed text-xs text-destructive">
            {frames[0]?.error?.message ?? "Not loaded"}
            {frames[0] && <Button size="xs" variant="outline" onClick={() => frames[0].refetch()}>Retry</Button>}
          </div>
        )}
        <dl className="grid content-start gap-x-3 gap-y-1 text-xs [grid-template-columns:auto_1fr]">
          <dt className="text-muted-foreground">Exposure</dt>
          <dd className="font-mono">{picked?.obsId} {picked?.detector}</dd>
          <dt className="text-muted-foreground">Observed</dt>
          <dd className="font-mono">{picked && mjdIso((picked.tStart + picked.tEnd) / 2)}</dd>
          <dt className="text-muted-foreground">Wavelength here</dt>
          <dd className="font-mono">{cmp?.wavelengthUm != null ? `${cmp.wavelengthUm.toFixed(3)} µm` : "—"}</dd>
          <dt className="text-muted-foreground">Model position</dt>
          <dd className="font-mono">{atExposure && `${atExposure.ra.toFixed(5)}, ${atExposure.dec.toFixed(5)}`} <span className="text-sky-500">(blue circle)</span></dd>
          <dt className="text-muted-foreground">Signal at model position</dt>
          <dd>
            {cmp ? (cmp.snr != null ? `S/N ${cmp.snr.toFixed(1)} in a 2-px aperture` : "Not measurable (pixels excluded, e.g. saturated)") : "—"}
            {cmp && cmp.snr != null && cmp.coreExcludedPixels > 0 && (
              <span className="block text-amber-600 dark:text-amber-400">
                {cmp.coreExcludedPixels} centre pixel(s) excluded ({cmp.coreExcludedFlags.join(", ") || "no valid data"}): the brightness is a lower limit.
              </span>
            )}
          </dd>
          <dt className="text-muted-foreground">Measured centroid</dt>
          <dd>
            {cmp?.measured
              ? `${cmp.offsetArcsec!.toFixed(1)}″ from the model (yellow +), from ${cmp.usablePixels} pixels above 2σ`
              : "No centroid: too few usable pixels above 2σ near the model position"}
          </dd>
        </dl>
      </div>
      <p className="text-xs text-muted-foreground">
        The model gives the barycentric direction. SPHEREx observes from Earth orbit, so the true position also shifts by up to the parallax ({selected.parallax.value.toFixed(0)} mas) — far below the {(cmp?.pixelScaleArcsec ?? 6.15).toFixed(1)}″ pixels.
        A signal at the model position is not proof that this object was detected: other sources can sit there, and bright stars saturate (see Fake Planet Lab).
      </p>
    </div>
  );
}
