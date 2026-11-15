/**
 * Precomputes what the analysis panel downloads for known places, so they open without loading (decision #55).
 *
 * It sends the same requests the browser sends (the basic blink analysis from blink-context.tsx and every additional
 * analysis through prefetchAnalysis in app/_components/analyses/prefetch.ts) to a local server started with
 * RESPONSE_CACHE_WRITE=1, which stores each successful answer in R2 (app/api/_server/response-cache.ts). Production
 * then reads those answers instead of the archives. Rerunning is cheap: stored answers come back from R2, and only
 * the ones that failed before (archive outages) are computed again.
 *
 * Places: the five test targets (pin and SPHEREx-epoch position) and the review candidates of the latest survey run
 * (`scripts/motion-survey.ts targets <file>` writes them).
 *
 *   RESPONSE_CACHE_WRITE=1 pnpm start --port 3100        # in another terminal, after pnpm build
 *   NODE_PATH=node_modules/next/dist/compiled npx tsx scripts/precompute-analyses.ts <targets.json> [http://localhost:3100]
 *
 * Environment: PAR places at once (default 3), ONLY=test|candidates, LIMIT=n places.
 */
import { appendFileSync, readFileSync } from "node:fs";
import { QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/ky";
import type { BlinkPlan } from "@/app/_lib/blink/types";
import { prefetchAnalysis, type AnalysisId } from "@/app/_components/analyses/prefetch";
import { spherexFrameQuery } from "@/app/_components/fake-planet-lab/use-fpl-data";
import { TEST_TARGETS } from "@/app/_components/sky/test-targets";

const [targetsFile, base = "http://localhost:3100"] = process.argv.slice(2);
if (!targetsFile) {
  console.log("usage: precompute-analyses.ts <targets.json> [base url]");
  process.exit(1);
}

// The client code calls same-origin paths ("/api/…"); in Node they need the server's origin.
const NativeRequest = globalThis.Request;
globalThis.Request = class extends NativeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(typeof input === "string" && input.startsWith("/") ? new URL(input, base) : input, init);
  }
} as typeof Request;

/** Must match blink-context.tsx (cutout size of the basic analysis). */
const BLINK_CUTOUT_PX = 48;
/** Must match analyses-context.tsx (Sky Time Machine field when opened from the panel). */
const STM_FOV_ARCMIN = 8;
const ANALYSES: AnalysisId[] = ["sky-time-machine", "fake-planet-lab", "sky-sonata", "neighborhood-in-motion"];
const PAR = Number(process.env.PAR ?? 3);

interface Place {
  label: string;
  ra: number;
  dec: number;
  detector?: string;
}

const tally = { ok: 0, failed: 0 };

async function attempt(task: () => Promise<unknown>) {
  try {
    await task();
    tally.ok++;
    return true;
  } catch {
    tally.failed++;
    return false;
  }
}

async function pool<T>(items: T[], limit: number, run: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await run(items[next++]);
  }));
}

/** The basic analysis (blink-context.tsx): plan, every used exposure, Gaia stars per visit date. */
async function blink(qc: QueryClient, p: Place) {
  const plan = await api
    .get("/api/blink/plan", { searchParams: { ra: p.ra, dec: p.dec, ...(p.detector ? { detector: p.detector } : {}) }, timeout: 65_000 })
    .json<BlinkPlan>();
  tally.ok++;
  const tasks: (() => Promise<unknown>)[] = [];
  for (const v of plan.visits ?? []) {
    const used = v.exposures.filter((e) => !e.excluded);
    for (const e of used) tasks.push(() => qc.fetchQuery(spherexFrameQuery(e, p.ra, p.dec, BLINK_CUTOUT_PX)));
    if (used.length) {
      const mjd = used.reduce((s, e) => s + (e.tStart + e.tEnd) / 2, 0) / used.length;
      const epoch = 2000 + (mjd - 51544.5) / 365.25;
      tasks.push(() =>
        api.get("/api/fpl/neighbors", { searchParams: { ra: p.ra, dec: p.dec, radius: 130, maxG: 16, epoch }, timeout: 65_000 }).json(),
      );
    }
  }
  await pool(tasks, 8, async (t) => void (await attempt(t)));
}

async function place(p: Place) {
  const started = Date.now();
  const before = { ...tally };
  // A fresh client per place, as a page load would have; nothing is reused between places.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await attempt(() => blink(qc, p));
  for (const id of ANALYSES) {
    let failed = 0;
    await prefetchAnalysis(id, {
      qc,
      ra: p.ra,
      dec: p.dec,
      stmFovArcmin: STM_FOV_ARCMIN,
      signal: { cancelled: false },
      onProgress: (progress) => void (failed = progress.failed),
    }).then(
      () => (tally.failed += failed),
      () => tally.failed++,
    );
  }
  qc.clear();
  const line = `${((Date.now() - started) / 1000).toFixed(0).padStart(4)}s failed ${tally.failed - before.failed} ${p.label}`;
  console.log(line);
  appendFileSync("precompute.log", `${new Date().toISOString()} ${line}\n`);
}

async function main() {
  const file = JSON.parse(readFileSync(targetsFile, "utf8")) as { targets: { id: string; match: string; ra: number; dec: number; name: string }[] };
  const test: Place[] = TEST_TARGETS.flatMap((t) => [
    { label: `test ${t.name} (pin)`, ra: t.ra, dec: t.dec, detector: t.defaultDetector?.detector },
    { label: `test ${t.name} (${t.spherexPosition.epoch})`, ra: t.spherexPosition.ra, dec: t.spherexPosition.dec, detector: t.defaultDetector?.detector },
  ]);
  // Unidentified pairs first: they are the ones people review.
  const candidates: Place[] = [...file.targets]
    .sort((a, b) => Number(b.match === "UNIDENTIFIED") - Number(a.match === "UNIDENTIFIED"))
    .map((c) => ({ label: `${c.match} ${c.name}`, ra: c.ra, dec: c.dec }));
  let places = process.env.ONLY === "test" ? test : process.env.ONLY === "candidates" ? candidates : [...test, ...candidates];
  if (process.env.LIMIT) places = places.slice(0, Number(process.env.LIMIT));

  // Comet Breath has one fixed object (3I/ATLAS): once for every place.
  await prefetchAnalysis("comet-breath", {
    qc: new QueryClient(),
    ra: 0,
    dec: 0,
    stmFovArcmin: STM_FOV_ARCMIN,
    signal: { cancelled: false },
    onProgress: () => {},
  }).catch(() => tally.failed++);

  let n = 0;
  await pool(places, PAR, async (p) => {
    await place(p);
    if (++n % 10 === 0) console.log(`--- ${n}/${places.length} places, ${tally.ok} answers, ${tally.failed} failed`);
  });
  console.log(`done: ${places.length} places, ${tally.ok} answers, ${tally.failed} failed (rerun to retry the failures)`);
}

void main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
