// Times the Sky Time Machine default download against the local server: 4 searches, then every default-band epoch.
const BASE = process.argv[2] ?? "http://localhost:3000";
const PAR = Number(process.argv[3] ?? 8);
const RA = 269.4485, DEC = 4.73942;
const grid = { ra: RA, dec: DEC, fovArcmin: 8, n: 256 };
const bands = { "2mass": "K", wise: "W1", neowise: "W1", spherex: "D3" };
const t0 = performance.now();
const s = (ms) => ((ms - t0) / 1000).toFixed(1) + "s";
const radius = ((grid.fovArcmin / 60) * Math.SQRT2) / 2;
const searches = await Promise.all(Object.keys(bands).map(async (m) => {
  const r = await fetch(`${BASE}/api/sky/search?mission=${m}&ra=${RA}&dec=${DEC}&radius=${radius}`);
  const j = r.ok ? await r.json() : null;
  console.log(`search ${m.padEnd(8)} ${r.status} at ${s(performance.now())} epochs=${j?.epochs?.length ?? "-"}`);
  return j;
}));
const epochs = searches.flatMap((j, i) => (j?.epochs ?? []).filter((e) => e.band === Object.values(bands)[i]));
console.log(`${epochs.length} epochs to read, ${PAR} at a time`);
let next = 0, ok = 0, fail = 0;
const per = {};
const worker = async () => {
  while (next < epochs.length) {
    const e = epochs[next++];
    const t = performance.now();
    const r = await fetch(`${BASE}/api/sky/frame`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ epoch: e, grid }) });
    const j = r.ok ? await r.json() : await r.text();
    if (r.ok) ok++; else fail++;
    (per[e.mission] ??= []).push(((performance.now() - t) / 1000).toFixed(1) + (r.ok ? (j.failed?.length ? `(${j.used.length}/${j.used.length + j.failed.length})` : "") : `!${r.status}`));
  }
};
await Promise.all(Array.from({ length: PAR }, worker));
console.log(`frames done at ${s(performance.now())}: ok=${ok} fail=${fail}`);
for (const [m, v] of Object.entries(per)) console.log(`  ${m}: ${v.join(" ")}`);
