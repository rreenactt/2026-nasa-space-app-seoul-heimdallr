"use client";

import { useState } from "react";
import { AlertCircleIcon, CheckIcon, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { EXAMPLES, MISSION_ORDER, MISSIONS } from "@/app/_lib/sky/missions";
import { useT } from "@/app/_i18n/i18n-provider";
import { useFixedTarget } from "../analyses/fixed-target";
import { TARGET_FOV } from "../sky/constants";
import { selectionUrl } from "../sky/sky-selection";
import { exampleTarget, MISSION_COLOR, useStm } from "./stm-state";

const FOVS = [3, 5, 8, 12];

export function TargetBar() {
  const t = useT();
  const { target, setTarget, searches, enabled, setEnabled, bands, setBand } = useStm();
  const [raText, setRaText] = useState(target.ra.toFixed(5));
  const [decText, setDecText] = useState(target.dec.toFixed(5));
  const [copied, setCopied] = useState(false);
  const example = EXAMPLES.find((e) => e.name === target.name);
  const fixed = useFixedTarget();

  const apply = () => {
    const ra = Number(raText);
    const dec = Number(decText);
    if (Number.isFinite(ra) && Number.isFinite(dec) && ra >= 0 && ra < 360 && Math.abs(dec) <= 90) {
      setTarget({ name: "Custom coordinates", ra, dec, fovArcmin: target.fovArcmin, source: t("stm.enteredByUser") });
    }
  };
  const share = async () => {
    // Standard link: opens the sky at this point with the analysis panel (fov = sky view in degrees, not the cutout).
    const url = `${window.location.origin}${selectionUrl({ ra: target.ra, dec: target.dec, fov: TARGET_FOV })}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-end gap-2">
        {!fixed && (
        <>
        <div className="grid gap-1">
          <Label className="text-xs">{t("stm.example")}</Label>
          <NativeSelect
            size="sm"
            value={example?.id ?? ""}
            onChange={(e) => {
              if (!e.target.value) return;
              const next = exampleTarget(e.target.value);
              setTarget(next);
              setRaText(next.ra.toFixed(5));
              setDecText(next.dec.toFixed(5));
            }}
          >
            <NativeSelectOption value="">{t("stm.customCoordinates")}</NativeSelectOption>
            {EXAMPLES.map((e) => (
              <NativeSelectOption key={e.id} value={e.id}>
                {e.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="stm-ra" className="text-xs">RA (deg)</Label>
          <Input id="stm-ra" className="h-8 w-28 font-mono" value={raText} onChange={(e) => setRaText(e.target.value)} inputMode="decimal" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="stm-dec" className="text-xs">Dec (deg)</Label>
          <Input id="stm-dec" className="h-8 w-28 font-mono" value={decText} onChange={(e) => setDecText(e.target.value)} inputMode="decimal" />
        </div>
        <Button size="sm" onClick={apply}>{t("stm.viewCoordinates")}</Button>
        </>
        )}
        <div className="grid gap-1">
          <Label className="text-xs">{t("stm.field")}</Label>
          <NativeSelect size="sm" value={String(target.fovArcmin)} onChange={(e) => setTarget({ ...target, fovArcmin: Number(e.target.value) })}>
            {FOVS.map((f) => (
              <NativeSelectOption key={f} value={f}>
                {f}′ × {f}′
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        {/* In the panel, the header's "Copy link" already links to this point. */}
        {!fixed && (
          <Button size="sm" variant="outline" onClick={share} aria-label={t("stm.copyLinkLabel")}>
            {copied ? <CheckIcon /> : <LinkIcon />} {copied ? t("common.copied") : t("stm.link")}
          </Button>
        )}
      </div>
      {example && !fixed && <p className="text-xs text-muted-foreground">{example.note} <span className="opacity-70">{t("stm.exampleCoordinates", { source: example.source })}</span></p>}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {MISSION_ORDER.map((m, i) => {
          const q = searches[i];
          const cfg = MISSIONS[m];
          const count = q.data?.epochs.filter((e) => e.band === bands[m]).length;
          return (
            <div key={m} className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs">
              <Switch size="sm" checked={enabled[m]} onCheckedChange={(v) => setEnabled(m, v)} aria-label={t("stm.showMission", { mission: cfg.label })} />
              <span className="size-2 shrink-0 rounded-full" style={{ background: MISSION_COLOR[m] }} />
              <span className="font-medium">{cfg.label}</span>
              <NativeSelect size="sm" className="ml-auto" value={bands[m]} onChange={(e) => setBand(m, e.target.value)} aria-label={t("stm.missionBand", { mission: cfg.label })}>
                {cfg.bands.map((b) => (
                  <NativeSelectOption key={b.id} value={b.id}>
                    {b.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <span className="w-14 text-right text-muted-foreground">
                {q.isPending ? (
                  <Spinner className="ml-auto size-3" />
                ) : q.isError ? (
                  <span className="inline-flex items-center gap-1 text-destructive" title={q.error.message}>
                    <AlertCircleIcon className="size-3" /> {t("stm.failed")}
                  </span>
                ) : (
                  t("stm.datesCount", { n: String(count) })
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
