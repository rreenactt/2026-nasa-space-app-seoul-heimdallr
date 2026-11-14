const q = (c) => fetch(`https://irsa.ipac.caltech.edu/SIA?COLLECTION=${c}&POS=${encodeURIComponent("CIRCLE 269.4485 4.73942 0.05")}&RESPONSEFORMAT=CSV`).then((r) => r.text());
for (const c of ["neowiser", "wise_allsky", "wise_3bandcryo", "wise_2bandcryo"]) {
  const lines = (await q(c)).split(/\n/).filter((l) => /w1-int-1b\.fits/.test(l));
  const keys = lines.map((l) => l.match(/"key":\s*"([^"]+)"/)?.[1]);
  const urls = lines.map((l) => l.match(/https:\/\/irsa\.ipac\.caltech\.edu\/ibe\/data\/\S+?w1-int-1b\.fits/)?.[0]);
  if (!lines.length) { console.log(c, "none"); continue; }
  console.log(c, lines.length, "\n  ibe:", urls[0], "\n  key:", keys[0], "\n  bucket/region:", lines[0].match(/"bucket_name":\s*"([^"]+)".*"region":\s*"([^"]+)"/)?.slice(1).join(" "));
  const s3 = keys.slice(0, 20).map((k) => `https://nasa-irsa-wise.s3.us-west-2.amazonaws.com/${k}`);
  const t = performance.now();
  const rs = await Promise.all(s3.map((u) => fetch(u, { headers: { Range: "bytes=0-14399" } }).then(async (r) => [r.status, Buffer.from(await r.arrayBuffer()).toString("latin1")])));
  const h = rs[0][1];
  console.log(`  ${s3.length} parallel:`, JSON.stringify(rs.reduce((o, [s]) => ((o[s] = (o[s] || 0) + 1), o), {})), `${Math.round(performance.now() - t)}ms`, (h.match(/(BITPIX|NAXIS1|NAXIS2|MAGZP) *= *[-\d.]+/g) || []).join(" "));
}
