const RA = 269.4485, DEC = 4.73942;
async function timed(url, init) {
  const t = performance.now();
  try { const r = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) }); const b = await r.arrayBuffer(); return { s: r.status, ms: performance.now() - t, b }; }
  catch (e) { return { s: e.name, ms: performance.now() - t }; }
}
async function burst(label, urls, initOf) {
  const t = performance.now();
  const rs = await Promise.all(urls.map((u, i) => timed(u, initOf?.(i))));
  const by = {}; for (const r of rs) by[r.s] = (by[r.s] || 0) + 1;
  const ms = rs.map((r) => r.ms).sort((a, b) => a - b);
  console.log(`${label.padEnd(24)} n=${String(urls.length).padStart(2)} wall=${((performance.now() - t) / 1000).toFixed(1)}s median=${(ms[ms.length >> 1] / 1000).toFixed(2)}s status=${JSON.stringify(by)}`);
  return rs;
}
const t = await (await fetch(`https://irsa.ipac.caltech.edu/SIA?COLLECTION=spherex_dr1&POS=${encodeURIComponent(`CIRCLE ${RA} ${DEC} 0.0005`)}&RESPONSEFORMAT=CSV`)).text();
const lines = t.trim().split(/\r?\n/); const h = lines[0].split(",");
const rows = lines.slice(1).map((l) => Object.fromEntries(l.split(",").map((v, i) => [h[i], v]))).filter((r) => r.dataproduct_subtype === "science");
const dl = rows.map((r) => `https://irsa.ipac.caltech.edu/datalink/links/spherex?ID=${encodeURIComponent(`ivo://irsa.ipac/spherex_dr1?${r.obs_id}/${r.energy_bandpassname.replace("SPHEREx-", "")}`)}`);

const one = await (await fetch(dl[0])).text();
const ca = one.match(/\{&quot;aws&quot;.*?\}\}|\{"aws".*?\}\}/)?.[0]?.replace(/&quot;/g, '"');
const aws = ca ? JSON.parse(ca).aws : null;
const s3 = aws ? `https://${aws.bucket_name}.s3.${aws.region ?? "us-east-1"}.amazonaws.com/${aws.key}` : null;
console.log("S3:", s3);
for (const n of [5, 10, 20, 40, 80]) await burst("S3 range 64 KB", Array(n).fill(s3), (i) => ({ headers: { Range: `bytes=${(n + i) * 131072}-${(n + i) * 131072 + 65535}` } }));
for (const n of [1, 4, 8]) await burst("IRSA ibe file range", rows.slice(0, n).map((r) => r.access_url), () => ({ headers: { Range: "bytes=65536-131071" } }));
