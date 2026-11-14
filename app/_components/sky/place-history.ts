import "client-only";
import { useSyncExternalStore } from "react";
import { angularDistance, type EquatorialCoordinates } from "./sky-coordinates";

/** One place opened in the analysis panel. */
export type PlaceVisit = EquatorialCoordinates & { name?: string; at: number };

const KEY = "heimdallr:opened-places";
const LIMIT = 200;
const EMPTY: PlaceVisit[] = [];

let places: PlaceVisit[] | null = null;
const listeners = new Set<() => void>();

/**
 * Places this browser opened, newest first (decision #39). Kept in this browser only and never sent anywhere; storage
 * may be unavailable (private windows), in which case history lasts until the page closes.
 */
function read(): PlaceVisit[] {
  if (places) return places;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    places = Array.isArray(parsed)
      ? parsed.filter(
          (item): item is PlaceVisit =>
            typeof item?.ra === "number" && typeof item?.dec === "number" && typeof item?.at === "number",
        )
      : [];
  } catch {
    places = [];
  }
  return places;
}

function write(next: PlaceVisit[]) {
  places = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: keep the in-memory copy.
  }
  listeners.forEach((listener) => listener());
}

/** Records a visit; reopening a place moves it to the top instead of adding it twice. */
export function recordPlace(place: EquatorialCoordinates & { name?: string }) {
  const rest = read().filter((visit) => !samePlace(visit, place));
  write([{ ra: place.ra, dec: place.dec, name: place.name, at: Date.now() }, ...rest].slice(0, LIMIT));
}

export function clearPlaces() {
  write([]);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePlaceHistory() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Within one arcsecond: the same place. */
export function samePlace(a: EquatorialCoordinates, b: EquatorialCoordinates) {
  return angularDistance(a, b) <= 1 / 3600;
}
