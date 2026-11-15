"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocale, useT } from "@/app/_i18n/i18n-provider";
import { LOCALES } from "@/app/_i18n/locale";
import { headerActionClass } from "./site-header";

export type MenuEntry = {
  label: string;
  /** Shown at the right end: a key, or a short note such as a count. */
  key?: string;
  hint?: string;
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
  /** A submenu instead of an action. */
  items?: MenuEntry[];
};

const contentClass = "dark min-w-60 rounded-sm border border-rule bg-ink/95 p-1 font-ui text-bone";

function Entry({ entry }: { entry: MenuEntry }) {
  if (entry.items) {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>{entry.label}</DropdownMenuSubTrigger>
        <DropdownMenuSubContent className={contentClass}>
          {entry.items.map((item) => (
            <Entry key={item.label} entry={item} />
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }
  return (
    <DropdownMenuItem
      disabled={entry.disabled}
      onClick={entry.onSelect}
      render={entry.href ? <Link href={entry.href} /> : undefined}
    >
      {entry.label}
      {entry.hint && <span className="ml-auto text-xs text-ash">{entry.hint}</span>}
      {entry.key && (
        <kbd className="ml-auto rounded-sm border border-smoke px-1.5 font-data text-[11px] text-bone">{entry.key}</kbd>
      )}
    </DropdownMenuItem>
  );
}

/**
 * The header's Menu. The pages themselves are the tabs, so the menu holds what the tabs do not: help, shortcuts to
 * places, sources and browser-only settings. Groups are split by a line.
 */
export function SiteMenu({ groups }: { groups: MenuEntry[][] }) {
  const t = useT();
  const { locale, setLocale } = useLocale();
  // Every page's menu ends with the language choice (decision #56); each language is named in itself.
  const language: MenuEntry = {
    label: t("language.menu"),
    items: LOCALES.map((option) => ({
      label: t(`language.${option}`),
      hint: option === locale ? "✓" : undefined,
      onSelect: () => setLocale(option),
    })),
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={headerActionClass}>
        <MenuIcon aria-hidden />
        {t("menu.label")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={contentClass}>
        {[...groups, [language]].map((group, index) => (
          <Fragment key={index}>
            {index > 0 && <DropdownMenuSeparator className="bg-rule" />}
            {group.map((entry) => (
              <Entry key={entry.label} entry={entry} />
            ))}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
