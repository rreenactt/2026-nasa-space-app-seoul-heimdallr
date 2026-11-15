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

/**
 * What the sky screen needs from the latest survey run: the candidates people review (known movers as the answer key,
 * unidentified pairs as the open question) and counts for the rest, so nothing is hidden. Gaia static pairs are chance
 * pairs; they are counted but not listed (decision #48).
 */
export async function latestReviewBatch() {
  const survey = await db.motionSurvey.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, release: true },
  });
  if (!survey) return null;
  const [points, chancePairs, candidates] = await Promise.all([
    db.motionSurveyPoint.groupBy({ by: ["status"], where: { surveyId: survey.id }, _count: { _all: true } }),
    db.motionCandidate.count({ where: { surveyId: survey.id, match: "GAIA_STATIC" } }),
    db.motionCandidate.findMany({
      where: { surveyId: survey.id, match: { in: ["KNOWN_MOVER", "UNIDENTIFIED"] } },
      orderBy: { snr: "desc" },
      select: {
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
      },
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
