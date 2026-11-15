"use client";

import { useMemo, useState } from "react";
import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/app/_i18n/i18n-provider";
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
  const t = useT();
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

  if (!selected || !predicted) return <p className="pt-2 text-sm text-muted-foreground">{t("nim.selectObject")}</p>;
  if (search.isPending) return <p className="flex items-center gap-2 pt-2 text-sm text-muted-foreground"><Spinner /> {t("nim.searchingModel")}</p>;
  if (search.isError) return <p className="pt-2 text-sm text-destructive">{search.error.message}</p>;
  if (!exposures.length) return <p className="pt-2 text-sm text-muted-foreground">{t("nim.noExposure", { name: selected.name })}</p>;

  return (
    <div className="grid gap-3 pt-2 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Label className="text-xs">{t("fpl.detector")}</Label>
        <NativeSelect size="sm" value={detector} onChange={(e) => { setDetectorChoice(e.target.value); setPickedKey(null); }}>
          {dets.map((d) => (
            <NativeSelectOption key={d} value={d}>{t("fpl.detectorVisits", { detector: d, n: visitsOf(exposures.filter((e) => e.detector === d)).length })}</NativeSelectOption>
          ))}
        </NativeSelect>
        <span className="text-muted-foreground">{t("nim.exposuresFound", { n: exposures.length })}</span>
      </div>
      {visits.length === 1 && (
        <Alert>
          <AlertCircleIcon />
          <AlertDescription>{t("nim.oneVisit")}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-1 text-xs">
        {visits.map((v, i) => (
          <div key={v[0].key} className="flex flex-wrap items-center gap-1">
            <span className="w-36 text-muted-foreground">{t("fpl.visitDate", { n: i + 1, date: mjdIso(v[0].tStart).slice(0, 10) })}</span>
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
          <div className="flex aspect-square items-center justify-center gap-2 rounded-md border border-dashed text-xs text-muted-foreground"><Spinner /> {t("nim.readingExposure")}</div>
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
            {frames[0]?.error?.message ?? t("nim.notLoaded")}
            {frames[0] && <Button size="xs" variant="outline" onClick={() => frames[0].refetch()}>{t("fpl.retry")}</Button>}
          </div>
        )}
        <dl className="grid content-start gap-x-3 gap-y-1 text-xs [grid-template-columns:auto_1fr]">
          <dt className="text-muted-foreground">{t("nim.exposure")}</dt>
          <dd className="font-mono">{picked?.obsId} {picked?.detector}</dd>
          <dt className="text-muted-foreground">{t("nim.observed")}</dt>
          <dd className="font-mono">{picked && mjdIso((picked.tStart + picked.tEnd) / 2)}</dd>
          <dt className="text-muted-foreground">{t("nim.wavelengthHere")}</dt>
          <dd className="font-mono">{cmp?.wavelengthUm != null ? `${cmp.wavelengthUm.toFixed(3)} µm` : "—"}</dd>
          <dt className="text-muted-foreground">{t("nim.modelPosition")}</dt>
          <dd className="font-mono">{atExposure && `${atExposure.ra.toFixed(5)}, ${atExposure.dec.toFixed(5)}`} <span className="text-sky-500">{t("nim.blueCircle")}</span></dd>
          <dt className="text-muted-foreground">{t("nim.signalAtModel")}</dt>
          <dd>
            {cmp ? (cmp.snr != null ? t("nim.snrInAperture", { snr: cmp.snr.toFixed(1) }) : t("nim.notMeasurable")) : "—"}
            {cmp && cmp.snr != null && cmp.coreExcludedPixels > 0 && (
              <span className="block text-amber-600 dark:text-amber-400">
                {t("nim.centreExcluded", { n: cmp.coreExcludedPixels, flags: cmp.coreExcludedFlags.join(", ") || t("nim.noValidData") })}
              </span>
            )}
          </dd>
          <dt className="text-muted-foreground">{t("nim.measuredCentroid")}</dt>
          <dd>
            {cmp?.measured
              ? t("nim.centroidOffset", { offset: cmp.offsetArcsec!.toFixed(1), n: cmp.usablePixels })
              : t("nim.noCentroid")}
          </dd>
        </dl>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("nim.footnote", { parallax: selected.parallax.value.toFixed(0), pixel: (cmp?.pixelScaleArcsec ?? 6.15).toFixed(1) })}
      </p>
    </div>
  );
}
