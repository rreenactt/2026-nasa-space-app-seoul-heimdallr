"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, LinkIcon, SquareIcon, Volume2Icon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/ky";
import type { BlinkPlan } from "@/app/_lib/blink/types";
import { skyToPixel, wavelengthAt } from "@/app/_lib/comet/wcs";
import type { FplExposure } from "@/app/_lib/fpl/types";
import { DEFAULT_SETTINGS, sharedFluxRange, type SoundSettings } from "@/app/_lib/sonata/mapping";
import { detectSources } from "@/app/_lib/sonata/sources";
import type { SkyGrid } from "@/app/_lib/sky/types";
import { useT } from "@/app/_i18n/i18n-provider";
import { useFixedTarget } from "../analyses/fixed-target";
import { FPL_EXAMPLES, mjdIso, visitsOf, type FplTarget } from "../fake-planet-lab/fpl-state";
import { targetName } from "../fake-planet-lab/fpl-text";
import { toNative, useFrames, useSpherexSearch } from "../fake-planet-lab/use-fpl-data";
import { SonataAudio } from "./audio";
import { ListenPanel } from "./listen-panel";
import { PracticePanel, RulesPanel } from "./info-panels";

export interface SonataShared {
  target?: FplTarget;
  settings?: Partial<SoundSettings>;
}

/**
 * Sky Sonata, shown inside the analysis panel: SPHEREx observations turned into sound by fixed, explained rules.
 * Keyboard-first. Switching to another tab stops the sound; closing the view unmounts it and releases the audio.
 */
export function SkySonataView({ shared, active = true }: { shared?: SonataShared; active?: boolean }) {
  return <Body shared={shared} active={active} />;
}

export const GRID_FOV = 3;
export const GRID_N = 120;

function Body({ shared, active }: { shared?: SonataShared; active: boolean }) {
  const t = useT();
  const [target, setTarget] = useState<FplTarget>(shared?.target ?? FPL_EXAMPLES[1]);
  const [ra, setRa] = useState(target.ra.toFixed(5));
  const [dec, setDec] = useState(target.dec.toFixed(5));
  const fixed = useFixedTarget();
  const search = useSpherexSearch(target.ra, target.dec);
  const exposures = useMemo(() => search.data?.exposures ?? [], [search.data]);
  const dets = [...new Set(exposures.map((e) => e.detector))].sort();
  const [detChoice, setDetChoice] = useState<string | null>(null);
  const detector = detChoice && dets.includes(detChoice) ? detChoice : dets.includes("D3") ? "D3" : dets[0];
  const visits = visitsOf(exposures.filter((e) => e.detector === detector));
  const [aKey, setAKey] = useState<string | null>(null);
  const [bKey, setBKey] = useState<string | null>(null);
  const list = visits.flat();
  // The same plan the blink uses (same cache): which exposures of each visit see this position at the same
  // wavelength. A and B default to those, so a difference in loudness is not just a difference in colour.
  const planQ = useQuery({
    queryKey: ["blink", "plan", target.ra.toFixed(5), target.dec.toFixed(5), detector ?? "auto"],
    queryFn: () => api.get("/api/blink/plan", { searchParams: { ra: target.ra, dec: target.dec, ...(detector ? { detector } : {}) }, timeout: 65_000 }).json<BlinkPlan>(),
    enabled: Boolean(detector),
    staleTime: Infinity,
    retry: 1,
  });
  const matched = useMemo(() => {
    const plan = planQ.data;
    if (!plan || plan.referenceWavelengthUm == null) return null;
    const reference = plan.referenceWavelengthUm;
    const perVisit = plan.visits
      .map((v) => v.exposures.filter((e) => !e.excluded && e.estWavelengthUm != null).sort((p, q) => Math.abs(p.estWavelengthUm! - reference) - Math.abs(q.estWavelengthUm! - reference))[0])
      .filter(Boolean);
    if (perVisit.length < 2) return null;
    return { a: perVisit[0].key, b: perVisit[perVisit.length - 1].key, reference };
  }, [planQ.data]);
  const waiting = Boolean(detector) && planQ.isPending;
  const lastVisit = visits[visits.length - 1];
  const a: FplExposure | undefined = waiting
    ? undefined
    : (list.find((e) => e.key === aKey) ?? list.find((e) => e.key === matched?.a) ?? visits[0]?.[Math.floor(visits[0].length / 2)]);
  const b: FplExposure | undefined = waiting
    ? undefined
    : (list.find((e) => e.key === bKey) ?? list.find((e) => e.key === matched?.b) ?? (visits.length > 1 ? lastVisit[Math.floor(lastVisit.length / 2)] : undefined));
  const matchedDefaults = Boolean(matched && !aKey && !bKey && a?.key === matched.a && b?.key === matched.b);

  const frameQs = useFrames([a, b].filter((e): e is FplExposure => Boolean(e)), target.ra, target.dec);
  const frameA = frameQs[0]?.data ? toNative(frameQs[0].data) : null;
  const frameB = b && frameQs[1]?.data ? toNative(frameQs[1].data) : null;
  const sourcesA = useMemo(() => (frameA ? detectSources(frameA) : []), [frameA]);
  const sourcesB = useMemo(() => (frameB ? detectSources(frameB) : []), [frameB]);
  const grid = useMemo<SkyGrid>(() => ({ ra: target.ra, dec: target.dec, fovArcmin: GRID_FOV, n: GRID_N }), [target]);

  const [settings, setSettings] = useState<SoundSettings>({ ...DEFAULT_SETTINGS, ...shared?.settings });
  const [rangeTouched, setRangeTouched] = useState(Boolean(shared?.settings?.fluxLo));
  const [changedAt, setChangedAt] = useState<string | null>(null);
  const auto = useMemo(() => sharedFluxRange([sourcesA, sourcesB]), [sourcesA, sourcesB]);
  const effective: SoundSettings = !rangeTouched && auto ? { ...settings, fluxLo: auto.lo, fluxHi: auto.hi } : settings;
  const updateSettings = (patch: Partial<SoundSettings>) => {
    if ("fluxLo" in patch || "fluxHi" in patch) setRangeTouched(true);
    setSettings((s) => ({ ...(rangeTouched || !auto ? s : { ...s, fluxLo: auto.lo, fluxHi: auto.hi }), ...patch }));
    setChangedAt(new Date().toLocaleTimeString());
  };

  const audioRef = useRef<SonataAudio | null>(null);
  const [audioOn, setAudioOn] = useState(false);
  const [volume, setVolume] = useState(35);
  useEffect(() => () => void audioRef.current?.dispose(), []);
  // Nobody should hear a tab they cannot see.
  useEffect(() => {
    if (!active) audioRef.current?.stop();
  }, [active]);
  const audio = () => (audioRef.current ??= new SonataAudio());
  const startAudio = async () => {
    await audio().start();
    audio().setVolume(volume / 100);
    setAudioOn(true);
  };
  const stopAll = () => audioRef.current?.stop();

  const waveAt = (f: typeof frameA) => {
    if (!f?.payload.wave) return null;
    const p = skyToPixel(f.payload.wcs, target.ra, target.dec);
    return p ? wavelengthAt(f.payload.wave, p.x, p.y) : null;
  };
  const wa = waveAt(frameA);
  const wb = waveAt(frameB);
  const waveMismatch = wa && wb ? Math.abs(wa.wavelength - wb.wavelength) > Math.max(wa.bandwidth, wb.bandwidth) : false;

  const [copied, setCopied] = useState(false);
  const share = async () => {
    const s = effective;
    const url = `${window.location.origin}/?sonata=${[target.ra.toFixed(5), target.dec.toFixed(5), s.fMin, s.fMax, s.scanSeconds, s.mono ? 1 : 0, s.fluxLo.toPrecision(3), s.fluxHi.toPrecision(3)].join(",")}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
      {/* Always-available controls */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-background/95 p-2">
        {!audioOn ? (
          <Button size="sm" onClick={startAudio}>
            <Volume2Icon /> {t("sonata.startSound")}
          </Button>
        ) : (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">{t("sonata.soundOn")}</span>
        )}
        <Button size="sm" variant="destructive" onClick={stopAll} aria-label={t("sonata.stopAll")}>
          <SquareIcon /> {t("sonata.stopAll")}
        </Button>
        <label className="flex items-center gap-2 text-xs">
          {t("sonata.volume")}
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            aria-valuetext={t("sonata.volumePercent", { n: volume })}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVolume(v);
              audio().setVolume(v / 100);
            }}
            className="w-28"
          />
        </label>
        <span className="text-xs text-muted-foreground">{t("sonata.headphones")}</span>
      </div>

      <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-xs">
        <div className="flex flex-wrap items-end gap-2">
          {/* In the analysis panel the point is already chosen; only its sound rules can change here. */}
          {!fixed && (
          <>
          <div className="grid gap-1">
            <Label className="text-xs" htmlFor="ss-ex">{t("sonata.example")}</Label>
            <NativeSelect
              id="ss-ex"
              size="sm"
              value={FPL_EXAMPLES.find((e) => e.name === target.name)?.name ?? ""}
              onChange={(e) => {
                const next = FPL_EXAMPLES.find((x) => x.name === e.target.value);
                if (!next) return;
                setTarget(next);
                setRa(next.ra.toFixed(5));
                setDec(next.dec.toFixed(5));
                setAKey(null);
                setBKey(null);
              }}
            >
              <NativeSelectOption value="">{t("sonata.customPosition")}</NativeSelectOption>
              {FPL_EXAMPLES.map((e) => (
                <NativeSelectOption key={e.name} value={e.name}>{targetName(t, e.name)}</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="ss-ra" className="text-xs">RA (deg)</Label>
            <Input id="ss-ra" className="h-8 w-28 font-mono" value={ra} onChange={(e) => setRa(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="ss-dec" className="text-xs">Dec (deg)</Label>
            <Input id="ss-dec" className="h-8 w-28 font-mono" value={dec} onChange={(e) => setDec(e.target.value)} />
          </div>
          <Button
            size="sm"
            onClick={() => {
              const r = Number(ra);
              const d = Number(dec);
              if (r >= 0 && r < 360 && Math.abs(d) <= 90) {
                setTarget({ name: "Custom position", ra: r, dec: d, note: "" });
                setAKey(null);
                setBKey(null);
              }
            }}
          >
            {t("sonata.go")}
          </Button>
          </>
          )}
          <Button size="sm" variant="outline" onClick={share}>
            {copied ? <CheckIcon /> : <LinkIcon />} {copied ? t("sonata.linkCopied") : t("sonata.copyLink")}
          </Button>
        </div>

        {search.isPending ? (
          <span className="flex items-center gap-2 text-muted-foreground"><Spinner className="size-3" /> {t("sonata.searching")}</span>
        ) : search.isError ? (
          <span className="text-destructive">{search.error.message}</span>
        ) : !exposures.length ? (
          <span>{t("sonata.noCoverage")}</span>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1">
              <Label htmlFor="ss-det" className="text-xs">{t("sonata.detector")}</Label>
              <NativeSelect id="ss-det" size="sm" value={detector} onChange={(e) => { setDetChoice(e.target.value); setAKey(null); setBKey(null); }}>
                {dets.map((d) => (
                  <NativeSelectOption key={d} value={d}>{d}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            {(["A", "B"] as const).map((tag) => {
              const cur = tag === "A" ? a : b;
              return (
                <div key={tag} className="grid gap-1">
                  <Label htmlFor={`ss-${tag}`} className="text-xs">{t("sonata.observationTag", { tag })}</Label>
                  <NativeSelect id={`ss-${tag}`} size="sm" value={cur?.key ?? ""} onChange={(e) => (tag === "A" ? setAKey : setBKey)(e.target.value || null)}>
                    {tag === "B" && <NativeSelectOption value="">{t("sonata.noneOption")}</NativeSelectOption>}
                    {visits.map((v, vi) => v.map((e, ei) => (
                      <NativeSelectOption key={e.key} value={e.key}>
                        {t("sonata.visitOption", { v: vi + 1, visits: visits.length, e: ei + 1, n: v.length, date: mjdIso(e.tStart) })}
                      </NativeSelectOption>
                    )))}
                  </NativeSelect>
                </div>
              );
            })}
          </div>
        )}
        {waiting && exposures.length > 0 && (
          <span className="flex items-center gap-2 text-muted-foreground"><Spinner className="size-3" /> {t("sonata.choosing")}</span>
        )}
        {matchedDefaults && matched && (
          <p className="text-muted-foreground">
            {t("sonata.matchedNote", { um: matched.reference.toFixed(3) })}
          </p>
        )}
        {visits.length === 1 && (
          <p>{t("sonata.oneVisit")}</p>
        )}
        {waveMismatch && wa && wb && (
          <Alert>
            <AlertDescription>
              {t("sonata.waveAlert", { a: wa.wavelength.toFixed(3), b: wb.wavelength.toFixed(3) })}
            </AlertDescription>
          </Alert>
        )}
      </div>

      <Tabs defaultValue="listen">
        <TabsList className="w-full">
          <TabsTrigger value="listen">{t("sonata.tabListen")}</TabsTrigger>
          <TabsTrigger value="practice">{t("sonata.tabPractice")}</TabsTrigger>
          <TabsTrigger value="rules">{t("sonata.tabRules")}</TabsTrigger>
        </TabsList>
        <TabsContent value="listen">
          <ListenPanel
            audio={audio}
            ensureAudio={async () => {
              if (!audioOn) await startAudio();
            }}
            waveMismatch={waveMismatch}
            grid={grid}
            frames={{ A: frameA, B: frameB }}
            loading={{ A: waiting || Boolean(frameQs[0]?.isPending), B: Boolean(b && frameQs[1]?.isPending) }}
            errors={{ A: frameQs[0]?.error?.message ?? null, B: frameQs[1]?.error?.message ?? null }}
            exposures={{ A: a, B: b }}
            sources={{ A: sourcesA, B: sourcesB }}
            settings={effective}
            onSettings={updateSettings}
            rangeAuto={!rangeTouched && Boolean(auto)}
            changedAt={changedAt}
          />
        </TabsContent>
        <TabsContent value="practice">
          <PracticePanel audio={audio} audioOn={audioOn} settings={effective} />
        </TabsContent>
        <TabsContent value="rules">
          <RulesPanel settings={effective} frames={{ A: frameA, B: frameB }} exposures={{ A: a, B: b }} sources={{ A: sourcesA, B: sourcesB }} grid={grid} waves={{ A: wa, B: wb }} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
