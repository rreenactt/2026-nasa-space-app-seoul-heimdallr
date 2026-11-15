"use client";

import { InfoIcon, LayersIcon, LocateFixedIcon, MaximizeIcon, MinimizeIcon, MinusIcon, PlusIcon, ScanSearchIcon } from "lucide-react";
import { Fragment, type ReactElement, type ReactNode, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useT } from "@/app/_i18n/i18n-provider";
import type { MessageKey } from "@/app/_i18n/message-keys";
import { cn } from "cn";
import { Keycap } from "../site/keycap";
import { MAX_FOV, MIN_FOV } from "./constants";
import type { SkyOverlays, StatusKey } from "./overlays";
import { GROUPS_FOV } from "./candidate-layer";
import { useCandidates } from "./candidates-context";
import { MARK_LABEL_KEYS, StatusMark } from "./status-mark";
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
  const t = useT();
  const view = useView();
  const [infoOpen, setInfoOpen] = useState(false);
  return (
    <div role="toolbar" aria-orientation="vertical" aria-label={t("tools.label")} className="flex flex-col gap-[5px]">
      {/* Figma "I · This view": what is on screen now. The About page itself is the header tab. */}
      <Popover open={infoOpen} onOpenChange={setInfoOpen}>
        <ToolTip label={t("viewInfo.title")}>
          <PopoverTrigger className={toolClass} aria-label={t("viewInfo.title")}>
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
        <ToolTip label={t("layers.title")} keyName="L">
          <PopoverTrigger
            className={cn(toolClass, "relative")}
            aria-label={candidatesOff ? t("tools.layersCandidatesHidden") : t("layers.title")}
          >
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
      <ToolTip label={starGuide ? t("tools.starGuideOff") : t("tools.starGuideOn")}>
        <button
          type="button"
          className={cn(toolClass, starGuide && "bg-paper/15 text-paper")}
          aria-label={t("tools.starGuide")}
          aria-pressed={starGuide}
          onClick={onStarGuide}
        >
          <ScanSearchIcon />
        </button>
      </ToolTip>
      <ToolTip label={t("tools.zoomIn")} keyName="+">
        <button
          type="button"
          className={toolClass}
          aria-label={t("tools.zoomIn")}
          disabled={!view || view.fov <= MIN_FOV * 1.01}
          onClick={() => onZoom(1 / 2)}
        >
          <PlusIcon />
        </button>
      </ToolTip>
      <ToolTip label={t("tools.zoomOut")} keyName="−">
        <button
          type="button"
          className={toolClass}
          aria-label={t("tools.zoomOut")}
          disabled={!view || view.fov >= MAX_FOV * 0.99}
          onClick={() => onZoom(2)}
        >
          <MinusIcon />
        </button>
      </ToolTip>
      <ToolTip label={t("tools.home")}>
        <button type="button" className={toolClass} aria-label={t("tools.home")} onClick={onHome}>
          <LocateFixedIcon />
        </button>
      </ToolTip>
      <ToolTip label={fullscreen ? t("tools.leaveFullscreen") : t("tools.fullscreenFrameOff")} keyName="F">
        <button
          type="button"
          className={toolClass}
          aria-label={fullscreen ? t("tools.leaveFullscreen") : t("tools.fullscreen")}
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

/** The status filters with their names in the panel ("Known movers" in the plural here, unlike the mark itself). */
const STATUS_KEYS: { key: StatusKey; label: MessageKey }[] = [
  { key: "noteworthy", label: MARK_LABEL_KEYS.noteworthy },
  { key: "needs-ratings", label: MARK_LABEL_KEYS["needs-ratings"] },
  { key: "recommended", label: MARK_LABEL_KEYS.recommended },
  { key: "known", label: "layers.knownMovers" },
];

/** `sub` rows sit indented under the row above and dim while it is off (Figma "Constellation names"). */
const OTHER_LAYERS: {
  key: "opened" | "pins" | "constellations" | "constellationNames" | "grid";
  label: MessageKey;
  sub?: "constellations";
}[] = [
  { key: "opened", label: "layers.opened" },
  { key: "pins", label: "common.testTargets" },
  { key: "constellations", label: "layers.constellationLines" },
  { key: "constellationNames", label: "layers.constellationNames", sub: "constellations" },
  { key: "grid", label: "layers.grid" },
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
  const t = useT();
  const off = !overlays.candidates;
  const candidates = useCandidates();
  const view = useView();
  const inView = view
    ? candidates.filter((candidate) => angularDistance(view, candidate) <= view.fov / 2).length
    : 0;
  return (
    <div>
      <div className="flex h-[46px] items-center justify-between border-b border-rule px-[18px]">
        <p className="text-sm font-medium text-paper">{t("layers.heading")}</p>
        <button type="button" className="text-xs text-ash hover:text-paper" onClick={onClose}>
          {t("common.close")}
        </button>
      </div>
      <div className="border-b border-rule px-[18px] pt-3 pb-2.5">
        <label className="flex items-start justify-between gap-3">
          <span>
            <span className="block text-sm font-medium text-paper">{t("common.candidates")}</span>
            <span className="block text-[11.5px] text-ash">
              {candidates.length === 0
                ? t("layers.candidatesNone")
                : view && view.fov > GROUPS_FOV
                  ? t("layers.candidatesShownBelow", { fov: GROUPS_FOV })
                  : t("layers.candidatesInView", { n: inView.toLocaleString("en-US") })}
            </span>
          </span>
          <SkySwitch
            className="mt-0.5"
            checked={overlays.candidates}
            label={t("common.candidates")}
            onChange={(candidates) => onChange({ ...overlays, candidates })}
          />
        </label>
        <div className="mt-2 pl-4">
          <Row dim={off} className="h-7">
            {t("layers.statusMarks")}
            <SkySwitch checked={overlays.marks} label={t("layers.statusMarks")} onChange={(marks) => onChange({ ...overlays, marks })} />
          </Row>
          <div className={cn("mt-1 grid pl-4", (off || !overlays.marks) && "opacity-40")}>
            {STATUS_KEYS.map(({ key, label }) => (
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
                {t(label)}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="px-[18px] pt-2 pb-1.5">
        {OTHER_LAYERS.map(({ key, label, sub }) => (
          <Fragment key={key}>
            <Row dim={sub && !overlays[sub]} className={sub && "pl-4"}>
              {t(label)}
              <SkySwitch checked={overlays[key]} label={t(label)} onChange={(checked) => onChange({ ...overlays, [key]: checked })} />
            </Row>
            {/* Grid RA labels are in hours, as everywhere else on the screen (Figma "Coordinate grid hint"). */}
            {key === "grid" && <p className="-mt-1 mb-0.5 text-[11.5px] text-ash">{t("layers.gridHint")}</p>}
          </Fragment>
        ))}
        <p className="mt-1 flex items-center gap-2 text-[11px] text-smoke">
          {t("shortcuts.candidates")}
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
