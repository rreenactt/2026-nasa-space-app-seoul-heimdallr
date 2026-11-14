"use client";

import { SearchIcon, ShareIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { headerActionClass } from "../site/site-header";
import { SiteMenu } from "../site/site-menu";
import type { EquatorialCoordinates } from "./sky-coordinates";
import { SkySearchBox } from "./sky-search-box";
import { viewUrl } from "./sky-selection";
import type { TestTarget } from "./test-targets";
import { getView } from "./view-store";

type SkyHeaderActionsProps = {
  onTarget: (target: TestTarget) => void;
  onPoint: (point: EquatorialCoordinates) => void;
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
  menuExtra?: Parameters<typeof SiteMenu>[0]["extra"];
};

/** Search, Share and Menu in the header of the sky screen. */
export function SkyHeaderActions({ onTarget, onPoint, searchOpen, onSearchOpenChange, menuExtra }: SkyHeaderActionsProps) {
  return (
    <>
      <Popover open={searchOpen} onOpenChange={onSearchOpenChange}>
        <PopoverTrigger className={headerActionClass}>
          <SearchIcon aria-hidden />
          Search
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={10} className="w-auto rounded-sm border-0 bg-ink/90 p-2 ring-0">
          <SkySearchBox
            onTarget={(target) => {
              onSearchOpenChange(false);
              onTarget(target);
            }}
            onPoint={(point) => {
              onSearchOpenChange(false);
              onPoint(point);
            }}
          />
        </PopoverContent>
      </Popover>
      <ShareButton />
      <SiteMenu extra={menuExtra} />
    </>
  );
}

/** Copies a link to what is on screen (`?view=`, or the open panel's link from the address bar). */
function ShareButton() {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <button
      type="button"
      className={headerActionClass}
      onClick={() => {
        const view = getView();
        const url = window.location.search ? window.location.href : view ? new URL(viewUrl(view), window.location.origin).toString() : window.location.href;
        navigator.clipboard.writeText(url).then(
          () => setState("copied"),
          () => setState("failed"),
        );
      }}
    >
      <ShareIcon aria-hidden />
      <span aria-live="polite">{state === "copied" ? "Link copied" : state === "failed" ? "Copy failed" : "Share"}</span>
    </button>
  );
}
