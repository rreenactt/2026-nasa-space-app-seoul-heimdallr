import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { getT } from "@/app/_i18n/server";
import { TARGET_FOV } from "../sky/constants";
import { viewUrl } from "../sky/sky-selection";
import { TEST_TARGETS } from "../sky/test-targets";
import { ShareButton } from "./share-button";
import { headerActionClass } from "./site-header";
import { SiteMenu } from "./site-menu";

/** Search, Share and Menu on the reading pages, as on the sky (Figma "I · About", "I · Method"). Search opens the sky's search. */
export async function PageHeaderActions() {
  const t = await getT();
  return (
    <>
      <Link href="/#search" className={headerActionClass}>
        <SearchIcon aria-hidden />
        {t("search.label")}
      </Link>
      <ShareButton />
      <SiteMenu
        groups={[
          [
            {
              label: t("common.testTargets"),
              items: TEST_TARGETS.map((target) => ({ label: target.name, href: viewUrl({ ...target, fov: TARGET_FOV }) })),
            },
          ],
          [{ label: t("common.sourcesAndCredits"), href: "/method#sources" }],
        ]}
      />
    </>
  );
}
