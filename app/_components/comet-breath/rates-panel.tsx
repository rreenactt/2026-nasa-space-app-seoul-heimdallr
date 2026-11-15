"use client";

import { useState } from "react";
import { InfoIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAPERS, PAPER_STATEMENTS, PUBLISHED_RATES } from "@/app/_lib/comet/published";
import type { PublishedRate } from "@/app/_lib/comet/types";
import { useT } from "@/app/_i18n/i18n-provider";
import type { MessageKey } from "@/app/_i18n/message-keys";
import { useCometState } from "./comet-state";

const SPECIES_ORDER = ["H₂O", "CO₂", "CO", "¹³CO₂", "C-H organics"];
const LOG_MIN = 24.8;
const LOG_MAX = 28.4;
const STATUS_LABEL: Record<PublishedRate["status"], MessageKey> = { detection: "comet.statusDetection", tentative: "comet.statusTentative", "upper-limit": "comet.statusUpperLimit" };

export function formatRate(q: number) {
  const exp = Math.floor(Math.log10(q));
  return `${(q / 10 ** exp).toFixed(1)}×10${toSuperscript(exp)}`;
}
function toSuperscript(n: number) {
  const map: Record<string, string> = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  return String(n).split("").map((c) => map[c] ?? c).join("");
}
const paperName = (id: string) => PAPERS.find((p) => p.id === id)?.shortName ?? id;

function seriesOf(r: PublishedRate): "aug" | "dec" | "prelim" {
  if (r.superseded) return "prelim";
  return r.periodStart.startsWith("2025-12") ? "dec" : "aug";
}
const SERIES = {
  aug: { label: "2025-08-01 ~ 08-15 (Lisse+2025b)", color: "var(--series-1)", dy: -7 },
  dec: { label: "2025-12-08 ~ 12-15 (Lisse+2026)", color: "var(--series-2)", dy: 7 },
  prelim: { label: "August initial analysis (same observations, superseded)", color: "var(--muted-foreground)", dy: 0 },
} as const;

export function RatesPanel() {
  const t = useT();
  const { selected } = useCometState();
  const [showPrelim, setShowPrelim] = useState(false);
  const [hover, setHover] = useState<PublishedRate | null>(null);

  const rates = PUBLISHED_RATES.filter((r) => showPrelim || !r.superseded);
  const date = selected?.utcStart.slice(0, 10);
  const covering = date ? PUBLISHED_RATES.filter((r) => !r.superseded && r.periodStart <= date && date <= r.periodEnd) : [];
  const coveringPapers = [...new Set(covering.map((r) => r.sourceId))];

  const W = 640;
  const left = 96;
  const right = 16;
  const rowH = 40;
  const top = 12;
  const H = top + SPECIES_ORDER.length * rowH + 28;
  const x = (q: number) => left + ((Math.log10(q) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * (W - left - right);
  const rowY = (species: string) => top + SPECIES_ORDER.indexOf(species) * rowH + rowH / 2;

  return (
    <div className="flex flex-col gap-4 pt-2">
      <Alert>
        <InfoIcon />
        <AlertTitle>{t("comet.selectedObservation", { date: date ?? "—" })}</AlertTitle>
        <AlertDescription>
          {coveringPapers.length > 0
            ? t("comet.coveredBy", { papers: coveringPapers.map(paperName).join(", ") })
            : t("comet.notCovered")}
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{t("comet.ratesHeading")}</h3>
        <Label className="flex items-center gap-2 text-xs font-normal">
          <Switch size="sm" checked={showPrelim} onCheckedChange={setShowPrelim} /> {t("comet.showPrelim")}
        </Label>
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" role="img" aria-label={t("comet.ratesAria")}>
          {[25, 26, 27, 28].map((e) => (
            <g key={e}>
              <line x1={x(10 ** e)} x2={x(10 ** e)} y1={top} y2={H - 28} className="stroke-border" />
              <text x={x(10 ** e)} y={H - 10} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                10{toSuperscript(e)}
              </text>
            </g>
          ))}
          {SPECIES_ORDER.map((s) => (
            <text key={s} x={left - 10} y={rowY(s) + 4} textAnchor="end" className="fill-foreground text-xs">
              {s}
            </text>
          ))}
          {rates.map((r) => {
            const series = SERIES[seriesOf(r)];
            const cy = rowY(r.species) + series.dy;
            const cx = x(r.productionRate);
            const active = hover?.id === r.id;
            return (
              <g
                key={r.id}
                onMouseEnter={() => setHover(r)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(r)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                className="outline-none"
              >
                <rect x={cx - 14} y={cy - 9} width={28} height={18} fill="transparent" />
                {r.uncertainty != null && (
                  <line
                    x1={x(Math.max(10 ** LOG_MIN, r.productionRate - r.uncertainty))}
                    x2={x(r.productionRate + r.uncertainty)}
                    y1={cy}
                    y2={cy}
                    stroke={series.color}
                    strokeWidth={2}
                    strokeOpacity={0.55}
                  />
                )}
                {r.status === "upper-limit" ? (
                  <g stroke={series.color} strokeWidth={2} fill="none">
                    <line x1={cx} x2={cx} y1={cy - 6} y2={cy + 6} />
                    <path d={`M${cx} ${cy} H${cx - 22} M${cx - 16} ${cy - 5} L${cx - 22} ${cy} L${cx - 16} ${cy + 5}`} />
                  </g>
                ) : (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={active ? 6 : 5}
                    fill={r.status === "tentative" || r.superseded ? "var(--background)" : series.color}
                    stroke={r.status === "tentative" || r.superseded ? series.color : "var(--background)"}
                    strokeWidth={2}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        {(["aug", "dec", ...(showPrelim ? (["prelim"] as const) : [])] as const).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: SERIES[k].color }} /> {k === "prelim" ? t("comet.seriesPrelim") : SERIES[k].label}
          </span>
        ))}
        <span>{t("comet.ratesLegend")}</span>
      </div>

      <p className="min-h-5 text-xs" aria-live="polite">
        {hover
          ? t("comet.ratesHover", {
              species: hover.species,
              paper: paperName(hover.sourceId),
              status: t(STATUS_LABEL[hover.status]),
              le: hover.status === "upper-limit" ? "≤ " : "",
              rate: formatRate(hover.productionRate),
              uncertainty: hover.uncertaintyNote,
              location: hover.location,
            })
          : t("comet.ratesHoverHint")}
      </p>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("comet.colSpecies")}</TableHead>
              <TableHead>{t("comet.colPeriod")}</TableHead>
              <TableHead className="text-right">{t("comet.colRate")}</TableHead>
              <TableHead>{t("comet.colUncertainty")}</TableHead>
              <TableHead>{t("comet.colStatus")}</TableHead>
              <TableHead>{t("comet.colMethod")}</TableHead>
              <TableHead>{t("comet.colSource")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.map((r) => (
              <TableRow key={r.id} className={r.superseded ? "text-muted-foreground" : undefined}>
                <TableCell>{r.species}</TableCell>
                <TableCell className="font-mono text-xs">
                  {r.periodStart} ~ {r.periodEnd.slice(5)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {r.status === "upper-limit" ? "≤ " : ""}
                  {formatRate(r.productionRate)}
                </TableCell>
                <TableCell className="text-xs">{r.uncertaintyNote}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "detection" ? "secondary" : "outline"}>{t(STATUS_LABEL[r.status])}</Badge>
                  {r.superseded && <Badge variant="outline" className="ml-1">{t("comet.superseded")}</Badge>}
                </TableCell>
                <TableCell className="max-w-64 text-xs whitespace-normal">
                  {r.method} · {r.aperture}
                </TableCell>
                <TableCell className="text-xs whitespace-normal">
                  {t("comet.citedFrom", { paper: paperName(r.sourceId), location: r.location })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-1.5 rounded-md border p-3">
        <h4 className="text-xs font-medium">{t("comet.statementsHeading")}</h4>
        <ul className="list-disc pl-4 text-xs text-muted-foreground">
          {PAPER_STATEMENTS.map((s) => (
            <li key={s.text}>
              {s.text} — {paperName(s.sourceId)} {s.location}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
