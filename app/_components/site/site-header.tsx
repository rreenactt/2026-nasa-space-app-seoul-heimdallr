"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "cn";
import { useT } from "@/app/_i18n/i18n-provider";

const TABS = [
  { href: "/", label: "nav.sky" },
  { href: "/about", label: "nav.about" },
  { href: "/method", label: "nav.method" },
] as const;

/** Text button with an icon in the header's right group (Eyes on the Solar System style: no fill). */
export const headerActionClass =
  "inline-flex h-8 items-center gap-1.5 rounded-sm px-1 font-ui text-[15px] font-medium tracking-[0.02em] text-mist transition-colors duration-300 hover:text-paper focus-visible:outline focus-visible:outline-1 focus-visible:outline-paper/60 [&_svg]:size-4 [&_svg]:stroke-[1.5]";

/**
 * Site header: wordmark, the three tabs (Sky, About, Method) and a right group of actions the page passes in.
 * Figma "HEIMDALLR UI" → "Sky screen · Directions", design I.
 */
export function SiteHeader({ actions, className }: { actions?: ReactNode; className?: string }) {
  const pathname = usePathname();
  const t = useT();
  return (
    <header className={cn("flex h-14 items-center px-7 text-paper", className)}>
      <Link href="/" data-wordmark className="font-display text-[15px] tracking-[0.22em] uppercase">
        Heimdallr
      </Link>
      <nav aria-label={t("nav.label")} className="absolute left-1/2 flex -translate-x-1/2">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "px-5 py-2 font-data text-[13px] tracking-[0.08em] uppercase transition-colors duration-300",
                active ? "text-paper" : "text-ash hover:text-paper",
              )}
            >
              <span className={cn("border-b pb-1", active ? "border-paper" : "border-transparent")}>{t(tab.label)}</span>
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-5">{actions}</div>
    </header>
  );
}
