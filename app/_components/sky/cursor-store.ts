import { useSyncExternalStore } from "react";
import type { EquatorialCoordinates } from "./sky-coordinates";

// The cursor position changes on every mouse move. Keeping it outside React state lets only the readout
// re-render, instead of the sky views that report it.
let cursor: EquatorialCoordinates | null = null;
const listeners = new Set<() => void>();

export function setCursor(next: EquatorialCoordinates | null) {
  cursor = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCursor() {
  return useSyncExternalStore(
    subscribe,
    () => cursor,
    () => null,
  );
}
