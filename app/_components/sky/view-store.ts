import { useSyncExternalStore } from "react";
import type { SkyView } from "./sky-coordinates";

// The view center and field of view change on every frame of a drag, zoom or flight. Keeping them outside React state
// lets only what shows them (the field of view readout) re-render, and lets handlers read the latest view.
let view: SkyView | null = null;
const listeners = new Set<() => void>();

export function setView(next: SkyView) {
  view = next;
  listeners.forEach((listener) => listener());
}

/** The latest view, for event handlers; null before the sky is ready. */
export function getView() {
  return view;
}

export function subscribeView(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useView() {
  return useSyncExternalStore(subscribeView, getView, () => null);
}
