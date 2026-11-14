import zlib from "node:zlib";
const D = Math.PI / 180;
const path = "7b/47157b/108/47157b108"; // NEOWISE 2014 exposure used above
const RA = 269.4485, DEC = 4.73942;
function hdr(buf) { const s = buf.toString("latin1"); const H = {}; let i = 0; for (; i < s.length; i += 80) { const c = s.slice(i, i + 80); if (c.startsWith("END ")) break; if (c[8] === "=") H[c.slice(0, 8).trim()] = c.slice(10).split("/")[0].trim().replace(/'/g, "").trim(); } return { H, len: Math.ceil((i + 80) / 2880) * 2880 }; }
function pix2sky(H, x, y) { // 0-based pixel, linear CD + SIN, no SIP
  const n = (k) => Number(H[k]); const u = x - (n("CRPIX1") - 1), v = y - (n("CRPIX2") - 1);
  const xi = (n("CD1_1") * u + n("CD1_2") * v) * D, et = (n("CD2_1") * u + n("CD2_2") * v) * D;
  const a0 = n("CRVAL1") * D, d0 = n("CRVAL2") * D; const r = Math.hypot(xi, et), cc = Math.sqrt(1 - r * r);
  const dec = Math.asin(cc * Math.sin(d0) + et * Math.cos(d0)); const ra = a0 + Math.atan2(xi, cc * Math.cos(d0) - et * Math.sin(d0));
  return [ra / D, dec / D];
}
function brightest(get, w, h) { let b = -Infinity, bx = 0, by = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = get(x, y); if (v > b) { b = v; bx = x; by = y; } } return [bx, by]; }
// IBE cutout
let b = Buffer.from(await (await fetch(`https://irsa.ipac.caltech.edu/ibe/data/wise/neowiser/p1bm_frm/${path}-w1-int-1b.fits?center=${RA},${DEC}&size=11.6arcmin`)).arrayBuffer());
if (b[0] === 0x1f) b = zlib.gunzipSync(b);
const I = hdr(b); const iw = +I.H.NAXIS1, ih = +I.H.NAXIS2;
const [ix, iy] = brightest((x, y) => b.readFloatBE(I.len + (y * iw + x) * 4), iw, ih);
console.log("IBE  cutout", iw, "x", ih, "brightest", ix, iy, "sky", pix2sky(I.H, ix, iy).map((v) => v.toFixed(5)).join(" "));
// S3 full frame (whole file, 4 MB)
const s = Buffer.from(await (await fetch(`https://nasa-irsa-wise.s3.us-west-2.amazonaws.com/wise/neowiser/images/p1bm_frm/${path}-w1-int-1b.fits`)).arrayBuffer());
const S = hdr(s); const sw = +S.H.NAXIS1;
// search only near the IBE answer converted to full-frame pixels, to find the same star
const [cx, cy] = [ix + (+S.H.CRPIX1 - +I.H.CRPIX1) * -1, iy + (+S.H.CRPIX2 - +I.H.CRPIX2) * -1];
console.log("CRPIX full", S.H.CRPIX1, S.H.CRPIX2, "cutout", I.H.CRPIX1, I.H.CRPIX2);
const [fx, fy] = brightest((x, y) => { const X = x, Y = y; return X < 0 || Y < 0 || X >= sw || Y >= +S.H.NAXIS2 ? -Infinity : s.readFloatBE(S.len + (Y * sw + X) * 4); }, sw, +S.H.NAXIS2);
console.log("S3   full  brightest", fx, fy, "sky", pix2sky(S.H, fx, fy).map((v) => v.toFixed(5)).join(" "), "(expected from IBE offset:", cx, cy, ")");
