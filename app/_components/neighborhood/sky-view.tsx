"use client";

import { useT } from "@/app/_i18n/i18n-provider";
import { closestApproach, modelStatus, skyAt } from "@/app/_lib/nim/motion";
import { STATUS_COLOR } from "./map-3d";
import { formatYear, RANGES, useNim } from "./nim-state";

const W = 720;
const H = 360;
const sx = (ra: number) => ((360 - ra) / 360) * W; // RA increases to the left (sky convention)
const sy = (dec: number) => ((90 - dec) / 180) * H;

/** Track points across the range; breaks the polyline where RA wraps. */
function trackSegments(points: { ra: number; dec: number }[]) {
  const segs: { ra: number; dec: number }[][] = [[]];
  for (let i = 0; i < points.length; i++) {
    if (i > 0 && Math.abs(points[i].ra - points[i - 1].ra) > 180) segs.push([]);
    segs[segs.length - 1].push(points[i]);
  }
  return segs;
}

export function SkyView({ observationYears }: { observationYears: number[] }) {
  const t = useT();
  const { objects, models, selected, selectedId, setSelectedId, year, mode } = useNim();
  const range = RANGES[mode];
  const steps = 120;
  const years = Array.from({ length: steps + 1 }, (_, i) => range.min + ((range.max - range.min) * i) / steps);
  const m = selected ? models.get(selected.id) : undefined;

  // Local track of the selected object, in arcsec/arcmin offsets from its position at `year` (tangent plane).
  const ref = m ? skyAt(m, year) : null;
  const local =
    m && ref
      ? years.map((y) => {
          const s = skyAt(m, y);
          const dRa = (((s.ra - ref.ra + 540) % 360) - 180) * Math.cos((ref.dec * Math.PI) / 180);
          return { y, e: dRa * 3600, n: (s.dec - ref.dec) * 3600 };
        })
      : [];
  const extent = Math.max(1, ...local.map((p) => Math.max(Math.abs(p.e), Math.abs(p.n))));
  const unit = extent > 7200 ? { f: 1 / 3600, l: "°" } : extent > 120 ? { f: 1 / 60, l: "′" } : { f: 1, l: "″" };
  const L = 260;
  const lx = (e: number) => L / 2 - (e / extent) * (L / 2 - 16); // east to the left
  const ly = (n: number) => L / 2 - (n / extent) * (L / 2 - 16);

  const dist = m ? years.map((y) => ({ y, d: skyAt(m, y).distancePc })) : [];
  const dMax = Math.max(...dist.map((p) => p.d), 1);
  const ca = m ? closestApproach(m) : null;
  const DX = (y: number) => 40 + ((y - range.min) / (range.max - range.min)) * 400;
  const DY = (d: number) => 150 - (d / dMax) * 130;

  return (
    <div className="grid gap-4 pt-2">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px] rounded-md bg-slate-950" role="img" aria-label={t("nim.skyMapAria")}>
          {[-60, -30, 0, 30, 60].map((d) => (
            <g key={d}>
              <line x1={0} x2={W} y1={sy(d)} y2={sy(d)} stroke="#1e293b" />
              <text x={4} y={sy(d) - 3} fill="#64748b" fontSize={10}>{d}°</text>
            </g>
          ))}
          {[0, 60, 120, 180, 240, 300].map((r) => (
            <g key={r}>
              <line x1={sx(r)} x2={sx(r)} y1={0} y2={H} stroke="#1e293b" />
              <text x={sx(r) - 22} y={H - 4} fill="#64748b" fontSize={10}>{r / 15}h</text>
            </g>
          ))}
          {objects.map((o) => {
            const mm = models.get(o.id);
            if (!mm) return null;
            const pts = years.map((y) => skyAt(mm, y));
            const now = skyAt(mm, year);
            const isSel = o.id === selectedId;
            const color = STATUS_COLOR[modelStatus(o).level];
            return (
              <g key={o.id} onClick={() => setSelectedId(o.id)} className="cursor-pointer">
                {trackSegments(pts).map((seg, i) => (
                  <polyline key={i} points={seg.map((p) => `${sx(p.ra)},${sy(p.dec)}`).join(" ")} fill="none" stroke={color} strokeOpacity={isSel ? 0.9 : 0.3} strokeWidth={isSel ? 1.5 : 1} />
                ))}
                <circle cx={sx(now.ra)} cy={sy(now.dec)} r={isSel ? 5 : 3} fill={isSel ? "#fff" : color} />
                {isSel && <text x={sx(now.ra) + 7} y={sy(now.dec) - 6} fill="#fff" fontSize={11}>{o.name}</text>}
              </g>
            );
          })}
        </svg>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("nim.skyMapCaption", { year: formatYear(year) })}
        </p>
      </div>

      {m && selected && ref && (
        <div className="grid gap-4 md:grid-cols-2">
          <figure className="grid gap-1">
            <svg viewBox={`0 0 ${L} ${L}`} className="w-full max-w-sm rounded-md bg-slate-950" role="img" aria-label={t("nim.trackAria", { name: selected.name })}>
              <line x1={L / 2} x2={L / 2} y1={8} y2={L - 8} stroke="#1e293b" />
              <line x1={8} x2={L - 8} y1={L / 2} y2={L / 2} stroke="#1e293b" />
              <polyline points={local.map((p) => `${lx(p.e)},${ly(p.n)}`).join(" ")} fill="none" stroke="#7dd3fc" strokeWidth={1.5} />
              {observationYears.map((oy) => {
                const s = skyAt(m, oy);
                const e = (((s.ra - ref.ra + 540) % 360) - 180) * Math.cos((ref.dec * Math.PI) / 180) * 3600;
                const n = (s.dec - ref.dec) * 3600;
                return <rect key={oy} x={lx(e) - 3} y={ly(n) - 3} width={6} height={6} fill="none" stroke="#fbbf24" strokeWidth={1.2} />;
              })}
              <circle cx={lx(0)} cy={ly(0)} r={4} fill="#fff" />
              <text x={L - 22} y={16} fill="#94a3b8" fontSize={10}>N↑</text>
              <text x={6} y={L - 6} fill="#94a3b8" fontSize={10}>←E</text>
              <text x={6} y={16} fill="#94a3b8" fontSize={10}>±{(extent * unit.f).toFixed(unit.l === "″" ? 1 : 2)}{unit.l}</text>
            </svg>
            <figcaption className="text-xs text-muted-foreground">
              {t("nim.trackCaption", { name: selected.name, year: formatYear(year) })}
            </figcaption>
          </figure>
          <figure className="grid gap-1">
            <svg viewBox="0 0 460 180" className="w-full rounded-md bg-slate-950" role="img" aria-label={t("nim.distanceAria", { name: selected.name })}>
              <polyline points={dist.map((p) => `${DX(p.y)},${DY(p.d)}`).join(" ")} fill="none" stroke="#7dd3fc" strokeWidth={1.5} />
              <line x1={DX(year)} x2={DX(year)} y1={14} y2={150} stroke="#fff" strokeOpacity={0.5} />
              {ca && ca.year >= range.min && ca.year <= range.max && <circle cx={DX(ca.year)} cy={DY(ca.distancePc)} r={4} fill="#fbbf24" />}
              <line x1={40} x2={440} y1={150} y2={150} stroke="#334155" />
              <text x={40} y={168} fill="#94a3b8" fontSize={10}>{formatYear(range.min)}</text>
              <text x={440} y={168} fill="#94a3b8" fontSize={10} textAnchor="end">{formatYear(range.max)}</text>
              <text x={4} y={DY(dMax) + 4} fill="#94a3b8" fontSize={10}>{dMax.toFixed(2)} pc</text>
              <text x={4} y={150} fill="#94a3b8" fontSize={10}>0</text>
            </svg>
            <figcaption className="text-xs text-muted-foreground">
              {t("nim.distanceCaption")}{" "}
              {ca && t("nim.closestApproachModel", { year: formatYear(ca.year), distance: ca.distancePc.toFixed(3), ly: (ca.distancePc * 3.26156).toFixed(2) })}
              {selected.radialVelocity ? "" : ` ${t("nim.distanceRvAssumed")}`}
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}
