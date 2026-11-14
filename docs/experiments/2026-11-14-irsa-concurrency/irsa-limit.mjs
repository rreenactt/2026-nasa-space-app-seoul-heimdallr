// Measures how many concurrent requests IRSA (SIA2, IBE cutouts, DataLink) and the SPHEREx S3 bucket accept.
const RA = 269.4485, DEC = 4.73942;
const sia = (c, r = 0.0005) => `https://irsa.ipac.caltech.edu/SIA?COLLECTION=${c}&POS=${encodeURIComponent(`CIRCLE ${RA} ${DEC} ${r}`)}&RESPONSEFORMAT=CSV`;
function csv(t) {
  const lines = t.trim().split(/\r?\n/);
  const split = (l) => { const o = []; let cur = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { o.push(cur); cur = ""; } else cur += ch; } o.push(cur); return o; };
  const h = split(lines[0]);
  return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [h[i], v])));
}
async function timed(url, init) {
  const t = performance.now();
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) });
    await r.arrayBuffer();
    return { s: r.status, ms: performance.now() - t };
  } catch (e) {
    return { s: e.name === "TimeoutError" ? "timeout" : "err", ms: performance.now() - t };
  }
}
async function burst(label, urls, init) {
  const t = performance.now();
  const rs = await Promise.all(urls.map((u) => timed(u, init)));
  const wall = performance.now() - t;
  const by = {};
  for (const r of rs) by[r.s] = (by[r.s] || 0) + 1;
  const ms = rs.map((r) => r.ms).sort((a, b) => a - b);
  console.log(`${label.padEnd(26)} n=${String(urls.length).padStart(2)} wall=${(wall / 1000).toFixed(1)}s median=${(ms[ms.length >> 1] / 1000).toFixed(1)}s status=${JSON.stringify(by)}`);
}

const which = process.argv[2] ?? "all";
const ns = (process.argv[3] ?? "1,4,8,16").split(",").map(Number);

if (which === "all" || which === "ibe") {
  const rows = csv(await (await fetch(sia("neowiser", 0.05))).text()).filter((r) => r.dataproduct_subtype === "science" && r.energy_bandpassname === "W1");
  const urls = rows.map((r) => `${r.access_url}?center=${RA},${DEC}&size=11.6arcmin`);
  console.log(`NEOWISE W1 exposures: ${urls.length}`);
  let k = 0;
  for (const n of ns) { await burst("IBE cutout (NEOWISE)", Array.from({ length: n }, () => urls[k++ % urls.length])); }
}
if (which === "all" || which === "sia") {
  const cols = ["twomass_allsky", "wise_allsky", "neowiser", "spherex_dr1"];
  for (const n of ns) await burst("SIA2 search", Array.from({ length: n }, (_, i) => sia(cols[i % cols.length], 0.05 + i * 1e-4)));
}
if (which === "all" || which === "s3") {
  const rows = csv(await (await fetch(sia("spherex_dr1"))).text()).filter((r) => r.dataproduct_subtype === "science");
  const dl = await (await fetch(`https://irsa.ipac.caltech.edu/datalink/links/spherex?ID=${encodeURIComponent(rows[0].obs_publisher_did ?? "")}`)).text().catch(() => "");
  const s3 = (dl.match(/https:\/\/nasa-irsa-spherex\.s3[^<"\s]+\.fits/) || [])[0];
  console.log(`S3 url: ${s3 ?? "not found"} (rows ${rows.length})`);
  if (s3) for (const n of ns) await burst("S3 range 64 KB", Array(n).fill(s3), { headers: { Range: `bytes=${(ns.indexOf(n) * 40 + 1) * 65536}-${(ns.indexOf(n) * 40 + 2) * 65536 - 1}` } });
  const self = rows.slice(0, Math.max(...ns)).map((r) => r.access_url);
  for (const n of ns) await burst("IRSA file range 64 KB", Array.from({ length: n }, (_, i) => self[i % self.length]), { headers: { Range: "bytes=65536-131071" } });
}
