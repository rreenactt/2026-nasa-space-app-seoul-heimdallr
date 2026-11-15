import type { ReactNode } from "react";
import { getT } from "@/app/_i18n/server";
import { SiteHeader } from "./site-header";
import { PageHeaderActions } from "./page-header-actions";

/** Reading pages (About, Method): the site header over a black page in the interface fonts. */
export async function PageShell({ children }: { children: ReactNode }) {
  const t = await getT();
  return (
    <div className="min-h-dvh bg-ink font-ui text-paper">
      <SiteHeader className="sticky top-0 z-20 bg-ink/95 backdrop-blur-sm" actions={<PageHeaderActions />} />
      <main>{children}</main>
      <footer className="px-14 pt-16 pb-10 text-xs text-smoke">
        {t("page.footer")}
      </footer>
    </div>
  );
}
