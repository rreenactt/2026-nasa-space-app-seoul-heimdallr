"use client";

import { useState } from "react";
import { CopyIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NativeFrame } from "@/app/_lib/fpl/checks";
import type { FplExposure } from "@/app/_lib/fpl/types";
import { eventFor, RULES_VERSION, scanEvents, type SoundEvent, type SoundSettings } from "@/app/_lib/sonata/mapping";
import { DETECTION, type SonataSource } from "@/app/_lib/sonata/sources";
import type { SkyGrid } from "@/app/_lib/sky/types";
import { mjdIso } from "../fake-planet-lab/fpl-state";
import type { SonataAudio } from "./audio";

/** Synthetic practice: the same rules as real data, on made-up points. Never mixed with observations. */
const EXERCISES: { id: string; title: string; explain: string; points: { x: number; y: number; flux: number }[] }[] = [
  { id: "lr", title: "Left, then right (same height, same brightness)", explain: "Only the stereo side changes.", points: [{ x: 0.1, y: 0.5, flux: 20 }, { x: 0.9, y: 0.5, flux: 20 }] },
  { id: "ud", title: "Top, then bottom (same side, same brightness)", explain: "Only the pitch changes: top is higher.", points: [{ x: 0.5, y: 0.1, flux: 20 }, { x: 0.5, y: 0.9, flux: 20 }] },
  { id: "fb", title: "Same place: faint, then bright", explain: "Only the loudness changes.", points: [{ x: 0.5, y: 0.5, flux: 1 }, { x: 0.5, y: 0.5, flux: 150 }] },
];

export function PracticePanel({ audio, audioOn, settings }: { audio: () => SonataAudio; audioOn: boolean; settings: SoundSettings }) {
  const [msg, setMsg] = useState("");
  const play = (ex: (typeof EXERCISES)[number]) => {
    if (!audioOn) return setMsg("Press Start sound first.");
    audio().stop();
    const evs: SoundEvent[] = ex.points.map((p, k) => eventFor(null, p.x, p.y, p.flux, { ...settings, noteSeconds: 0.5 }, k * 0.9));
    audio().play(evs);
    setMsg(`${ex.title}. ${ex.explain}`);
  };
  return (
    <div className="grid gap-3 pt-2 text-sm">
      <Badge variant="outline" className="w-fit">Synthetic practice — not observation data</Badge>
      <p className="text-xs text-muted-foreground">Learn the three rules before listening to real data. The points are made up; the rules are the ones used for SPHEREx.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {EXERCISES.map((ex) => (
          <Button key={ex.id} variant="outline" className="h-auto justify-start whitespace-normal py-2 text-left" onClick={() => play(ex)}>
            {ex.title}
          </Button>
        ))}
      </div>
      <p aria-live="polite" className="min-h-6 text-xs">{msg}</p>
    </div>
  );
}

export function RulesPanel({
  settings,
  frames,
  exposures,
  sources,
  grid,
  waves,
}: {
  settings: SoundSettings;
  frames: Record<"A" | "B", NativeFrame | null>;
  exposures: Record<"A" | "B", FplExposure | undefined>;
  sources: Record<"A" | "B", SonataSource[]>;
  grid: SkyGrid;
  waves: Record<"A" | "B", { wavelength: number; bandwidth: number } | null>;
}) {
  const [copied, setCopied] = useState(false);
  const eventsJson = () =>
    JSON.stringify(
      {
        rules: RULES_VERSION,
        detection: DETECTION,
        settings,
        grid,
        observations: (["A", "B"] as const).map((t) => ({
          tag: t,
          obsId: exposures[t]?.obsId,
          detector: exposures[t]?.detector,
          time: exposures[t] ? mjdIso((exposures[t]!.tStart + exposures[t]!.tEnd) / 2) : null,
          wavelengthUm: waves[t]?.wavelength ?? null,
          release: frames[t]?.payload.release,
          fileUrl: frames[t]?.payload.fileUrl,
          sources: sources[t],
          events: scanEvents(sources[t], grid, settings),
        })),
      },
      null,
      2,
    );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(eventsJson());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="grid gap-3 pt-2 text-xs">
      <section className="grid gap-1 rounded-md border p-3">
        <h3 className="text-sm font-medium">Rules ({RULES_VERSION})</h3>
        <p>This sound is a rule-based conversion of observed positions and brightness, not a recording from space.</p>
        <ul className="list-disc pl-4 font-mono">
          <li>left/right: pan = 2x − 1 {settings.mono ? "(mono: off)" : ""}</li>
          <li>height: f = {settings.fMin} Hz · ({settings.fMax}/{settings.fMin})^(1 − y) — top {settings.fMax} Hz, bottom {settings.fMin} Hz</li>
          <li>brightness: loudness ∝ log(F / {settings.fluxLo.toPrecision(3)} mJy) up to {settings.fluxHi.toPrecision(3)} mJy, capped</li>
          <li>scan: a source at x sounds at x · {settings.scanSeconds} s (scan time, not observing time)</li>
          <li>buzzy (square) tone: saturated source, brightness unreliable · double low click: no usable data</li>
        </ul>
        <p className="text-muted-foreground">
          Sources: local maxima ≥ {DETECTION.snrPeak}σ on native pixels of IMAGE − ZODI − sky (σ from VARIANCE), brightness = 3×3-pixel sum in mJy. Unusable pixels (NONFUNC, MISSING_DATA, HOT, COLD) are skipped; saturated cores are kept as “saturated” sources. Display contrast never changes the sound.
        </p>
      </section>
      <section className="grid gap-1 rounded-md border p-3">
        <h3 className="text-sm font-medium">Observations</h3>
        {(["A", "B"] as const).map((t) => (
          <p key={t}>
            <span className="font-medium">{t}:</span>{" "}
            {exposures[t] ? (
              <>
                <span className="font-mono">{exposures[t]!.obsId} {exposures[t]!.detector}</span> · {mjdIso(exposures[t]!.tStart)} · {waves[t] ? `${waves[t]!.wavelength.toFixed(3)} µm at the field centre` : ""} · {frames[t]?.payload.release ?? "not loaded"}{" "}
                {frames[t] && <a href={frames[t]!.payload.fileUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">original file</a>} · {sources[t].length} sources
              </>
            ) : (
              "none"
            )}
          </p>
        ))}
        <Button size="sm" variant="outline" className="w-fit" onClick={copy}>
          <CopyIcon /> {copied ? "Copied" : "Copy sources and sound events (JSON)"}
        </Button>
      </section>
      <section className="grid gap-1 rounded-md border p-3 text-muted-foreground">
        <h3 className="text-sm font-medium text-foreground">Limitations</h3>
        <ul className="list-disc pl-4">
          <li>Only the brightest detected sources are scanned; silence does not mean empty sky.</li>
          <li>A and B use one shared brightness range. If A and B are at different wavelengths, loudness can differ for that reason alone.</li>
          <li>No automatic change alerts yet: listen to A and B and judge yourself. A difference you hear is a candidate, not a confirmed change.</li>
          <li>Pitch and loudness ranges were chosen for listening, not tuned with users yet.</li>
        </ul>
      </section>
    </div>
  );
}
