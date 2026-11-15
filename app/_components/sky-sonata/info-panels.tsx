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
import { useT } from "@/app/_i18n/i18n-provider";
import type { MessageKey } from "@/app/_i18n/message-keys";
import { mjdIso } from "../fake-planet-lab/fpl-state";
import type { SonataAudio } from "./audio";

/** Synthetic practice: the same rules as real data, on made-up points. Never mixed with observations. */
const EXERCISES: { id: string; title: MessageKey; explain: MessageKey; points: { x: number; y: number; flux: number }[] }[] = [
  { id: "lr", title: "sonata.exLrTitle", explain: "sonata.exLrExplain", points: [{ x: 0.1, y: 0.5, flux: 20 }, { x: 0.9, y: 0.5, flux: 20 }] },
  { id: "ud", title: "sonata.exUdTitle", explain: "sonata.exUdExplain", points: [{ x: 0.5, y: 0.1, flux: 20 }, { x: 0.5, y: 0.9, flux: 20 }] },
  { id: "fb", title: "sonata.exFbTitle", explain: "sonata.exFbExplain", points: [{ x: 0.5, y: 0.5, flux: 1 }, { x: 0.5, y: 0.5, flux: 150 }] },
];

export function PracticePanel({ audio, audioOn, settings }: { audio: () => SonataAudio; audioOn: boolean; settings: SoundSettings }) {
  const t = useT();
  const [msg, setMsg] = useState("");
  const play = (ex: (typeof EXERCISES)[number]) => {
    if (!audioOn) return setMsg(t("sonata.pressStartFirst"));
    audio().stop();
    const evs: SoundEvent[] = ex.points.map((p, k) => eventFor(null, p.x, p.y, p.flux, { ...settings, noteSeconds: 0.5 }, k * 0.9));
    audio().play(evs);
    setMsg(t("sonata.practiceMessage", { title: t(ex.title), explain: t(ex.explain) }));
  };
  return (
    <div className="grid gap-3 pt-2 text-sm">
      <Badge variant="outline" className="w-fit">{t("sonata.syntheticBadge")}</Badge>
      <p className="text-xs text-muted-foreground">{t("sonata.practiceIntro")}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {EXERCISES.map((ex) => (
          <Button key={ex.id} variant="outline" className="h-auto justify-start whitespace-normal py-2 text-left" onClick={() => play(ex)}>
            {t(ex.title)}
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
  const t = useT();
  const [copied, setCopied] = useState(false);
  const eventsJson = () =>
    JSON.stringify(
      {
        rules: RULES_VERSION,
        detection: DETECTION,
        settings,
        grid,
        observations: (["A", "B"] as const).map((tag) => ({
          tag,
          obsId: exposures[tag]?.obsId,
          detector: exposures[tag]?.detector,
          time: exposures[tag] ? mjdIso((exposures[tag]!.tStart + exposures[tag]!.tEnd) / 2) : null,
          wavelengthUm: waves[tag]?.wavelength ?? null,
          release: frames[tag]?.payload.release,
          fileUrl: frames[tag]?.payload.fileUrl,
          sources: sources[tag],
          events: scanEvents(sources[tag], grid, settings),
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
        <h3 className="text-sm font-medium">{t("sonata.sectionRules", { version: RULES_VERSION })}</h3>
        <p>{t("sonata.rulesIntro")}</p>
        <ul className="list-disc pl-4 font-mono">
          <li>{t("sonata.ruleLeftRight")} {settings.mono ? t("sonata.ruleMonoOff") : ""}</li>
          <li>{t("sonata.ruleHeight", { fMin: settings.fMin, fMax: settings.fMax })}</li>
          <li>{t("sonata.ruleBrightness", { lo: settings.fluxLo.toPrecision(3), hi: settings.fluxHi.toPrecision(3) })}</li>
          <li>{t("sonata.ruleScan", { s: settings.scanSeconds })}</li>
          <li>{t("sonata.ruleCues")}</li>
        </ul>
        <p className="text-muted-foreground">
          {t("sonata.detectionNote", { snr: DETECTION.snrPeak })}
        </p>
      </section>
      <section className="grid gap-1 rounded-md border p-3">
        <h3 className="text-sm font-medium">{t("sonata.sectionObservations")}</h3>
        {(["A", "B"] as const).map((tag) => (
          <p key={tag}>
            <span className="font-medium">{tag}:</span>{" "}
            {exposures[tag] ? (
              <>
                <span className="font-mono">{exposures[tag]!.obsId} {exposures[tag]!.detector}</span> · {mjdIso(exposures[tag]!.tStart)} · {waves[tag] ? t("sonata.waveAtCentre", { um: waves[tag]!.wavelength.toFixed(3) }) : ""} · {frames[tag]?.payload.release ?? t("sonata.notLoaded")}{" "}
                {frames[tag] && <a href={frames[tag]!.payload.fileUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{t("sonata.originalFile")}</a>} · {t("sonata.sourcesCount", { n: sources[tag].length })}
              </>
            ) : (
              t("sonata.none")
            )}
          </p>
        ))}
        <Button size="sm" variant="outline" className="w-fit" onClick={copy}>
          <CopyIcon /> {copied ? t("common.copied") : t("sonata.copyJson")}
        </Button>
      </section>
      <section className="grid gap-1 rounded-md border p-3 text-muted-foreground">
        <h3 className="text-sm font-medium text-foreground">{t("sonata.sectionLimitations")}</h3>
        <ul className="list-disc pl-4">
          <li>{t("sonata.limitBrightest")}</li>
          <li>{t("sonata.limitSharedRange")}</li>
          <li>{t("sonata.limitNoAlerts")}</li>
          <li>{t("sonata.limitTuning")}</li>
        </ul>
      </section>
    </div>
  );
}
