"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import { MAX_FOV, MIN_FOV } from "./constants";
import { viewUrl } from "./sky-selection";
import type { SkyLayers } from "./sky-view";
import { getView, useView } from "./view-store";

const LAYER_LABELS: Record<keyof SkyLayers, string> = {
  pins: "Test target pins",
  constellations: "Constellation lines",
  grid: "Coordinate grid",
};

type SkyControlsProps = {
  layers: SkyLayers;
  onLayersChange: (layers: SkyLayers) => void;
  /** Multiplies the field of view (below 1 zooms in), animated. */
  onZoom: (factor: number) => void;
};

/** Zoom buttons, the current field of view, overlay switches and a link to this view. Basic layout only. */
export function SkyControls({ layers, onLayersChange, onZoom }: SkyControlsProps) {
  const view = useView();
  return (
    <div className="dark grid w-48 gap-2 rounded-md border border-white/10 bg-black/70 p-2 text-xs text-foreground backdrop-blur-sm">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Zoom in"
          disabled={!view || view.fov <= MIN_FOV * 1.01}
          onClick={() => onZoom(1 / 2)}
        >
          <PlusIcon />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Zoom out"
          disabled={!view || view.fov >= MAX_FOV * 0.99}
          onClick={() => onZoom(2)}
        >
          <MinusIcon />
        </Button>
        <span className="ml-auto font-mono" aria-label="Field of view">
          {view ? formatFov(view.fov) : "—"}
        </span>
      </div>
      <fieldset className="grid gap-1">
        <legend className="sr-only">Overlays</legend>
        {(Object.keys(LAYER_LABELS) as (keyof SkyLayers)[]).map((key) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={layers[key]}
              onChange={(event) => onLayersChange({ ...layers, [key]: event.target.checked })}
            />
            {LAYER_LABELS[key]}
          </label>
        ))}
      </fieldset>
      <CopyViewLinkButton />
    </div>
  );
}

function CopyViewLinkButton() {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <Button
      variant="secondary"
      size="sm"
      className={cn(state === "failed" && "text-amber-200")}
      onClick={() => {
        const view = getView();
        if (!view) return;
        navigator.clipboard
          .writeText(new URL(viewUrl(view), window.location.origin).toString())
          .then(() => setState("copied"), () => setState("failed"));
      }}
    >
      {state === "copied" ? "Link copied" : state === "failed" ? "Copy failed" : "Copy link to this view"}
    </Button>
  );
}

/** Field of view in degrees, arcminutes or arcseconds, whichever reads best. */
export function formatFov(fov: number) {
  if (fov >= 1) return `${fov.toFixed(fov >= 10 ? 0 : 1)}° field`;
  const arcmin = fov * 60;
  if (arcmin >= 1) return `${arcmin.toFixed(arcmin >= 10 ? 0 : 1)}′ field`;
  return `${(arcmin * 60).toFixed(0)}″ field`;
}
