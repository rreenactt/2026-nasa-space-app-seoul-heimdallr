"use client";

import { AlertCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { MISSIONS } from "@/app/_lib/sky/missions";
import { mjdToYear } from "@/app/_lib/sky/wcs";
import type { Epoch } from "@/app/_lib/sky/types";
import { useT } from "@/app/_i18n/i18n-provider";
import { SkyCanvas, type CanvasOverlay } from "./sky-canvas";
import { formatPeriod, useStm } from "./stm-state";
import { frameData, useEpochFrame, useGaia } from "./use-sky-data";

/** One epoch rendered on the common grid, with the shared overlays (marks, Gaia path, crosshair). */
export function FrameView({
  epoch,
  tag,
  crosshair,
  onPick,
  onHover,
}: {
  epoch: Epoch | undefined;
  tag?: string;
  crosshair?: { ra: number; dec: number } | null;
  onPick?: Parameters<typeof SkyCanvas>[0]["onPick"];
  onHover?: Parameters<typeof SkyCanvas>[0]["onHover"];
}) {
  const t = useT();
  const { grid, marks, showGaia, epochs } = useStm();
  const frame = useEpochFrame(epoch, grid);
  const gaia = useGaia(grid, showGaia);

  if (!epoch) {
    return <div className="flex aspect-square items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">{t("stm.noDate")}</div>;
  }
  const data = frame.data ? frameData(frame.data) : null;
  const mid = frame.data ? (frame.data.timeStart + frame.data.timeEnd) / 2 : (epoch.timeStart + epoch.timeEnd) / 2;
  const overlay: CanvasOverlay = {
    marks,
    currentEpochId: epoch.id,
    year: mjdToYear(mid),
    gaia: showGaia ? gaia.data?.stars : undefined,
    gaiaPathYears: epochs.map((e) => mjdToYear((e.timeStart + e.timeEnd) / 2)),
    crosshair,
  };
  const label = `${tag ? `${tag} · ` : ""}${MISSIONS[epoch.mission].label} ${epoch.band} · ${formatPeriod(frame.data?.timeStart ?? epoch.timeStart, frame.data?.timeEnd ?? epoch.timeEnd)}`;

  return (
    <SkyCanvas grid={grid} data={data} label={label} overlay={overlay} onPick={data ? onPick : undefined} onHover={onHover}>
      {frame.isPending && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 text-xs text-white">
          <Spinner />
          {t("stm.fetching", { mission: MISSIONS[epoch.mission].label })}
        </div>
      )}
      {frame.isError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 p-4 text-center text-xs text-white">
          <AlertCircleIcon className="size-4" />
          {frame.error.message}
          <Button size="xs" variant="secondary" onClick={() => frame.refetch()}>
            {t("stm.retry")}
          </Button>
        </div>
      )}
    </SkyCanvas>
  );
}
