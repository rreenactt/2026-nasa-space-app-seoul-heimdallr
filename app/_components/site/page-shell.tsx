import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { SiteMenu } from "./site-menu";

/** Reading pages (About, Method): the site header over a black page in the interface fonts. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink font-ui text-paper">
      <SiteHeader className="sticky top-0 z-20 bg-ink/95 backdrop-blur-sm" actions={<SiteMenu />} />
      <main>{children}</main>
      <footer className="px-14 pt-16 pb-10 text-xs text-smoke">
        NASA Space Apps Challenge 2026, Seoul. Challenge: Planet X and SPHEREx. Team HEIMDALLR. Not a NASA product.
      </footer>
    </div>
  );
}
