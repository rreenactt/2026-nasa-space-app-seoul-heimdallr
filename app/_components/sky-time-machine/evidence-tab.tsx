"use client";

import { ExternalLinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MISSION_ORDER, MISSIONS, PROCESSING_VERSION } from "@/app/_lib/sky/missions";
import { formatPeriod, useStm } from "./stm-state";
import { useEpochFrame, useLoadedFrames } from "./use-sky-data";

const LIMITATIONS = [
  "WISE·NEOWISE 시점은 관측 통과(약 6개월 주기, 며칠간) 안의 단일 노출 최대 5장을 이 도구가 직접 중앙값 합성한 것입니다. 공식 unWISE 시간 분해 합성 영상이 아닙니다(공개 이미지 경로를 찾지 못했습니다).",
  "WISE 단일 노출의 품질 플래그·마스크 파일은 쓰지 않았습니다. 중앙값 합성이 우주선·위성 잔상을 대부분 걸러내지만, 한 장만 쓴 시점에는 남아 있을 수 있습니다.",
  "SPHEREx는 노출마다 이 위치의 파장이 다릅니다. 표시한 파장은 시야 중심 기준이며, 같은 검출기 번호라도 시점마다 파장이 다를 수 있습니다.",
  "SPHEREx의 OUTLIER 플래그는 움직이는 천체를 표시하기도 해서 가리지 않았습니다.",
  "밝기 스케일은 프레임마다 따로 맞춥니다. 서로 다른 미션의 밝기를 비교해 변광을 판단할 수 없습니다.",
  "공통 격자의 픽셀이 더 작아도 해상도가 좋아지지 않습니다(원본 픽셀 크기는 각 시점에 표시).",
  "Gaia 예상 경로는 2016.0 위치에서 선형 고유운동만 적용했습니다(시차·시선속도 무시). 실제 측정 위치와 다를 수 있습니다.",
  "미검출은 감도·파장 차이일 수 있으며, '그때 없던 천체가 생겼다'는 뜻이 아닙니다.",
];

export function EvidenceTab() {
  const { epochs, current, grid, searches, target } = useStm();
  const frame = useEpochFrame(current, grid);
  const loadedFrames = useLoadedFrames(epochs, grid);

  return (
    <div className="grid gap-3 pt-2 text-xs">
      <section className="grid gap-2 rounded-md border p-3">
        <h3 className="text-sm font-medium">① 표시 영역</h3>
        <p className="font-mono">
          중심 RA {target.ra.toFixed(5)}° Dec {target.dec.toFixed(5)}° · 시야 {target.fovArcmin}′ · 격자 {grid.n}×{grid.n} (TAN, 북쪽 위) · 출처 {target.source}
        </p>
      </section>

      <section className="grid gap-2 rounded-md border p-3">
        <h3 className="text-sm font-medium">② 검색 (IRSA SIA2)</h3>
        <ul className="grid gap-1">
          {MISSION_ORDER.map((m, i) => {
            const q = searches[i].data;
            return (
              <li key={m}>
                <span className="font-medium">{MISSIONS[m].label}</span> — {MISSIONS[m].product}
                {q ? (
                  <span className="text-muted-foreground"> · 노출 {q.exposureCount}개 → 관측 통과 {q.epochs.length}개 (대역별) · {q.collections.join(", ")}</span>
                ) : (
                  <span className="text-muted-foreground"> · {searches[i].isError ? `실패: ${searches[i].error?.message}` : "검색 중"}</span>
                )}
                {q?.queryUrls.map((u) => (
                  <div key={u} className="truncate font-mono text-muted-foreground">
                    <a href={u} target="_blank" rel="noreferrer" className="hover:underline">{u}</a>
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="grid gap-2 rounded-md border p-3">
        <h3 className="text-sm font-medium">③ 현재 시점의 원본</h3>
        {!current ? (
          "—"
        ) : !frame.data ? (
          <span className="text-muted-foreground">영상을 받으면 사용한 노출 목록이 표시됩니다.</span>
        ) : (
          <>
            <p>
              {MISSIONS[current.mission].label} {current.wavelengthLabel} · {frame.data.combine} · 실제 사용 노출 기간{" "}
              <span className="font-mono">{formatPeriod(frame.data.timeStart, frame.data.timeEnd)}</span>
              {frame.data.wavelengthUm != null && <> · 시야 중심 파장 {frame.data.wavelengthUm.toFixed(3)} µm</>}
            </p>
            <ul className="grid gap-0.5 font-mono">
              {frame.data.used.map((u) => (
                <li key={u.id} className="truncate">
                  MJD {u.mjd.toFixed(4)} ·{" "}
                  <a href={u.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    {u.url.split("/").pop()} <ExternalLinkIcon className="size-3" />
                  </a>
                </li>
              ))}
              {frame.data.failed.map((f) => (
                <li key={f.id} className="truncate text-destructive">받지 못함 · {f.id} · {f.reason}</li>
              ))}
            </ul>
            <p className="text-muted-foreground">처리: {frame.data.processingVersion}</p>
          </>
        )}
      </section>

      <section className="grid gap-2 rounded-md border p-3">
        <h3 className="text-sm font-medium">④ 전체 시점 목록 (공통 형식)</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>frame_id</TableHead>
                <TableHead>mission · release</TableHead>
                <TableHead>band</TableHead>
                <TableHead>time_start ~ time_end</TableHead>
                <TableHead>노출</TableHead>
                <TableHead>coverage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {epochs.map((e) => {
                const f = loadedFrames.get(e.id);
                return (
                  <TableRow key={e.id} className="font-mono text-[11px]">
                    <TableCell className="max-w-48 truncate">{e.id}</TableCell>
                    <TableCell className="font-sans">{MISSIONS[e.mission].label} · {e.collections.join(", ")}</TableCell>
                    <TableCell>{e.band}</TableCell>
                    <TableCell>{formatPeriod(e.timeStart, e.timeEnd)}</TableCell>
                    <TableCell>{f ? `${f.used.length}/${e.totalExposures}` : `${e.exposures.length}/${e.totalExposures}`}</TableCell>
                    <TableCell>{f ? `${(f.coverage * 100).toFixed(0)}%` : <Badge variant="outline">미수신</Badge>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="text-muted-foreground">time_start ~ time_end는 데이터 공개일이 아니라 실제 관측 시각(SIA2 t_min·t_max)입니다. 처리 버전: {PROCESSING_VERSION}</p>
      </section>

      <section className="grid gap-2 rounded-md border p-3">
        <h3 className="text-sm font-medium">⑤ 한계</h3>
        <ul className="list-disc pl-4 text-muted-foreground">
          {LIMITATIONS.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
