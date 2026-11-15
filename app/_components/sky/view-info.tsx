"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { SKY_SURVEY } from "./constants";
import { useCandidates } from "./candidates-context";
import { angularDistance, formatDec, formatRa } from "./sky-coordinates";
import { viewUrl } from "./sky-selection";
import { formatFov } from "./sky-tools";
import { TEST_TARGETS } from "./test-targets";
import { useView } from "./view-store";

/** Copies text and says so for two seconds (Figma "I · This view": 28px outlined buttons). */
function CopyButton({ label, text }: { label: string; text: () => string | null }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);
  return (
    <button
      type="button"
      className="h-7 rounded-[2px] border border-rule px-2.5 text-[12px] text-bone transition-colors hover:border-ash hover:text-paper"
      onClick={() => {
        const value = text();
        if (!value) return;
        navigator.clipboard.writeText(value).then(
          () => setState("copied"),
          () => setState("failed"),
        );
      }}
    >
      <span aria-live="polite">{state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label}</span>
    </button>
  );
}

function Line({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <dt className="text-[12px] text-ash">{term}</dt>
      <dd className="text-right font-data text-[11.5px] text-bone">{children}</dd>
    </div>
  );
}

/**
 * "This view", opened from the info tool: what is on screen now. Where the view is, what lies in it, and which
 * imagery the background is (the temporary 2MASS stand-in says so). The pages themselves are the header tabs.
 */
export function ViewInfo({ onClose }: { onClose: () => void }) {
  const view = useView();
  // Whatever lies within half the field of view of the centre: a circle, so a little short of the screen's corners.
  const within = (point: { ra: number; dec: number }) => !!view && angularDistance(view, point) <= view.fov / 2;
  const targets = TEST_TARGETS.filter(within);
  const all = useCandidates();
  const candidates = all.filter(within).length;
  return (
    <div>
      <div className="flex h-[46px] items-center justify-between border-b border-rule px-[18px]">
        <p className="text-sm font-medium text-paper">This view</p>
        <button type="button" className="text-xs text-ash hover:text-paper" onClick={onClose}>
          Close
        </button>
      </div>
      <dl className="border-b border-rule px-[18px] py-2.5">
        <Line term="Centre RA">{view ? formatRa(view.ra) : "—"}</Line>
        <Line term="Centre Dec">{view ? formatDec(view.dec) : "—"}</Line>
        <Line term="Field of view">{view ? formatFov(view.fov) : "—"}</Line>
        <Line term="Candidates in view">
          {all.length === 0 ? "None yet" : candidates.toLocaleString("en-US")}
        </Line>
        <Line term="Test targets in view">{targets.length ? targets.map((target) => target.name).join(", ") : "None"}</Line>
      </dl>
      <div className="border-b border-rule px-[18px] py-3">
        <p className="text-[12px] text-ash">Background imagery</p>
        <p className="mt-1 text-[12.5px] text-bone">{SKY_SURVEY.shortName}</p>
        {SKY_SURVEY.notice && <p className="mt-1 text-[11.5px] text-signal">{SKY_SURVEY.notice}</p>}
        <p className="mt-1 text-[11px] text-ash">{SKY_SURVEY.credit}</p>
        <p className="mt-1.5 text-[11px] text-ash">For looking around only. Analysis uses SPHEREx images from IRSA.</p>
        <Link href="/method#sources" className="mt-2 inline-block text-[11.5px] text-bone hover:text-paper hover:underline">
          Data sources and credits →
        </Link>
      </div>
      <div className="flex items-center gap-2 px-[18px] py-[11px]">
        <CopyButton
          label="Copy view link"
          text={() => (view ? new URL(viewUrl(view), window.location.origin).toString() : null)}
        />
        <CopyButton label="Copy coordinates" text={() => (view ? `${view.ra.toFixed(5)} ${view.dec.toFixed(5)}` : null)} />
      </div>
    </div>
  );
}
