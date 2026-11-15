"use client";

import { useEffect, useRef } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { Keycap } from "../site/keycap";

/**
 * What each key does (decision #40), grouped as in Figma "I · Explore, keyboard shortcuts". Kept in one place so the
 * help sheet and the handler never disagree. F keeps a label that says what it really does here.
 */
export const SHORTCUT_GROUPS: { title: string; column: 0 | 1; keys: { keys: string[]; or?: boolean; label: string }[] }[] = [
  {
    title: "Sky",
    column: 0,
    keys: [
      { keys: ["+", "−"], or: true, label: "Zoom in or out" },
      { keys: ["←", "↑", "→", "↓"], label: "Look around" },
      { keys: ["F"], label: "Full screen, frame off" },
    ],
  },
  {
    title: "Candidates",
    column: 0,
    keys: [
      { keys: ["C"], label: "Show or hide candidates" },
      { keys: ["N"], label: "Next place" },
      { keys: ["P"], label: "Previous place" },
      { keys: ["Enter"], label: "Open the selected place, or the view center" },
    ],
  },
  {
    title: "Panels",
    column: 1,
    keys: [
      { keys: ["Q"], label: "Open or fold the review queue" },
      { keys: ["L"], label: "Show on sky (layers)" },
      { keys: ["/"], label: "Search" },
      { keys: ["?"], label: "This list" },
      { keys: ["Esc"], label: "Close the top panel" },
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
  /** Enter: the place picked in the queue, else the view center (decision #48). */
  open: () => void;
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
        Enter: a.open,
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

/**
 * The keyboard shortcut sheet, opened with ? or Menu > Keyboard shortcuts (Figma "I · Explore, keyboard shortcuts"):
 * 680px, two columns with the keys beside their meaning, over a 55% black dim without blur.
 */
export function ShortcutSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-ink/55 supports-backdrop-filter:backdrop-blur-none" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(680px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-rule bg-ink/94 font-ui text-bone outline-none data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0">
          <div className="flex items-center justify-between border-b border-rule px-6 py-[18px]">
            <DialogTitle className="text-lg font-light text-paper">Keyboard shortcuts</DialogTitle>
            <DialogPrimitive.Close className="flex items-center gap-1.5 text-[13px] text-ash hover:text-paper">
              Close
              <Keycap>Esc</Keycap>
            </DialogPrimitive.Close>
          </div>
          <div className="grid gap-x-10 px-6 pt-5 pb-1 sm:grid-cols-2">
            {[0, 1].map((column) => (
              <div key={column}>
                {SHORTCUT_GROUPS.filter((group) => group.column === column).map((group) => (
                  <section key={group.title} className="mb-4">
                    <h3 className="mb-2.5 text-xs text-ash">{group.title}</h3>
                    <dl className="grid gap-2.5">
                      {group.keys.map((item) => (
                        <div key={item.label} className="grid grid-cols-[112px_minmax(0,1fr)] items-center">
                          <dt className="flex items-center gap-1">
                            {item.keys.map((key, index) => (
                              <span key={key} className="flex items-center gap-1">
                                {item.or && index > 0 && <span className="px-0.5 text-[11px] text-smoke">or</span>}
                                <Keycap>{key}</Keycap>
                              </span>
                            ))}
                          </dt>
                          <dd className="text-[13px] text-bone">{item.label}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}
              </div>
            ))}
          </div>
          <DialogDescription className="border-t border-rule px-6 py-3.5 text-[11.5px] text-smoke">
            Shortcuts pause while you type in a field.
          </DialogDescription>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
