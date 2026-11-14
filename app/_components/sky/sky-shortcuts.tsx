"use client";

import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Keycap } from "../site/keycap";

/** What each key does (decision #40). Kept in one place so the help sheet and the handler never disagree. */
export const SHORTCUT_GROUPS: { title: string; keys: { keys: string[]; label: string }[] }[] = [
  {
    title: "Move",
    keys: [
      { keys: ["+", "−"], label: "Zoom in, zoom out" },
      { keys: ["←", "↑", "→", "↓"], label: "Pan the sky" },
      { keys: ["F"], label: "Full screen, frame off" },
    ],
  },
  {
    title: "Review",
    keys: [
      { keys: ["Q"], label: "Open or fold the review queue" },
      { keys: ["N"], label: "Next place in the queue" },
      { keys: ["P"], label: "Previous place in the queue" },
      { keys: ["Enter"], label: "Analyze the center of the view" },
    ],
  },
  {
    title: "Show",
    keys: [
      { keys: ["C"], label: "Show or hide candidates" },
      { keys: ["L"], label: "Show on sky" },
      { keys: ["/"], label: "Search" },
      { keys: ["?"], label: "This list" },
      { keys: ["Esc"], label: "Close what is open" },
    ],
  },
];

export type ShortcutActions = {
  zoom: (factor: number) => void;
  pan: (dx: number, dy: number) => void;
  fullscreen: () => void;
  queue: () => void;
  next: () => void;
  previous: () => void;
  analyzeCenter: () => void;
  candidates: () => void;
  layers: () => void;
  search: () => void;
  help: () => void;
  escape: () => void;
};

/** Typing in a field, or a modifier held: the keys belong to the browser, not the sky. */
function ignored(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return true;
  const target = event.target instanceof Element ? event.target : null;
  return !!target?.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']");
}

/** Keyboard shortcuts for the sky screen. Disabled while typing (decision #40). */
export function useSkyShortcuts(actions: ShortcutActions, enabled: boolean) {
  const ref = useRef(actions);
  useEffect(() => {
    ref.current = actions;
  }, [actions]);
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (ignored(event)) return;
      const a = ref.current;
      const handlers: Record<string, () => void> = {
        "+": () => a.zoom(1 / 2),
        "=": () => a.zoom(1 / 2),
        "-": () => a.zoom(2),
        _: () => a.zoom(2),
        ArrowLeft: () => a.pan(-1, 0),
        ArrowRight: () => a.pan(1, 0),
        ArrowUp: () => a.pan(0, 1),
        ArrowDown: () => a.pan(0, -1),
        f: a.fullscreen,
        q: a.queue,
        n: a.next,
        p: a.previous,
        Enter: a.analyzeCenter,
        c: a.candidates,
        l: a.layers,
        "/": a.search,
        "?": a.help,
        Escape: a.escape,
      };
      // Enter on a focused button or link keeps its own meaning.
      if (event.key === "Enter" && event.target instanceof Element && event.target.closest("button, a")) return;
      const handler = handlers[event.key.length === 1 ? event.key.toLowerCase() : event.key] ?? handlers[event.key];
      if (!handler) return;
      event.preventDefault();
      handler();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}

/** The keyboard shortcut sheet, opened with ? or Menu > Keyboard shortcuts. */
export function ShortcutSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dark max-w-[640px] rounded-sm border-0 bg-ink/95 p-7 font-ui text-bone ring-0 sm:max-w-[640px]">
        <DialogTitle className="text-base font-medium text-paper">Keyboard shortcuts</DialogTitle>
        <DialogDescription className="text-xs text-ash">Keys do nothing while you type in a field.</DialogDescription>
        <div className="mt-2 grid gap-7 sm:grid-cols-3">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="mb-3 font-data text-[11px] tracking-[0.08em] text-smoke uppercase">{group.title}</h3>
              <dl className="grid gap-2.5">
                {group.keys.map((item) => (
                  <div key={item.label} className="grid gap-1">
                    <dt className="flex gap-1">
                      {item.keys.map((key) => (
                        <Keycap key={key}>{key}</Keycap>
                      ))}
                    </dt>
                    <dd className="text-xs text-bone">{item.label}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
