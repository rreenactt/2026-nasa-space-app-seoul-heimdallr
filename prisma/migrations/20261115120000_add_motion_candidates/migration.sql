-- CreateEnum
CREATE TYPE "MotionMatch" AS ENUM ('KNOWN_MOVER', 'GAIA_STATIC', 'UNIDENTIFIED');

-- CreateTable
CREATE TABLE "MotionSurvey" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "release" TEXT NOT NULL,
    "pipelineVersion" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "pointsPlanned" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MotionSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotionSurveyPoint" (
    "id" UUID NOT NULL,
    "surveyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "raDeg" DOUBLE PRECISION NOT NULL,
    "decDeg" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "detector" TEXT,
    "wavelengthUm" DOUBLE PRECISION,
    "spherexVisits" INTEGER,
    "spherexMjd" DOUBLE PRECISION,
    "spherexSources" INTEGER,
    "tmassSources" INTEGER,
    "matchedSources" INTEGER,
    "scatterArcsec" DOUBLE PRECISION,
    "minSeparationArcsec" DOUBLE PRECISION,
    "expectedChancePairs" DOUBLE PRECISION,
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "seconds" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MotionSurveyPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotionCandidate" (
    "id" UUID NOT NULL,
    "surveyId" TEXT NOT NULL,
    "pointId" UUID NOT NULL,
    "release" TEXT NOT NULL,
    "hpxIndex" INTEGER NOT NULL,
    "match" "MotionMatch" NOT NULL,
    "raDeg" DOUBLE PRECISION NOT NULL,
    "decDeg" DOUBLE PRECISION NOT NULL,
    "epochMjd" DOUBLE PRECISION NOT NULL,
    "tmassRaDeg" DOUBLE PRECISION NOT NULL,
    "tmassDecDeg" DOUBLE PRECISION NOT NULL,
    "tmassMjd" DOUBLE PRECISION NOT NULL,
    "tmassDesignation" TEXT NOT NULL,
    "tmassKsMag" DOUBLE PRECISION,
    "separationArcsec" DOUBLE PRECISION NOT NULL,
    "baselineYears" DOUBLE PRECISION NOT NULL,
    "pmRaMasYr" DOUBLE PRECISION NOT NULL,
    "pmDecMasYr" DOUBLE PRECISION NOT NULL,
    "pmTotalMasYr" DOUBLE PRECISION NOT NULL,
    "snr" DOUBLE PRECISION NOT NULL,
    "fluxMjy" DOUBLE PRECISION NOT NULL,
    "detector" TEXT NOT NULL,
    "wavelengthUm" DOUBLE PRECISION NOT NULL,
    "spherexVisits" INTEGER NOT NULL,
    "positionScatterArcsec" DOUBLE PRECISION,
    "obsIds" TEXT[],
    "gaiaSourceId" TEXT,
    "gaiaPmMasYr" DOUBLE PRECISION,
    "gaiaSepArcsec" DOUBLE PRECISION,
    "isSynthetic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MotionCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MotionSurveyPoint_surveyId_idx" ON "MotionSurveyPoint"("surveyId");

-- CreateIndex
CREATE INDEX "MotionCandidate_release_hpxIndex_idx" ON "MotionCandidate"("release", "hpxIndex");

-- CreateIndex
CREATE INDEX "MotionCandidate_match_idx" ON "MotionCandidate"("match");

-- CreateIndex
CREATE INDEX "MotionCandidate_surveyId_idx" ON "MotionCandidate"("surveyId");

-- AddForeignKey
ALTER TABLE "MotionSurveyPoint" ADD CONSTRAINT "MotionSurveyPoint_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "MotionSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotionCandidate" ADD CONSTRAINT "MotionCandidate_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "MotionSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotionCandidate" ADD CONSTRAINT "MotionCandidate_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "MotionSurveyPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

