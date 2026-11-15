import "server-only";
import { db } from "@/lib/db";
import type { MotionMatch, Prisma } from "@/prisma/client";

/**
 * Feature A storage (decision #41): one survey run, every searched point (also the empty ones, absolute
 * principle 5) and the candidate pairs found there. Written only by the survey pipeline, never from a request.
 */

export interface SurveyInput {
  id: string;
  method: string;
  release: string;
  pipelineVersion: string;
  params: Prisma.InputJsonValue;
  pointsPlanned: number;
}

export interface PointInput {
  kind: string;
  label: string;
  raDeg: number;
  decDeg: number;
  status: "searched" | "no-observations" | "too-few-visits" | "failed";
  error?: string;
  detector?: string;
  wavelengthUm?: number;
  spherexVisits?: number;
  spherexMjd?: number;
  spherexSources?: number;
  tmassSources?: number;
  matchedSources?: number;
  scatterArcsec?: number;
  minSeparationArcsec?: number;
  expectedChancePairs?: number;
  seconds?: number;
}

export interface CandidateInput {
  release: string;
  hpxIndex: number;
  match: MotionMatch;
  raDeg: number;
  decDeg: number;
  epochMjd: number;
  tmassRaDeg: number;
  tmassDecDeg: number;
  tmassMjd: number;
  tmassDesignation: string;
  tmassKsMag?: number;
  separationArcsec: number;
  baselineYears: number;
  pmRaMasYr: number;
  pmDecMasYr: number;
  pmTotalMasYr: number;
  snr: number;
  fluxMjy: number;
  detector: string;
  wavelengthUm: number;
  spherexVisits: number;
  positionScatterArcsec?: number;
  obsIds: string[];
  gaiaSourceId?: string;
  gaiaPmMasYr?: number;
  gaiaSepArcsec?: number;
}

/** Creates the survey row (a rerun with the same id keeps the first row's settings). */
export async function createSurvey(survey: SurveyInput) {
  await db.motionSurvey.upsert({ where: { id: survey.id }, create: survey, update: {}, select: { id: true } });
}

/** Stores one searched point and its candidates together, so a point is never half written. */
export async function savePoint(surveyId: string, point: PointInput, candidates: CandidateInput[]) {
  await db.$transaction(async (tx) => {
    const { id } = await tx.motionSurveyPoint.create({
      data: { ...point, surveyId, candidateCount: candidates.length },
      select: { id: true },
    });
    if (candidates.length) {
      await tx.motionCandidate.createMany({ data: candidates.map((c) => ({ ...c, surveyId, pointId: id })) });
    }
  });
}

/** The fields of a candidate the sky screen shows; nothing else leaves the server. */
const REVIEW_CANDIDATE_FIELDS = {
  id: true,
  match: true,
  raDeg: true,
  decDeg: true,
  epochMjd: true,
  tmassDesignation: true,
  separationArcsec: true,
  baselineYears: true,
  pmTotalMasYr: true,
  snr: true,
  detector: true,
  wavelengthUm: true,
  spherexVisits: true,
  gaiaSourceId: true,
  gaiaPmMasYr: true,
  isSynthetic: true,
} as const satisfies Prisma.MotionCandidateSelect;

export type ReviewCandidateRow = Prisma.MotionCandidateGetPayload<{ select: typeof REVIEW_CANDIDATE_FIELDS }>;

const REVIEWED_MATCHES: MotionMatch[] = ["KNOWN_MOVER", "UNIDENTIFIED"];

async function latestSurvey() {
  return db.motionSurvey.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true, release: true } });
}

/**
 * What the sky screen needs from the latest survey run: the candidates people review (known movers as the answer key,
 * unidentified pairs as the open question) and counts for the rest, so nothing is hidden. Gaia static pairs are chance
 * pairs; they are counted but not listed (decision #51).
 */
export async function latestReviewBatch() {
  const survey = await latestSurvey();
  if (!survey) return null;
  const [points, chancePairs, candidates] = await Promise.all([
    db.motionSurveyPoint.groupBy({ by: ["status"], where: { surveyId: survey.id }, _count: { _all: true } }),
    db.motionCandidate.count({ where: { surveyId: survey.id, match: "GAIA_STATIC" } }),
    db.motionCandidate.findMany({
      where: { surveyId: survey.id, match: { in: REVIEWED_MATCHES } },
      orderBy: { snr: "desc" },
      select: REVIEW_CANDIDATE_FIELDS,
    }),
  ]);
  const pointsWith = (status: string) => points.find((group) => group.status === status)?._count._all ?? 0;
  return {
    surveyId: survey.id,
    release: survey.release,
    pointsSearched: pointsWith("searched"),
    pointsFailed: pointsWith("failed"),
    chancePairs,
    candidates,
  };
}

/**
 * One reviewed candidate of the latest survey run, read live (no cache) so a search sees candidates added or removed
 * since the page loaded. A 2MASS designation matches the candidate paired with that 2MASS source; otherwise the
 * candidate nearest the position within `radiusArcsec`. Null when there is none.
 */
export async function findReviewCandidate(
  query: { tmassDesignation: string } | { ra: number; dec: number; radiusArcsec: number },
) {
  const survey = await latestSurvey();
  if (!survey) return null;
  const base = { surveyId: survey.id, match: { in: REVIEWED_MATCHES } };
  if ("tmassDesignation" in query) {
    const row = await db.motionCandidate.findFirst({
      where: { ...base, tmassDesignation: query.tmassDesignation },
      orderBy: { snr: "desc" },
      select: REVIEW_CANDIDATE_FIELDS,
    });
    return row ? { surveyId: survey.id, row } : null;
  }
  const { ra, dec, radiusArcsec } = query;
  const radius = radiusArcsec / 3600;
  const raRadius = radius / Math.max(Math.cos((dec * Math.PI) / 180), 0.01);
  const rows = await db.motionCandidate.findMany({
    where: {
      ...base,
      decDeg: { gte: dec - radius, lte: dec + radius },
      // The RA window can cross 0h, so it may be two ranges.
      OR:
        ra - raRadius < 0 || ra + raRadius >= 360
          ? [
              { raDeg: { gte: (ra - raRadius + 360) % 360 } },
              { raDeg: { lte: (ra + raRadius) % 360 } },
            ]
          : [{ raDeg: { gte: ra - raRadius, lte: ra + raRadius } }],
    },
    select: REVIEW_CANDIDATE_FIELDS,
    take: 20,
  });
  const separation = (row: ReviewCandidateRow) => {
    const dRa = ((((row.raDeg - ra + 540) % 360) - 180) * Math.cos((dec * Math.PI) / 180)) * 3600;
    return Math.hypot(dRa, (row.decDeg - dec) * 3600);
  };
  const nearest = rows
    .map((row) => ({ row, arcsec: separation(row) }))
    .filter(({ arcsec }) => arcsec <= radiusArcsec)
    .sort((a, b) => a.arcsec - b.arcsec)[0];
  return nearest ? { surveyId: survey.id, row: nearest.row } : null;
}
