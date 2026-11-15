"use client";

import { SearchIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { headerActionClass } from "../site/site-header";
import { ShareButton } from "../site/share-button";
import { type MenuEntry, SiteMenu } from "../site/site-menu";
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
  menuGroups: MenuEntry[][];
};

/** Search, Share and Menu in the header of the sky screen. */
export function SkyHeaderActions({ onTarget, onPoint, searchOpen, onSearchOpenChange, menuGroups }: SkyHeaderActionsProps) {
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
      <ShareButton linkFor={() => {
        const view = getView();
        // An open panel already has its link in the address bar; otherwise link to what is on screen.
        return window.location.search || !view ? window.location.href : new URL(viewUrl(view), window.location.origin).toString();
      }} />
      <SiteMenu groups={menuGroups} />
    </>
  );
}
