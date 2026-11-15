"use client";

import { ShareIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { headerActionClass } from "./site-header";

/** "Share" in the header: copies a link (by default this page's address) and says so for two seconds. */
export function ShareButton({ linkFor }: { linkFor?: () => string }) {
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
      <span aria-live="polite">{state === "copied" ? "Link copied" : state === "failed" ? "Copy failed" : "Share"}</span>
    </button>
  );
}
