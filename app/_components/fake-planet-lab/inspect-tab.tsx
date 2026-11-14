"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircleIcon, StarIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CHECK_PARAMS, decodeBits, type NativeFrame } from "@/app/_lib/fpl/checks";
import { FLAG_CATEGORIES } from "@/app/_lib/fpl/flags";
import type { SkyGrid } from "@/app/_lib/sky/types";
import { CheckPanel } from "./check-panel";
import { mjdIso, useFpl, visitsOf } from "./fpl-state";
import { LayeredCanvas, type PixelProbe } from "./layered-canvas";
import { sharedDisplayRange, toNative, useFrames } from "./use-fpl-data";

const GRID_FOV_ARCMIN = 4;
const GRID_N = 160;

function ObservationPicker() {
  const { search, detector, setDetector, selected, toggleExposure } = useFpl();
  const exposures = search.data?.exposures ?? [];
  const dets = [...new Set(exposures.map((e) => e.detector))].sort();
  const visits = visitsOf(exposures.filter((e) => e.detector === detector));
  if (search.isPending) return <p className="flex items-center gap-2 text-xs text-muted-foreground"><Spinner className="size-3" /> Searching SPHEREx DR1 observations at this position…</p>;
  if (search.isError) return <p className="text-xs text-destructive">Search failed: {search.error.message}</p>;
  if (!exposures.length) return <p className="text-xs text-muted-foreground">No SPHEREx DR1 observation covers this position.</p>;
  return (
    <div className="grid gap-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-xs">Detector</Label>
        <NativeSelect size="sm" value={detector} onChange={(e) => setDetector(e.target.value)}>
          {dets.map((d) => (
            <NativeSelectOption key={d} value={d}>
              {d} · {visitsOf(exposures.filter((e) => e.detector === d)).length} visit(s)
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <span className="text-muted-foreground">Pick up to 4 exposures. The first one (★) is measured; the others are comparisons.</span>
      </div>
      {visits.length === 1 && (
        <Alert>
          <AlertCircleIcon />
          <AlertDescription>
            Additional analysis needed: only one SPHEREx visit covers this position, so SPHEREx visits cannot be compared with each other here. Exposures within the visit are minutes apart and at different wavelengths.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-1">
        {visits.map((v, vi) => (
          <div key={v[0].key} className="flex flex-wrap items-center gap-1">
            <span className="w-40 shrink-0 text-muted-foreground">
              Visit {vi + 1} · {mjdIso(v[0].tStart).slice(0, 10)}
            </span>
            {v.map((e) => {
              const idx = selected.findIndex((s) => s.key === e.key);
              return (
                <button
                  key={e.key}
                  type="button"
                  onClick={() => toggleExposure(e)}
                  title={`${e.obsId} ${e.detector} · ${mjdIso(e.tStart)} · detector range ${e.emMinUm.toFixed(2)}–${e.emMaxUm.toFixed(2)} µm`}
                  className={`rounded border px-1.5 py-0.5 font-mono ${idx === 0 ? "border-primary bg-primary text-primary-foreground" : idx > 0 ? "border-primary bg-primary/15" : "hover:bg-muted"}`}
                >
                  {idx === 0 && "★ "}
                  {mjdIso(e.tStart).slice(11, 16)}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function InspectTab() {
  const { target, selected, setPrimary, candidate, setCandidate, layers, setLayer, opacity, setOpacity } = useFpl();
  const results = useFrames(selected, target.ra, target.dec);
  const [mode, setMode] = useState<"side" | "blink">("side");
  const [blinkIdx, setBlinkIdx] = useState(0);
  const [probe, setProbe] = useState<PixelProbe | null>(null);
  const grid = useMemo<SkyGrid>(() => ({ ra: target.ra, dec: target.dec, fovArcmin: GRID_FOV_ARCMIN, n: GRID_N }), [target]);

  const frames = results.map((r) => (r.data ? toNative(r.data) : undefined));
  const loaded = frames.filter((f): f is NativeFrame => Boolean(f));
  // Checks need the primary first.
  const forChecks = frames[0] ? loaded : [];

  useEffect(() => {
    if (mode !== "blink" || loaded.length < 2) return;
    const t = setInterval(() => setBlinkIdx((i) => (i + 1) % loaded.length), 900);
    return () => clearInterval(t);
  }, [mode, loaded.length]);

  const primaryPayload = results[0]?.data;
  const primary = useMemo(() => (primaryPayload ? toNative(primaryPayload) : undefined), [primaryPayload]);
  const primaryBits = useMemo(() => (primary ? decodeBits(primary.payload.flagBits) : []), [primary]);
  const layerCounts = useMemo(() => {
    const out: Record<string, number> = {};
    if (!primary) return out;
    for (const c of FLAG_CATEGORIES) {
      const m = primaryBits.filter((b) => b.category.id === c.id).reduce((a, b) => a | b.mask, 0) >>> 0;
      let n = 0;
      for (const v of primary.flags) if ((v >>> 0) & m) n++;
      out[c.id] = n;
    }
    return out;
  }, [primary, primaryBits]);
  const loadedKey = loaded.map((f) => f.payload.key).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute only when the set of loaded frames changes
  const displayRange = useMemo(() => sharedDisplayRange(loaded), [loadedKey]);
  const apertureArcsec = primary ? CHECK_PARAMS.apertureRadiusPx * Math.sqrt(Math.abs(primary.payload.wcs.cd[0][0] * primary.payload.wcs.cd[1][1] - primary.payload.wcs.cd[0][1] * primary.payload.wcs.cd[1][0])) * 3600 : 12;

  const renderFrame = (i: number) => {
    const r = results[i];
    const e = selected[i];
    const f = frames[i];
    if (!e) return null;
    const tag = `${i === 0 ? "★ " : ""}${e.detector} · ${mjdIso(e.tStart)}`;
    if (r.isPending) {
      return (
        <div key={e.key} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-md border border-dashed text-xs text-muted-foreground">
          <Spinner /> Reading {e.obsId} {e.detector} (byte ranges of the original file)…
        </div>
      );
    }
    if (!f) {
      return (
        <div key={e.key} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-md border border-dashed p-3 text-center text-xs text-destructive">
          {r.error?.message ?? "Failed"}
          <Button size="xs" variant="outline" onClick={() => r.refetch()}>Retry</Button>
        </div>
      );
    }
    return (
      <div key={e.key} className="grid gap-1">
        <LayeredCanvas
          frame={f}
          grid={grid}
          layers={layers}
          opacity={opacity}
          candidate={candidate}
          apertureArcsec={apertureArcsec}
          range={displayRange}
          label={tag}
          onPick={setCandidate}
          onProbe={setProbe}
        />
        {i > 0 && (
          <Button size="xs" variant="ghost" className="w-fit" onClick={() => setPrimary(e.key)}>
            <StarIcon /> Make primary
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="grid gap-3 pt-2">
      <ObservationPicker />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid content-start gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <ToggleGroup variant="outline" size="sm" spacing={0} value={[mode]} onValueChange={(v) => v[0] && setMode(v[0] as "side" | "blink")}>
              <ToggleGroupItem value="side">Side by side</ToggleGroupItem>
              <ToggleGroupItem value="blink" disabled={loaded.length < 2}>Blink</ToggleGroupItem>
            </ToggleGroup>
            <span className="text-xs text-muted-foreground">Same sky grid ({GRID_FOV_ARCMIN}′, north up) and one shared stretch on IMAGE − ZODI. Pixels are original values, not interpolated.</span>
          </div>
          {mode === "side" ? (
            <div className={`grid gap-2 ${selected.length > 1 ? "sm:grid-cols-2" : "max-w-md"}`}>{selected.map((_, i) => renderFrame(i))}</div>
          ) : (
            <div className="max-w-xl">{renderFrame(frames.findIndex((f) => f === loaded[blinkIdx % loaded.length]))}</div>
          )}
          <p className="min-h-4 font-mono text-[11px] text-muted-foreground">
            {probe
              ? `RA ${probe.ra.toFixed(5)} Dec ${probe.dec.toFixed(5)} · pixel (${probe.x}, ${probe.y}) detector (${probe.detX}, ${probe.detY}) · ${probe.value.toFixed(3)} ± ${probe.sigma.toFixed(3)} MJy/sr · FLAGS ${probe.flagValue}${probe.flagNames.length ? ` = ${probe.flagNames.join(" + ")}` : ""}`
              : "Hover an image to read the original pixel value, its uncertainty and its decoded flags."}
          </p>

          <div className="grid gap-2 rounded-md border p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">Quality layers (from the FLAGS header of ★)</span>
              <div className="flex w-48 items-center gap-2">
                <span className="text-muted-foreground">Opacity</span>
                <Slider min={0.1} max={0.9} step={0.05} value={[opacity]} onValueChange={(v) => setOpacity(Array.isArray(v) ? v[0] : v)} />
              </div>
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              {FLAG_CATEGORIES.map((c) => (
                <Label key={c.id} className="flex items-center gap-2 font-normal" title={c.explain}>
                  <Switch size="sm" checked={Boolean(layers[c.id])} onCheckedChange={(v) => setLayer(c.id, v)} />
                  <span className="size-2.5 rounded-sm" style={{ background: `rgb(${c.color})` }} />
                  {c.label}
                  <span className="ml-auto font-mono text-muted-foreground">{layerCounts[c.id] ?? 0} px</span>
                </Label>
              ))}
            </div>
            <p className="text-muted-foreground">Turn layers off to see the signal underneath — nothing is masked out of the image. Only the first matching layer tints a pixel; hover for all bits.</p>
          </div>
        </div>
        <div className="lg:max-h-[70dvh] lg:overflow-y-auto">
          <CheckPanel frames={forChecks} />
        </div>
      </div>
    </div>
  );
}
