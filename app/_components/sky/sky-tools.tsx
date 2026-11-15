"use client";

import { InfoIcon, LayersIcon, LocateFixedIcon, MaximizeIcon, MinimizeIcon, MinusIcon, PlusIcon, ScanSearchIcon } from "lucide-react";
import { type ReactElement, type ReactNode, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "cn";
import { Keycap } from "../site/keycap";
import { MAX_FOV, MIN_FOV } from "./constants";
import type { SkyOverlays, StatusKey } from "./overlays";
import { GROUPS_FOV } from "./candidate-layer";
import { useCandidates } from "./candidates-context";
import { MARK_LABELS, StatusMark } from "./status-mark";
import { angularDistance } from "./sky-coordinates";
import { useView } from "./view-store";
import { ViewInfo } from "./view-info";

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
        className="flex items-center gap-3 rounded-sm bg-ink/90 px-2.5 py-1 font-ui text-[12.5px] text-bone [&>[data-side]]:hidden"
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
  /** Candidates switched off: a small dot on the layers tool (Figma "I · Explore, candidates hidden"). */
  candidatesOff: boolean;
  /** The star guide (stars in the view that Gaia measured moving) is on. */
  starGuide: boolean;
  onStarGuide: () => void;
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
  candidatesOff,
  starGuide,
  onStarGuide,
}: SkyToolsProps) {
  const view = useView();
  const [infoOpen, setInfoOpen] = useState(false);
  return (
    <div role="toolbar" aria-orientation="vertical" aria-label="Sky tools" className="flex flex-col gap-[5px]">
      {/* Figma "I · This view": what is on screen now. The About page itself is the header tab. */}
      <Popover open={infoOpen} onOpenChange={setInfoOpen}>
        <ToolTip label="This view">
          <PopoverTrigger className={toolClass} aria-label="This view">
            <InfoIcon />
          </PopoverTrigger>
        </ToolTip>
        <PopoverContent
          side="left"
          align="start"
          sideOffset={26}
          alignOffset={-74}
          className="dark w-[272px] gap-0 rounded-[2px] border-0 bg-ink/88 p-0 font-ui text-bone ring-0"
        >
          <ViewInfo onClose={() => setInfoOpen(false)} />
        </PopoverContent>
      </Popover>
      <Popover open={layersOpen} onOpenChange={onLayersOpenChange}>
        <ToolTip label="Show on sky" keyName="L">
          <PopoverTrigger className={cn(toolClass, "relative")} aria-label={candidatesOff ? "Show on sky, candidates hidden" : "Show on sky"}>
            <LayersIcon />
            {candidatesOff && <span aria-hidden className="absolute top-[3px] right-[3px] size-[5px] rounded-full bg-ash" />}
          </PopoverTrigger>
        </ToolTip>
        {/* Figma: 272 wide, 26px left of the tool, its top 74px above the tool's top. */}
        <PopoverContent
          side="left"
          align="start"
          sideOffset={26}
          alignOffset={-74}
          className="dark w-[272px] gap-0 rounded-[2px] border-0 bg-ink/88 p-0 font-ui text-bone ring-0"
        >
          {layersPanel}
        </PopoverContent>
      </Popover>
      <ToolTip label={starGuide ? "Turn off the star guide" : "Star guide: stars that move here"}>
        <button
          type="button"
          className={cn(toolClass, starGuide && "bg-paper/15 text-paper")}
          aria-label="Star guide"
          aria-pressed={starGuide}
          onClick={onStarGuide}
        >
          <ScanSearchIcon />
        </button>
      </ToolTip>
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

/** `sub` rows sit indented under the row above and dim while it is off (Figma "Constellation names"). */
const OTHER_LAYERS: {
  key: "opened" | "pins" | "constellations" | "constellationNames" | "grid";
  label: string;
  sub?: "constellations";
}[] = [
  { key: "opened", label: "Places you opened" },
  { key: "pins", label: "Test targets" },
  { key: "constellations", label: "Constellation lines" },
  { key: "constellationNames", label: "Constellation names", sub: "constellations" },
  { key: "grid", label: "Coordinate grid" },
];

function Row({ children, dim, className }: { children: ReactNode; dim?: boolean; className?: string }) {
  return (
    <label
      className={cn("flex h-[26px] items-center justify-between gap-3 text-[13px] text-bone", dim && "opacity-40", className)}
    >
      {children}
    </label>
  );
}

/** "Show on sky" (decision #40), laid out as Figma "I · Explore, layers panel open". */
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
  const candidates = useCandidates();
  const view = useView();
  const inView = view
    ? candidates.filter((candidate) => angularDistance(view, candidate) <= view.fov / 2).length
    : 0;
  return (
    <div>
      <div className="flex h-[46px] items-center justify-between border-b border-rule px-[18px]">
        <p className="text-sm font-medium text-paper">Show on sky</p>
        <button type="button" className="text-xs text-ash hover:text-paper" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="border-b border-rule px-[18px] pt-3 pb-2.5">
        <label className="flex items-start justify-between gap-3">
          <span>
            <span className="block text-sm font-medium text-paper">Candidates</span>
            <span className="block text-[11.5px] text-ash">
              {candidates.length === 0
                ? "No candidates yet, so nothing is drawn"
                : view && view.fov > GROUPS_FOV
                  ? `Shown at ${GROUPS_FOV}° and narrower`
                  : `${inView.toLocaleString("en-US")} in view`}
            </span>
          </span>
          <SkySwitch
            className="mt-0.5"
            checked={overlays.candidates}
            label="Candidates"
            onChange={(candidates) => onChange({ ...overlays, candidates })}
          />
        </label>
        <div className="mt-2 pl-4">
          <Row dim={off} className="h-7">
            Status marks
            <SkySwitch checked={overlays.marks} label="Status marks" onChange={(marks) => onChange({ ...overlays, marks })} />
          </Row>
          <div className={cn("mt-1 grid pl-4", (off || !overlays.marks) && "opacity-40")}>
            {STATUS_KEYS.map((key) => (
              <label
                key={key}
                className={cn(
                  "flex h-6 items-center gap-2 text-[12.5px]",
                  overlays.statuses[key] ? "text-bone" : "text-ash",
                )}
              >
                <input
                  type="checkbox"
                  className="size-3.5 rounded-[2px] accent-paper"
                  checked={overlays.statuses[key]}
                  onChange={(event) =>
                    onChange({ ...overlays, statuses: { ...overlays.statuses, [key]: event.target.checked } })
                  }
                />
                <StatusMark kind={key} className="size-2.5" />
                {key === "known" ? "Known movers" : MARK_LABELS[key]}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="px-[18px] pt-2 pb-1.5">
        {OTHER_LAYERS.map(({ key, label, sub }) => (
          <Row key={key} dim={sub && !overlays[sub]} className={sub && "pl-4"}>
            {label}
            <SkySwitch checked={overlays[key]} label={label} onChange={(checked) => onChange({ ...overlays, [key]: checked })} />
          </Row>
        ))}
        <p className="mt-1 flex items-center gap-2 text-[11px] text-smoke">
          Show or hide candidates
          <Keycap>C</Keycap>
        </p>
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
