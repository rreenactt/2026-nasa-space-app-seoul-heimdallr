"use client";

import { useMemo, useState } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { APERTURE_BAD_FLAGS } from "@/app/_lib/comet/photometry";
import { LIMITATIONS, PAPERS } from "@/app/_lib/comet/published";
import { formatUtc, useCometState } from "./comet-state";
import { decodeFrame, measure, useFrame, useGeometry } from "./use-comet-data";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-mono break-all">{children}</dd>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2 rounded-md border p-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">
      {children}
      <ExternalLinkIcon className="size-3 shrink-0" />
    </a>
  );
}

export function EvidencePanel() {
  const { selected, listSource, aperture } = useCometState();
  const [loadPixels, setLoadPixels] = useState(false);
  const [loadGeometry, setLoadGeometry] = useState(false);
  const center = selected ? { ra: selected.cometRa, dec: selected.cometDec } : undefined;
  const frame = useFrame(loadPixels ? selected : undefined, center);
  const geometry = useGeometry(loadGeometry ? selected?.mjdMid : undefined);
  const decoded = useMemo(() => (frame.data ? decodeFrame(frame.data) : undefined), [frame.data]);
  const phot = useMemo(() => (decoded && selected ? measure(decoded, selected, aperture) : null), [decoded, selected, aperture]);

  if (!selected) return null;

  return (
    <div className="grid gap-3 pt-2 text-xs">
      <Section title="① 관측 목록 항목 (혜성 전용 목록)">
        <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">
          <Row label="obs_id / 검출기">{selected.obsId} / {selected.detector}</Row>
          <Row label="t_min – t_max">{formatUtc(selected.utcStart)} – {formatUtc(selected.utcEnd)} ({selected.exptimeS.toFixed(1)} s)</Row>
          <Row label="comet_ra, comet_dec">{selected.cometRa.toFixed(6)}, {selected.cometDec.toFixed(6)}</Row>
          <Row label="s_ra, s_dec (영상 중심)">{selected.imageRa.toFixed(6)}, {selected.imageDec.toFixed(6)}</Row>
          <Row label="em_min – em_max">{selected.emMinUm.toFixed(4)} – {selected.emMaxUm.toFixed(4)} µm (검출기 전체 범위)</Row>
          <Row label="obs_collection">{selected.listCollection}</Row>
          <Row label="access_url">{selected.accessUrl}</Row>
          <Row label="access_format">{selected.accessFormat}</Row>
          <Row label="목록 출처">{listSource && <ExtLink href={listSource}>{listSource}</ExtLink>}</Row>
        </dl>
      </Section>

      <Section title="② 실제 사용한 픽셀 파일">
        {!loadPixels ? (
          <Button size="sm" variant="outline" className="w-fit" onClick={() => setLoadPixels(true)}>
            원본 파일 확인하기 (필요한 행만 읽기)
          </Button>
        ) : frame.isPending ? (
          <span className="flex items-center gap-2 text-muted-foreground"><Spinner /> DataLink로 DR1 대응 파일을 확인하는 중…</span>
        ) : frame.isError ? (
          <span className="text-destructive">{frame.error.message}</span>
        ) : (
          decoded && (
            <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">
              <Row label="릴리스">{decoded.payload.release} (목록의 {selected.listCollection} DataLink는 파일 없음 → 같은 obs_id·검출기로 {decoded.payload.release} DataLink 조회, #this 이미지 확인)</Row>
              <Row label="DataLink"><ExtLink href={decoded.payload.datalinkUrl}>{decoded.payload.datalinkUrl}</ExtLink></Row>
              <Row label="L2b 원본 FITS"><ExtLink href={decoded.payload.fileUrl}>{decoded.payload.fileUrl}</ExtLink></Row>
              <Row label="실제 읽은 범위">{decoded.payload.pixelSource}</Row>
              <Row label="DATE-OBS / MJD-AVG">{decoded.payload.header.dateObs} / {decoded.payload.header.mjdAvg}</Row>
              <Row label="DQA (L1 / L2)">{decoded.payload.header.l1Dqa} / {decoded.payload.header.l2Dqa}</Row>
              <Row label="PSF FWHM">{decoded.payload.header.psfFwhmArcsec?.toFixed(2)}″</Row>
              <Row label="단위">{decoded.payload.header.bunit} (표면 밝기)</Row>
            </dl>
          )
        )}
      </Section>

      <Section title="③ 처리 조건">
        <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">
          <Row label="조리개">반경 {aperture.rAp} px (논문 12″ ≈ 2 px)</Row>
          <Row label="배경">{aperture.rIn}–{aperture.rOut} px 고리, 3σ 클리핑 중앙값{aperture.maskSourcesInAnnulus ? ", SOURCE 플래그 제외" : ""}</Row>
          <Row label="제외 플래그">조리개: {APERTURE_BAD_FLAGS.join(", ")} · 배경 고리: 여기에 OUTLIER 추가 (파이프라인이 이동하는 혜성 핵을 OUTLIER로 표시하므로 조리개에서는 제외하지 않음)</Row>
          <Row label="화소 입체각">
            {decoded?.payload.header.omegaMedianArcsec2 != null ? `${decoded.payload.header.omegaMedianArcsec2.toFixed(3)} arcsec² (OMEGA_MEDIAN)` : "OMEGA_MEDIAN (픽셀 파일 확인 후 표시)"}
          </Row>
          <Row label="플럭스 변환">Σ(I − B)·Ω, MJy/sr → mJy; 오차 = √(ΣVAR + A²σ_B²/N)·Ω</Row>
          <Row label="파장">WCS-WAVE 근사 조회표, 혜성 픽셀에서 이중선형 보간</Row>
          <Row label="표시 영상">스트레치·ZODI 차감은 화면용이며 측광에는 쓰지 않음</Row>
          {phot && (
            <Row label="이 관측 측광">
              λ {phot.wavelengthUm?.toFixed(3)} µm · {phot.fluxMjy.toFixed(2)} ± {phot.errorMjy.toFixed(2)} mJy · 배경 {phot.backgroundMjySr.toFixed(4)} MJy/sr (N={phot.annulusPixels}) · 조리개 사용률 {(phot.apertureCoverage * 100).toFixed(0)}%
            </Row>
          )}
        </dl>
      </Section>

      <Section title="④ 관측 기하 (JPL Horizons)">
        {!loadGeometry ? (
          <Button size="sm" variant="outline" className="w-fit" onClick={() => setLoadGeometry(true)}>
            거리 조회
          </Button>
        ) : geometry.isPending ? (
          <span className="flex items-center gap-2 text-muted-foreground"><Spinner /> Horizons 조회 중…</span>
        ) : geometry.isError ? (
          <span className="text-destructive">{geometry.error.message}</span>
        ) : (
          <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">
            <Row label="rₕ (태양–혜성)">{geometry.data.rHelAu.toFixed(4)} au</Row>
            <Row label="Δ (관측자–혜성)">{geometry.data.deltaAu.toFixed(4)} au</Row>
            <Row label="기준">{geometry.data.center} · MJD {geometry.data.mjd.toFixed(4)} · {geometry.data.source}</Row>
            <Row label="주의">지구 중심 기준 거리입니다. 영상의 혜성 위치는 목록의 comet_ra/dec만 사용합니다.</Row>
          </dl>
        )}
      </Section>

      <Section title="⑤ 참고 논문">
        <ul className="grid gap-1.5">
          {PAPERS.map((p) => (
            <li key={p.id}>
              <ExtLink href={p.url}>{p.shortName}</ExtLink> — {p.title}
              <div className="text-muted-foreground">{p.version} · {p.data}</div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="⑥ 한계">
        <ul className="list-disc pl-4 text-muted-foreground">
          {LIMITATIONS.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
