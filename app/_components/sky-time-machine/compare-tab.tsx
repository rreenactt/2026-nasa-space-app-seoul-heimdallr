"use client";

import { useEffect, useState } from "react";
import { AlertTriangleIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MISSIONS } from "@/app/_lib/sky/missions";
import type { Epoch } from "@/app/_lib/sky/types";
import { FrameView } from "./frame-view";
import { formatElapsed, formatPeriod, useStm } from "./stm-state";
import { TimelineStrip } from "./timeline-tab";

type Mode = "blink" | "side";

function EpochSelect({ label, value, onChange }: { label: string; value: string | undefined; onChange: (id: string) => void }) {
  const { epochs } = useStm();
  return (
    <div className="grid gap-1">
      <Label className="text-xs">{label}</Label>
      <NativeSelect size="sm" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        {epochs.map((e) => (
          <NativeSelectOption key={e.id} value={e.id}>
            {formatPeriod(e.timeStart, e.timeEnd)} · {MISSIONS[e.mission].label} {e.band}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export function CompareTab() {
  const { epochs } = useStm();
  const [aId, setA] = useState<string | undefined>(undefined);
  const [bId, setB] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<Mode>("blink");
  const [blinkMs, setBlinkMs] = useState(800);
  const [showB, setShowB] = useState(false);
  const [hover, setHover] = useState<{ ra: number; dec: number } | null>(null);

  // Defaults: the oldest and the newest stop.
  const a: Epoch | undefined = epochs.find((e) => e.id === aId) ?? epochs[0];
  const b: Epoch | undefined = epochs.find((e) => e.id === bId) ?? epochs[epochs.length - 1];

  useEffect(() => {
    if (mode !== "blink") return;
    const t = setInterval(() => setShowB((v) => !v), blinkMs);
    return () => clearInterval(t);
  }, [mode, blinkMs]);

  const differentBand = a && b && (a.mission !== b.mission || a.band !== b.band);

  return (
    <div className="grid gap-3 pt-2">
      <TimelineStrip value={null} highlight={[a?.id, b?.id].filter(Boolean) as string[]} onSelect={(e) => setB(e.id)} />
      <div className="flex flex-wrap items-end gap-3">
        <EpochSelect label="A (reference)" value={a?.id} onChange={setA} />
        <EpochSelect label="B (comparison)" value={b?.id} onChange={setB} />
        <ToggleGroup variant="outline" size="sm" spacing={0} value={[mode]} onValueChange={(v) => v[0] && setMode(v[0] as Mode)} aria-label="Comparison mode">
          <ToggleGroupItem value="blink">Blink</ToggleGroupItem>
          <ToggleGroupItem value="side">Side by side</ToggleGroupItem>
        </ToggleGroup>
        {mode === "blink" && (
          <NativeSelect size="sm" value={String(blinkMs)} onChange={(e) => setBlinkMs(Number(e.target.value))} aria-label="Blink interval">
            <NativeSelectOption value="400">0.4 s</NativeSelectOption>
            <NativeSelectOption value="800">0.8 s</NativeSelectOption>
            <NativeSelectOption value="1500">1.5 s</NativeSelectOption>
          </NativeSelect>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Click a timeline bar to change B. Both images share the same sky grid, so only objects that moved change position.</p>

      {a && b && (
        <p className="text-xs">
          Time between <span className="font-mono">{formatElapsed(b.timeStart - a.timeStart)}</span> · A {MISSIONS[a.mission].label} {a.wavelengthLabel} · B {MISSIONS[b.mission].label} {b.wavelengthLabel}
        </p>
      )}
      {differentBand && (
        <Alert>
          <AlertTriangleIcon />
          <AlertDescription>
            These observations differ in band, sensitivity and resolution. Use them only to compare positions, and do not read brightness differences as variability. An object seen in only one image may reflect a difference in sensitivity or wavelength.
          </AlertDescription>
        </Alert>
      )}

      {mode === "blink" ? (
        <div className="mx-auto w-full max-w-xl">
          {/* Both frames stay mounted so switching is instant. */}
          <div className={showB ? "hidden" : ""}>
            <FrameView epoch={a} tag="A" crosshair={hover} onHover={setHover} />
          </div>
          <div className={showB ? "" : "hidden"}>
            <FrameView epoch={b} tag="B" crosshair={hover} onHover={setHover} />
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <FrameView epoch={a} tag="A" crosshair={hover} onHover={setHover} />
          <FrameView epoch={b} tag="B" crosshair={hover} onHover={setHover} />
        </div>
      )}
      {hover && (
        <p className="font-mono text-xs text-muted-foreground">
          Cursor RA {hover.ra.toFixed(5)}° Dec {hover.dec.toFixed(5)}° (pink cross at the same position in both images)
        </p>
      )}
    </div>
  );
}
