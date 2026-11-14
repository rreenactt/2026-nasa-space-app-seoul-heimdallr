"use client";

import { useMemo, useState } from "react";
import { AlertCircleIcon, CrosshairIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PERIODS } from "@/app/_lib/comet/published";
import { wavelengthAt } from "@/app/_lib/comet/wcs";
import type { ObservationEntry, PeriodId } from "@/app/_lib/comet/types";
import { formatUtc, useCometState } from "./comet-state";
import { FitsCanvas, displayValues, percentileRange, type DisplayRange, type Stretch } from "./fits-canvas";
import { cometPixel, decodeFrame, measure, useFrame, type FrameCenter } from "./use-comet-data";

type AlignMode = "comet" | "sky";

interface DisplayOptions {
  stretch: Stretch;
  clipHigh: number;
  subtractZodi: boolean;
  showFlags: boolean;
  showAperture: boolean;
}

export function ImageExplorer() {
  const { selected, entries } = useCometState();
  const [mode, setMode] = useState<AlignMode>("comet");
  const [skyRef, setSkyRef] = useState<FrameCenter | null>(null);
  const [raText, setRaText] = useState("");
  const [decText, setDecText] = useState("");
  const [display, setDisplay] = useState<DisplayOptions>({
    stretch: "asinh",
    clipHigh: 99.5,
    subtractZodi: true,
    showFlags: false,
    showAperture: true,
  });
  const [compare, setCompare] = useState(false);
  const [compareKey, setCompareKey] = useState<string | null>(null);
  const [sameScale, setSameScale] = useState(true);

  if (!selected) return <p className="py-8 text-muted-foreground">이 조건에 해당하는 관측이 없습니다.</p>;

  const centerFor = (e: ObservationEntry): FrameCenter =>
    mode === "sky" && skyRef ? skyRef : { ra: e.cometRa, dec: e.cometDec };

  const compareCandidates = entries.filter((e) => e.detector === selected.detector && e.key !== selected.key);
  const compareEntry =
    compareCandidates.find((e) => e.key === compareKey) ??
    compareCandidates.find((e) => e.period !== selected.period) ??
    compareCandidates.at(-1);

  const applySky = () => {
    const ra = Number(raText);
    const dec = Number(decText);
    if (Number.isFinite(ra) && Number.isFinite(dec) && ra >= 0 && ra <= 360 && Math.abs(dec) <= 90) setSkyRef({ ra, dec });
  };
  const centerOnComet = () => {
    setRaText(selected.cometRa.toFixed(5));
    setDecText(selected.cometDec.toFixed(5));
    setSkyRef({ ra: selected.cometRa, dec: selected.cometDec });
  };

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          value={[mode]}
          onValueChange={(v) => {
            const m = v[0] as AlignMode | undefined;
            if (!m) return;
            setMode(m);
            if (m === "sky" && !skyRef) centerOnComet();
          }}
          aria-label="정렬 모드"
        >
          <ToggleGroupItem value="comet">혜성 중심</ToggleGroupItem>
          <ToggleGroupItem value="sky">하늘 고정</ToggleGroupItem>
        </ToggleGroup>
        <NativeSelect size="sm" value={display.stretch} onChange={(e) => setDisplay({ ...display, stretch: e.target.value as Stretch })} aria-label="밝기 스트레치">
          <NativeSelectOption value="asinh">asinh</NativeSelectOption>
          <NativeSelectOption value="linear">선형</NativeSelectOption>
          <NativeSelectOption value="log">로그</NativeSelectOption>
        </NativeSelect>
        <NativeSelect size="sm" value={String(display.clipHigh)} onChange={(e) => setDisplay({ ...display, clipHigh: Number(e.target.value) })} aria-label="상한 백분위">
          <NativeSelectOption value="99">99%</NativeSelectOption>
          <NativeSelectOption value="99.5">99.5%</NativeSelectOption>
          <NativeSelectOption value="99.9">99.9%</NativeSelectOption>
        </NativeSelect>
        <ToggleSwitch label="황도광(ZODI) 빼기" checked={display.subtractZodi} onChange={(v) => setDisplay({ ...display, subtractZodi: v })} />
        <ToggleSwitch label="불량 픽셀 표시" checked={display.showFlags} onChange={(v) => setDisplay({ ...display, showFlags: v })} />
        <ToggleSwitch label="측광 영역" checked={display.showAperture} onChange={(v) => setDisplay({ ...display, showAperture: v })} />
        <ToggleSwitch label="시간 비교" checked={compare} onChange={setCompare} />
      </div>

      {mode === "sky" && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
          <div className="grid gap-1">
            <Label htmlFor="sky-ra" className="text-xs">RA (deg)</Label>
            <Input id="sky-ra" className="h-8 w-32 font-mono" value={raText} onChange={(e) => setRaText(e.target.value)} inputMode="decimal" />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="sky-dec" className="text-xs">Dec (deg)</Label>
            <Input id="sky-dec" className="h-8 w-32 font-mono" value={decText} onChange={(e) => setDecText(e.target.value)} inputMode="decimal" />
          </div>
          <Button size="sm" onClick={applySky}>좌표 적용</Button>
          <Button size="sm" variant="outline" onClick={centerOnComet}>
            <CrosshairIcon /> 현재 혜성 위치
          </Button>
          <p className="w-full text-xs text-muted-foreground">
            하늘 고정: 같은 하늘 좌표를 중심에 두므로 혜성이 이동합니다. 좌표가 해당 노출의 검출기 밖이면 영상이 없습니다.
          </p>
        </div>
      )}
      {mode === "comet" && (
        <p className="text-xs text-muted-foreground">혜성 중심: 관측별 예측 혜성 좌표를 중심에 맞춰 코마 모양을 비교합니다. 배경 별은 움직입니다.</p>
      )}

      {compare && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">비교 대상 (같은 검출기 {selected.detector})</span>
          <NativeSelect size="sm" value={compareEntry?.key ?? ""} onChange={(e) => setCompareKey(e.target.value)} aria-label="비교할 관측">
            {(Object.keys(PERIODS) as PeriodId[]).map((p) => (
              <NativeSelectOptGroup key={p} label={PERIODS[p].label}>
                {compareCandidates
                  .filter((e) => e.period === p)
                  .map((e) => (
                    <NativeSelectOption key={e.key} value={e.key}>
                      {formatUtc(e.utcStart)} · {e.obsId}
                    </NativeSelectOption>
                  ))}
              </NativeSelectOptGroup>
            ))}
          </NativeSelect>
          <ToggleSwitch label="같은 밝기 범위" checked={sameScale} onChange={setSameScale} />
        </div>
      )}

      <PanelPair
        a={selected}
        b={compare ? compareEntry : undefined}
        centerA={centerFor(selected)}
        centerB={compareEntry ? centerFor(compareEntry) : undefined}
        display={display}
        sameScale={sameScale}
        mode={mode}
      />
    </div>
  );
}

function ToggleSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Label className="flex items-center gap-2 text-xs font-normal">
      <Switch size="sm" checked={checked} onCheckedChange={onChange} />
      {label}
    </Label>
  );
}

function PanelPair(props: {
  a: ObservationEntry;
  b?: ObservationEntry;
  centerA: FrameCenter;
  centerB?: FrameCenter;
  display: DisplayOptions;
  sameScale: boolean;
  mode: AlignMode;
}) {
  const frameA = useFrame(props.a, props.centerA);
  const decodedA = useMemo(() => (frameA.data ? decodeFrame(frameA.data) : undefined), [frameA.data]);
  const valuesA = useMemo(() => (decodedA ? displayValues(decodedA, props.display.subtractZodi) : undefined), [decodedA, props.display.subtractZodi]);
  const rangeA = useMemo(() => (valuesA ? percentileRange(valuesA, 1, props.display.clipHigh) : undefined), [valuesA, props.display.clipHigh]);

  return (
    <div className={props.b ? "grid gap-3 sm:grid-cols-2" : "mx-auto grid w-full max-w-md gap-3"}>
      <FramePanel entry={props.a} center={props.centerA} display={props.display} tag="A" mode={props.mode} />
      {props.b && props.centerB && (
        <FramePanel
          entry={props.b}
          center={props.centerB}
          display={props.display}
          tag="B"
          mode={props.mode}
          rangeOverride={props.sameScale ? rangeA : undefined}
          referenceWave={decodedA && props.a ? waveAtComet(decodedA, props.a) : null}
        />
      )}
    </div>
  );
}

function waveAtComet(frame: ReturnType<typeof decodeFrame>, entry: ObservationEntry) {
  const p = cometPixel(frame.payload, entry);
  return p && frame.payload.wave ? wavelengthAt(frame.payload.wave, p.x, p.y) : null;
}

function FramePanel({
  entry,
  center,
  display,
  tag,
  mode,
  rangeOverride,
  referenceWave,
}: {
  entry: ObservationEntry;
  center: FrameCenter;
  display: DisplayOptions;
  tag: string;
  mode: AlignMode;
  rangeOverride?: DisplayRange;
  referenceWave?: { wavelength: number; bandwidth: number } | null;
}) {
  const { aperture } = useCometState();
  const frame = useFrame(entry, center);
  const decoded = useMemo(() => (frame.data ? decodeFrame(frame.data) : undefined), [frame.data]);
  const values = useMemo(() => (decoded ? displayValues(decoded, display.subtractZodi) : undefined), [decoded, display.subtractZodi]);
  const ownRange = useMemo(() => (values ? percentileRange(values, 1, display.clipHigh) : undefined), [values, display.clipHigh]);
  const photometry = useMemo(() => (decoded ? measure(decoded, entry, aperture) : null), [decoded, entry, aperture]);

  if (frame.isPending) {
    return (
      <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed text-xs text-muted-foreground">
        <Spinner />
        {entry.obsId} {entry.detector} 원본 FITS에서 혜성 주변 행만 읽는 중
      </div>
    );
  }
  if (frame.isError || !decoded || !values || !ownRange) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertDescription>
          {tag}: {frame.error?.message ?? "영상을 읽지 못했습니다"}
          <Button size="xs" variant="outline" className="mt-1" onClick={() => frame.refetch()}>
            다시 시도
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const p = cometPixel(decoded.payload, entry);
  const inside = p && p.x >= 0 && p.y >= 0 && p.x < decoded.payload.width && p.y < decoded.payload.height ? p : null;
  const wave = photometry?.wavelengthUm != null ? { wavelength: photometry.wavelengthUm, bandwidth: photometry.bandwidthUm ?? 0 } : null;
  const waveMismatch = referenceWave && wave ? Math.abs(referenceWave.wavelength - wave.wavelength) > Math.max(referenceWave.bandwidth, wave.bandwidth) : false;

  return (
    <div className="flex flex-col gap-2">
      <FitsCanvas
        frame={decoded}
        values={values}
        range={rangeOverride ?? ownRange}
        stretch={display.stretch}
        showFlags={display.showFlags}
        comet={inside}
        aperture={display.showAperture && mode === "comet" ? aperture : undefined}
        label={`${tag} · ${formatUtc(entry.utcStart)} · ${entry.detector}`}
      />
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        <dt className="text-muted-foreground">혜성 위치 파장</dt>
        <dd className="font-mono">
          {wave ? `${wave.wavelength.toFixed(3)} µm (대역폭 ${wave.bandwidth.toFixed(3)})` : "—"}
          {waveMismatch && <Badge variant="outline" className="ml-2">A와 파장 다름</Badge>}
        </dd>
        <dt className="text-muted-foreground">측광 (조리개 {aperture.rAp}px)</dt>
        <dd className="font-mono">
          {photometry ? `${photometry.fluxMjy.toFixed(2)} ± ${photometry.errorMjy.toFixed(2)} mJy (S/N ${photometry.snr.toFixed(1)})` : "—"}
        </dd>
        <dt className="text-muted-foreground">품질</dt>
        <dd>
          {photometry?.quality === "ok" ? (
            <Badge variant="secondary">양호</Badge>
          ) : (
            photometry?.reasons.map((r) => (
              <Badge key={r} variant="outline" className="mr-1">
                {REASON_LABEL[r]}
              </Badge>
            ))
          )}
        </dd>
        <dt className="text-muted-foreground">PSF FWHM · DQA</dt>
        <dd className="font-mono">
          {decoded.payload.header.psfFwhmArcsec?.toFixed(1) ?? "—"}″ · L2 {decoded.payload.header.l2Dqa ?? "—"}
        </dd>
        <dt className="text-muted-foreground">밝기 범위 (표시용)</dt>
        <dd className="font-mono">
          {(rangeOverride ?? ownRange).lo.toFixed(3)} – {(rangeOverride ?? ownRange).hi.toFixed(3)} {decoded.payload.header.bunit}
        </dd>
      </dl>
    </div>
  );
}

export const REASON_LABEL: Record<string, string> = {
  edge: "영상 가장자리",
  masked: "불량 픽셀 포함",
  "low-snr": "S/N < 3",
  "dqa-fail": "DQA 불합격",
  "no-wave": "파장 정보 없음",
};
