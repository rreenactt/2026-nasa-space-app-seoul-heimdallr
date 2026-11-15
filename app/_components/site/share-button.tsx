"use client";

import { ShareIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/app/_i18n/i18n-provider";
import { headerActionClass } from "./site-header";

/** "Share" in the header: copies a link (by default this page's address) and says so for two seconds. */
export function ShareButton({ linkFor }: { linkFor?: () => string }) {
  const t = useT();
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
        navigator.clipboard.writeText(linkFor ? linkFor() : window.location.href).then(
          () => setState("copied"),
          () => setState("failed"),
        );
      }}
    >
      <ShareIcon aria-hidden />
      <span aria-live="polite">{state === "copied" ? t("share.copied") : state === "failed" ? t("common.copyFailed") : t("share.label")}</span>
    </button>
  );
}
