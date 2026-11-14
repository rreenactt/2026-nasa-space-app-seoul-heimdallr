"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { headerActionClass } from "./site-header";

/** The header's Menu: pages that are not tabs-first, and (on the sky) extra entries such as keyboard shortcuts. */
export function SiteMenu({ extra }: { extra?: { label: string; key?: string; onSelect: () => void }[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={headerActionClass}>
        <MenuIcon aria-hidden />
        Menu
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="dark min-w-56 rounded-sm border border-rule bg-ink/95 p-1 font-ui text-bone"
      >
        <DropdownMenuItem render={<Link href="/about" />}>About HEIMDALLR</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/method" />}>Method and data</DropdownMenuItem>
        {extra?.map((item) => (
          <DropdownMenuItem key={item.label} onClick={item.onSelect}>
            {item.label}
            {item.key && (
              <kbd className="ml-auto rounded-sm border border-smoke px-1.5 font-data text-[11px] text-bone">
                {item.key}
              </kbd>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
