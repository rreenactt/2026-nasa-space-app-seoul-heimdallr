-- CreateEnum
CREATE TYPE "RatingChoice" AS ENUM ('MOVING', 'NOT_MOVING', 'NOISE_OR_ARTIFACT');

-- CreateTable
CREATE TABLE "Rating" (
    "id" UUID NOT NULL,
    "release" TEXT NOT NULL,
    "hpxIndex" INTEGER NOT NULL,
    "voterId" UUID NOT NULL,
    "choice" "RatingChoice" NOT NULL,
    "visitCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rating_release_hpxIndex_voterId_key" ON "Rating"("release", "hpxIndex", "voterId");

