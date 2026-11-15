/**
 * Builds the star guide's catalog (PLAN.md chapter 9, decision #48): every Gaia DR3 star moving 0.2″ a year or more
 * (about 70,000), saved as a static file so the guide shows the stars in a view at once, with no archive query.
 *
 * Output `public/data/gaia-fast-stars.json`: an array of [ra, dec, pmra, pmdec, parallax] rows, fastest first.
 * ra/dec in degrees at epoch 2016.0 (5 decimals, 0.04″), pmra (includes cos δ) and pmdec in mas/yr (whole numbers),
 * parallax in mas (1 decimal, null when Gaia has none).
 *
 * The ESA archive's synchronous queries stop at 50,000 rows, so the sky is asked in two halves.
 *
 * Usage (from the repo root): npx tsx scripts/fast-stars-catalog.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";

const TAP = "https://gea.esac.esa.int/tap-server/tap/sync";
/** Slowest motion kept, mas/yr (GUIDE_MIN_PM in app/_components/sky/star-guide/use-star-guide.ts). */
const MIN_PM = 200;
const OUT = "public/data/gaia-fast-stars.json";

type Row = [number, number, number, number, number | null];

async function half(condition: string): Promise<Row[]> {
  const query = `SELECT ra, dec, pmra, pmdec, parallax FROM gaiadr3.gaia_source WHERE pm > ${MIN_PM} AND ${condition}`;
  const body = new URLSearchParams({ REQUEST: "doQuery", LANG: "ADQL", FORMAT: "csv", QUERY: query });
  const response = await fetch(TAP, { method: "POST", body });
  if (!response.ok) throw new Error(`ESA Gaia Archive answered ${response.status}`);
  const lines = (await response.text()).trim().split(/\r?\n/).slice(1);
  if (lines.length >= 50_000) throw new Error(`${condition}: hit the 50,000-row limit; split the sky further`);
  return lines.map((line) => {
    const [ra, dec, pmra, pmdec, parallax] = line.split(",");
    return [
      Number(Number(ra).toFixed(5)),
      Number(Number(dec).toFixed(5)),
      Math.round(Number(pmra)),
      Math.round(Number(pmdec)),
      parallax ? Number(Number(parallax).toFixed(1)) : null,
    ];
  });
}

const rows = (await Promise.all([half("dec >= 0"), half("dec < 0")])).flat();
rows.sort((a, b) => Math.hypot(b[2], b[3]) - Math.hypot(a[2], a[3]));
mkdirSync("public/data", { recursive: true });
writeFileSync(OUT, JSON.stringify(rows));
console.log(`${rows.length} stars → ${OUT}`);
