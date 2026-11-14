"use client";

import { useMemo, useState } from "react";
import { AlertOctagonIcon, CircleCheckIcon, CircleDashedIcon, InfoIcon, SaveIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CHECK_PARAMS, runChecks, VERDICT_TEXT, type NativeFrame } from "@/app/_lib/fpl/checks";
import { MEASUREMENT_EXCLUDE } from "@/app/_lib/fpl/flags";
import type { CheckStatus, Judgment } from "@/app/_lib/fpl/types";
import { useFpl } from "./fpl-state";
import { useNeighbours } from "./use-fpl-data";

export const STATUS_META: Record<CheckStatus, { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  issue: { label: "Issue", icon: AlertOctagonIcon, cls: "text-red-600 dark:text-red-400" },
  caution: { label: "Caution", icon: TriangleAlertIcon, cls: "text-amber-600 dark:text-amber-400" },
  ok: { label: "OK", icon: CircleCheckIcon, cls: "text-emerald-600 dark:text-emerald-400" },
  info: { label: "Info", icon: InfoIcon, cls: "text-slate-500 dark:text-slate-400" },
  "not-checked": { label: "Not checked", icon: CircleDashedIcon, cls: "text-muted-foreground" },
};

const JUDGMENTS: { id: Judgment; label: string }[] = [
  { id: "moving", label: "Moving" },
  { id: "not-moving", label: "Not moving" },
  { id: "noise-or-artifact", label: "Noise or artifact" },
  { id: "undecided", label: "Undecided" },
];

export function CheckPanel({ frames }: { frames: NativeFrame[] }) {
  const { candidate, target, selected, addRecord } = useFpl();
  const [runNeighbours, setRunNeighbours] = useState(false);
  const epochYear = frames[0] ? 2000 + (frames[0].payload.header.mjdAvg - 51544.5) / 365.25 : 2025.8;
  const neighbours = useNeighbours(candidate, epochYear, runNeighbours);
  const [judgment, setJudgment] = useState<Judgment>("undecided");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  const report = useMemo(
    () => (candidate && frames.length ? runChecks(frames[0], frames.slice(1), candidate.ra, candidate.dec, neighbours.data?.stars ?? null) : null),
    [candidate, frames, neighbours.data],
  );

  if (!candidate) {
    return <p className="text-sm text-muted-foreground">Click a dot on any image to inspect that position. Checks run on the original pixels of the primary observation (★).</p>;
  }
  if (!report) return <Spinner />;

  const save = () => {
    addRecord({
      id: `cand-${Date.now()}`,
      createdAt: new Date().toISOString(),
      candidate,
      target,
      primaryKey: report.primary.key,
      comparisonKeys: report.others.map((o) => o.m.key),
      verdict: VERDICT_TEXT[report.verdict],
      checks: report.checks.map((c) => ({ label: c.label, status: c.status, summary: c.summary })),
      judgment,
      note,
      evidence: {
        primary: { ...report.primary, photometry: report.primary.photometry && { ...report.primary.photometry } },
        others: report.others.map((o) => ({ key: o.m.key, dtDays: o.dtDays, snr: o.m.photometry?.snr ?? null, wavelengthUm: o.m.wavelengthUm, apertureFlags: o.m.apertureFlags })),
        checkDetails: report.checks,
        neighbours: neighbours.data?.stars ?? null,
        sources: frames.map((f) => ({ key: f.payload.key, release: f.payload.release, fileUrl: f.payload.fileUrl, datalinkUrl: f.payload.datalinkUrl, pixelSource: f.payload.pixelSource })),
        policy: { measurementExclude: MEASUREMENT_EXCLUDE, params: CHECK_PARAMS },
        frames: selected.map((e) => e.key),
      },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const verdictCls =
    report.verdict === "quality-issue"
      ? "border-red-500/50 bg-red-500/10"
      : report.verdict === "needs-review"
        ? "border-amber-500/50 bg-amber-500/10"
        : "border-emerald-500/50 bg-emerald-500/10";

  return (
    <div className="grid gap-3 text-sm">
      <div className={`rounded-md border p-3 ${verdictCls}`}>
        <div className="text-base font-semibold">{VERDICT_TEXT[report.verdict]}</div>
        <p className="font-mono text-xs text-muted-foreground">
          RA {candidate.ra.toFixed(5)}° Dec {candidate.dec.toFixed(5)}° · {report.primary.key}
          {report.primary.wavelengthUm != null && ` · ${report.primary.wavelengthUm.toFixed(3)} µm`}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {report.verdict === "no-issue-found"
            ? "No problem was found by these checks. This does not confirm a real object, let alone a planet."
            : "Each item below is evidence, not a final ruling. Flags mean the pipeline marked an effect; they do not prove a dot is fake."}
        </p>
      </div>

      <ul className="grid gap-2">
        {report.checks.map((c) => {
          const m = STATUS_META[c.status];
          const Icon = m.icon;
          return (
            <li key={c.id} className="rounded-md border p-2">
              <div className="flex items-start gap-2">
                <Icon className={`mt-0.5 size-4 shrink-0 ${m.cls}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{c.label}</span>
                    <span className={`text-xs ${m.cls}`}>{m.label}</span>
                  </div>
                  <p className="text-xs">{c.summary}</p>
                  {c.details.length > 0 && (
                    <details className="mt-1 text-xs text-muted-foreground">
                      <summary className="cursor-pointer select-none">Details</summary>
                      <ul className="mt-1 list-disc pl-4">
                        {c.details.map((d) => (
                          <li key={d}>{d}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {c.id === "neighbours" && !runNeighbours && (
                    <Button size="xs" variant="outline" className="mt-1" onClick={() => setRunNeighbours(true)}>
                      Check bright stars (Gaia DR3)
                    </Button>
                  )}
                  {c.id === "neighbours" && runNeighbours && neighbours.isPending && (
                    <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Spinner className="size-3" /> Querying Gaia DR3…</span>
                  )}
                  {c.id === "neighbours" && neighbours.isError && <p className="text-xs text-destructive">{neighbours.error.message}</p>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="grid gap-2 rounded-md border p-3">
        <Label className="text-xs">Your judgment</Label>
        <ToggleGroup variant="outline" size="sm" spacing={0} value={[judgment]} onValueChange={(v) => v[0] && setJudgment(v[0] as Judgment)} className="flex-wrap">
          {JUDGMENTS.map((j) => (
            <ToggleGroupItem key={j.id} value={j.id}>
              {j.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Textarea placeholder="Notes (what you saw, what is still unclear)" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-16 text-xs" />
        <Button size="sm" onClick={save} className="w-fit">
          <SaveIcon /> {saved ? "Saved to Records" : "Save record"}
        </Button>
        <p className="text-[11px] text-muted-foreground">Records stay in this browser tab until you download them (Records tab).</p>
      </div>
    </div>
  );
}
