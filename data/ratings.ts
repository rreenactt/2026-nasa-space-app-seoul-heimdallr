import "server-only";
import { db } from "@/lib/db";
import { Prisma, type RatingChoice } from "@/prisma/client";

export type RatingCell = { release: string; hpxIndex: number };

export type Tally = { total: number; moving: number; notMoving: number; noiseOrArtifact: number };

type Group = { hpxIndex: number; choice: RatingChoice; _count: { _all: number } };

const toTally = (groups: Group[]): Tally => {
  const count = (choice: RatingChoice) => groups.find((g) => g.choice === choice)?._count._all ?? 0;
  const moving = count("MOVING");
  const notMoving = count("NOT_MOVING");
  const noiseOrArtifact = count("NOISE_OR_ARTIFACT");
  return { total: moving + notMoving + noiseOrArtifact, moving, notMoving, noiseOrArtifact };
};

/** Creates or changes the voter's rating. The unique key keeps one row per voter and cell. */
export async function saveRating(cell: RatingCell, voterId: string, choice: RatingChoice, visitCount: number) {
  const upsert = () =>
    db.rating.upsert({
      where: { release_hpxIndex_voterId: { ...cell, voterId } },
      create: { ...cell, voterId, choice, visitCount },
      update: { choice, visitCount },
      select: { id: true },
    });
  try {
    await upsert();
  } catch (error) {
    // Two requests from the same browser can both try to create the row; the loser updates it instead.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") await upsert();
    else throw error;
  }
}

/**
 * For each cell (same release): the voter's choice, and the tally only for cells the voter has rated.
 * Two queries whatever the number of cells.
 */
export async function ratingStates(release: string, hpxIndexes: number[], voterId: string | null) {
  const mine = voterId
    ? await db.rating.findMany({
        where: { release, voterId, hpxIndex: { in: hpxIndexes } },
        select: { hpxIndex: true, choice: true },
      })
    : [];
  const rated = mine.map((row) => row.hpxIndex);
  const groups = rated.length
    ? await db.rating.groupBy({
        by: ["hpxIndex", "choice"],
        where: { release, hpxIndex: { in: rated } },
        _count: { _all: true },
      })
    : [];
  return hpxIndexes.map((hpxIndex) => {
    const choice = mine.find((row) => row.hpxIndex === hpxIndex)?.choice ?? null;
    return { choice, tally: choice ? toTally(groups.filter((g) => g.hpxIndex === hpxIndex)) : null };
  });
}

/** The most rated cells of a release, most first (ties: lower cell index first, so the order is stable). */
export async function mostRatedCells(release: string, limit: number) {
  const groups = await db.rating.groupBy({
    by: ["hpxIndex"],
    where: { release },
    _count: { _all: true },
    orderBy: [{ _count: { hpxIndex: "desc" } }, { hpxIndex: "asc" }],
    take: limit,
  });
  return groups.map((g) => ({ hpxIndex: g.hpxIndex, total: g._count._all }));
}

/** The full tally of each cell that has ratings (same release), for the candidates' statuses. Cells with none are absent. */
export async function cellTallies(release: string, hpxIndexes: number[]): Promise<Map<number, Tally>> {
  if (hpxIndexes.length === 0) return new Map();
  const groups = await db.rating.groupBy({
    by: ["hpxIndex", "choice"],
    where: { release, hpxIndex: { in: hpxIndexes } },
    _count: { _all: true },
  });
  const cells = [...new Set(groups.map((g) => g.hpxIndex))];
  return new Map(cells.map((cell) => [cell, toTally(groups.filter((g) => g.hpxIndex === cell))]));
}
