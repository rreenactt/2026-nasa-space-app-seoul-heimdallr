"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/ky";
import type { MostRatedPlace, RatingChoiceId, RatingState } from "@/app/_lib/ratings/types";
import type { EquatorialCoordinates } from "./sky-coordinates";

/** Every rating query starts with this key, so a new rating refreshes the panel header and the list together. */
const RATINGS_KEY = "ratings";

/** This browser's rating of a point, and the tally once rated. Shared by the panel header and the rating section. */
export function useRating({ ra, dec }: EquatorialCoordinates) {
  return useQuery({
    queryKey: [RATINGS_KEY, "point", ra, dec],
    queryFn: () => api.get("/api/ratings", { searchParams: { ra, dec } }).json<RatingState>(),
  });
}

export function useRate({ ra, dec }: EquatorialCoordinates) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ choice, visitCount }: { choice: RatingChoiceId; visitCount: number }) =>
      api.put("/api/ratings", { json: { ra, dec, choice, visitCount } }).json<RatingState>(),
    onSuccess: (state) => {
      qc.setQueryData([RATINGS_KEY, "point", ra, dec], state);
      void qc.invalidateQueries({ queryKey: [RATINGS_KEY, "summary"] });
      void qc.invalidateQueries({ queryKey: [RATINGS_KEY, "top"] });
    },
  });
}

/** Rating states of several points, in order (the "Places to analyze" list). */
export function useRatingSummary(points: EquatorialCoordinates[]) {
  const param = points.map((p) => `${p.ra},${p.dec}`).join(";");
  return useQuery({
    queryKey: [RATINGS_KEY, "summary", param],
    queryFn: () => api.get("/api/ratings/summary", { searchParams: { points: param } }).json<RatingState[]>(),
    enabled: points.length > 0,
  });
}

/** The most rated places, fetched while the board is open and refreshed every minute ("Most rated places"). */
export function useMostRated(enabled: boolean) {
  return useQuery({
    queryKey: [RATINGS_KEY, "top"],
    queryFn: () => api.get("/api/ratings/top").json<MostRatedPlace[]>(),
    enabled,
    refetchInterval: 60_000,
  });
}
