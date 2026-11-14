"use client";

import { InfoIcon, LayersIcon, LocateFixedIcon, MaximizeIcon, MinimizeIcon, MinusIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import type { ReactElement, ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "cn";
import { Keycap } from "../site/keycap";
import { MAX_FOV, MIN_FOV } from "./constants";
import type { SkyOverlays, StatusKey } from "./overlays";
import { MOVEMENT_CANDIDATES } from "./review-queue";
import { MARK_LABELS, StatusMark } from "./status-mark";
import { useView } from "./view-store";

const toolClass =
  "grid size-[29px] place-items-center rounded-sm text-paper/90 transition-colors duration-300 hover:bg-paper/10 hover:text-paper disabled:opacity-35 disabled:hover:bg-transparent aria-expanded:outline aria-expanded:outline-1 aria-expanded:outline-paper/50 [&_svg]:size-[17px] [&_svg]:stroke-[1.25]";

/** Tooltip for a tool: its name and, when it has one, its key (Figma design I: "Tooltip with key"). */
function ToolTip({ label, keyName, children }: { label: string; keyName?: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent
        side="left"
        sideOffset={8}
        className="flex items-center gap-3 rounded-sm bg-ink/90 px-2.5 py-1 font-ui text-[12.5px] text-bone [&>svg]:hidden"
      >
        {label}
        {keyName && <Keycap>{keyName}</Keycap>}
      </TooltipContent>
    </Tooltip>
  );
}

type SkyToolsProps = {
  /** Multiplies the field of view (below 1 zooms in), animated. */
  onZoom: (factor: number) => void;
  /** Flies back to the first view. */
  onHome: () => void;
  fullscreen: boolean;
  onFullscreen: () => void;
  /** Content of the "Show on sky" panel the layers tool opens. */
  layersPanel: ReactNode;
  layersOpen: boolean;
  onLayersOpenChange: (open: boolean) => void;
};

/** The tool column on the sky's right edge (Eyes on the Solar System style): line icons, no fill. */
export function SkyTools({
  onZoom,
  onHome,
  fullscreen,
  onFullscreen,
  layersPanel,
  layersOpen,
  onLayersOpenChange,
}: SkyToolsProps) {
  const view = useView();
  return (
    <div role="toolbar" aria-orientation="vertical" aria-label="Sky tools" className="flex flex-col gap-[5px]">
      <ToolTip label="About this site">
        <Link href="/about" className={toolClass} aria-label="About this site">
          <InfoIcon />
        </Link>
      </ToolTip>
      <Popover open={layersOpen} onOpenChange={onLayersOpenChange}>
        <ToolTip label="Show on sky" keyName="L">
          <PopoverTrigger className={toolClass} aria-label="Show on sky">
            <LayersIcon />
          </PopoverTrigger>
        </ToolTip>
        <PopoverContent
          side="left"
          align="center"
          sideOffset={12}
          className="dark w-[300px] gap-0 rounded-sm border-0 bg-ink/90 p-0 font-ui text-bone ring-0"
        >
          {layersPanel}
        </PopoverContent>
      </Popover>
      <ToolTip label="Zoom in" keyName="+">
        <button
          type="button"
          className={toolClass}
          aria-label="Zoom in"
          disabled={!view || view.fov <= MIN_FOV * 1.01}
          onClick={() => onZoom(1 / 2)}
        >
          <PlusIcon />
        </button>
      </ToolTip>
      <ToolTip label="Zoom out" keyName="−">
        <button
          type="button"
          className={toolClass}
          aria-label="Zoom out"
          disabled={!view || view.fov >= MAX_FOV * 0.99}
          onClick={() => onZoom(2)}
        >
          <MinusIcon />
        </button>
      </ToolTip>
      <ToolTip label="Back to the first view">
        <button type="button" className={toolClass} aria-label="Back to the first view" onClick={onHome}>
          <LocateFixedIcon />
        </button>
      </ToolTip>
      <ToolTip label={fullscreen ? "Leave full screen" : "Full screen, frame off"} keyName="F">
        <button
          type="button"
          className={toolClass}
          aria-label={fullscreen ? "Leave full screen" : "Full screen"}
          aria-pressed={fullscreen}
          onClick={onFullscreen}
        >
          {fullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
        </button>
      </ToolTip>
    </div>
  );
}

/** A square on/off switch (Figma design I), not the rounded pill. */
export function SkySwitch({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-4 w-7 shrink-0 rounded-sm border transition-colors duration-300",
        checked ? "border-paper bg-paper" : "border-smoke bg-transparent",
        className,
      )}
    >
      <span
        className={cn(
          "absolute top-[1px] size-3 rounded-[1px] transition-[left,background-color] duration-300",
          checked ? "left-[13px] bg-ink" : "left-[1px] bg-smoke",
        )}
      />
    </button>
  );
}

const STATUS_KEYS: StatusKey[] = ["noteworthy", "needs-ratings", "recommended", "known"];

const OTHER_LAYERS: { key: "opened" | "pins" | "constellations" | "grid"; label: string }[] = [
  { key: "opened", label: "Places you opened" },
  { key: "pins", label: "Test targets" },
  { key: "constellations", label: "Constellation lines" },
  { key: "grid", label: "Coordinate grid" },
];

function Row({ children, dim }: { children: ReactNode; dim?: boolean }) {
  return (
    <label className={cn("flex items-center justify-between gap-3 text-[13px]", dim && "opacity-40")}>{children}</label>
  );
}

/** "Show on sky" (decision #40): candidate layers first, then the other overlays. */
export function ShowOnSky({
  overlays,
  onChange,
  onClose,
}: {
  overlays: SkyOverlays;
  onChange: (overlays: SkyOverlays) => void;
  onClose: () => void;
}) {
  const off = !overlays.candidates;
  return (
    <div>
      <div className="flex items-center justify-between border-b border-rule px-[18px] py-3.5">
        <p className="text-sm font-medium text-paper">Show on sky</p>
        <button type="button" className="text-xs text-ash hover:text-paper" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="grid gap-3 border-b border-rule px-[18px] py-3.5">
        <Row>
          <span className="flex items-center gap-2">
            Candidates
            <Keycap>C</Keycap>
          </span>
          <SkySwitch
            checked={overlays.candidates}
            label="Candidates"
            onChange={(candidates) => onChange({ ...overlays, candidates })}
          />
        </Row>
        <div className="grid gap-2.5 pl-3">
          <Row dim={off}>
            Density cells
            <SkySwitch
              checked={overlays.density}
              label="Density cells"
              onChange={(density) => onChange({ ...overlays, density })}
            />
          </Row>
          <Row dim={off}>
            Status marks
            <SkySwitch checked={overlays.marks} label="Status marks" onChange={(marks) => onChange({ ...overlays, marks })} />
          </Row>
          <div className={cn("grid grid-cols-2 gap-x-3 gap-y-2 pt-0.5", (off || !overlays.marks) && "opacity-40")}>
            {STATUS_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2 text-xs text-bone">
                <input
                  type="checkbox"
                  className="size-3.5 accent-paper"
                  checked={overlays.statuses[key]}
                  onChange={(event) =>
                    onChange({ ...overlays, statuses: { ...overlays.statuses, [key]: event.target.checked } })
                  }
                />
                <StatusMark kind={key} className="size-2.5" />
                {MARK_LABELS[key]}
              </label>
            ))}
          </div>
          {MOVEMENT_CANDIDATES.length === 0 && <p className="text-xs text-smoke">No candidates yet, so nothing is drawn.</p>}
        </div>
      </div>
      <div className="grid gap-3 px-[18px] py-3.5">
        {OTHER_LAYERS.map(({ key, label }) => (
          <Row key={key}>
            {label}
            <SkySwitch checked={overlays[key]} label={label} onChange={(checked) => onChange({ ...overlays, [key]: checked })} />
          </Row>
        ))}
      </div>
    </div>
  );
}

/** Field of view in degrees, arcminutes or arcseconds, whichever reads best. */
export function formatFov(fov: number) {
  if (fov >= 1) return `${fov.toFixed(fov >= 10 ? 0 : 1)}°`;
  const arcmin = fov * 60;
  if (arcmin >= 1) return `${arcmin.toFixed(arcmin >= 10 ? 0 : 1)}′`;
  return `${(arcmin * 60).toFixed(0)}″`;
}
