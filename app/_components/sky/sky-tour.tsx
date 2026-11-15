"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "cn";
import { useT } from "@/app/_i18n/i18n-provider";
import type { MessageKey } from "@/app/_i18n/message-keys";
import type { EquatorialCoordinates } from "./sky-coordinates";
import { useRating } from "./use-ratings";

/**
 * What the screen must show for a step; the sky explorer sets it up (opens the queue, opens Barnard's Star, closes the
 * panel) whenever the step changes.
 */
export type TourScene = "sky" | "queue" | "panel";

type TourStep = {
  id: string;
  scene: TourScene;
  /** `data-tour` names to light up; none puts the card in the middle with no spotlight. */
  targets: string[];
  /**
   * `data-tour` names that respond to the pointer and keys on this step (Figma "I · Tour · interaction note"); the
   * targets when left out. Everything else is ignored, so only what the step teaches can be used.
   */
  allow?: string[];
  /** Names inside an allowed area that still do not respond (step 3: the queue, but not its Open blink or Next). */
  deny?: string[];
  /** Keys that work on this step besides Tab and Esc (step 10: ? for the shortcut sheet). */
  keys?: string[];
  /** What the card sits beside, when not the first target (step 4: beside the queue, not over it). */
  beside?: string;
  /** Line the card up with the bottom of what it sits beside instead of the top (step 4, Figma "I · Tour 4"). */
  alignBottom?: boolean;
  /** Put the card under the target, right edges lined up (step 9: the Copy link button top right of the panel). */
  under?: boolean;
  title: MessageKey;
  body: MessageKey;
  /**
   * Body and targets when this browser has not rated the open place (the "your rating counts" step, Figma "I · Tour 7 ·
   * Your rating counts · not rated yet"): there is no tally yet, so the rating buttons are lit instead.
   */
  bodyUnrated?: MessageKey;
  targetsUnrated?: string[];
  primary?: MessageKey;
  skip?: MessageKey;
  /**
   * Where the card sits when there is no target: the middle, low so the sky stays in view, or just under the middle
   * (under the panel's progress bar while the images download).
   */
  place?: "center" | "low" | "underCenter";
};

/** The tour (decision #61, Figma "I · Tour 1–10"). */
export const TOUR_STEPS: TourStep[] = [
  { id: "welcome", scene: "sky", targets: [], title: "tour.welcomeTitle", body: "tour.welcomeBody", primary: "tour.start", skip: "tour.skipShort" },
  { id: "explore", scene: "sky", targets: [], allow: ["sky", "panel-close"], title: "tour.exploreTitle", body: "tour.exploreBody", place: "low" },
  { id: "queue", scene: "queue", targets: ["queue"], deny: ["open-blink", "queue-step"], title: "tour.queueTitle", body: "tour.queueBody" },
  { id: "open", scene: "queue", targets: ["open-blink"], allow: ["open-blink", "queue-step"], beside: "queue", alignBottom: true, title: "tour.openTitle", body: "tour.openBody", primary: "tour.openBarnard" },
  { id: "blink", scene: "panel", targets: ["blink"], title: "tour.blinkTitle", body: "tour.blinkBody" },
  { id: "rate", scene: "panel", targets: ["assessment"], title: "tour.rateTitle", body: "tour.rateBody" },
  {
    id: "counts",
    scene: "panel",
    targets: ["rating-badge", "rating-tally"],
    allow: ["assessment", "rating-badge"],
    title: "tour.countsTitle",
    body: "tour.countsBody",
    bodyUnrated: "tour.countsBodyUnrated",
    targetsUnrated: ["assessment"],
  },
  { id: "analyses", scene: "panel", targets: ["analyses"], allow: ["analyses", "blink"], title: "tour.analysesTitle", body: "tour.analysesBody" },
  {
    id: "share",
    scene: "panel",
    targets: ["copy-link"],
    under: true,
    title: "tour.shareTitle",
    body: "tour.shareBody",
  },
  { id: "tools", scene: "sky", targets: ["tools", "search"], keys: ["?"], title: "tour.toolsTitle", body: "tour.toolsBody" },
  { id: "done", scene: "sky", targets: [], title: "tour.doneTitle", body: "tour.doneBody", primary: "tour.openQueue", skip: "tour.close" },
];

const CARD_WIDTH = 320;
const GAP = 16;
const EDGE = 16;
const HEADER = 64;
const PAD = 6;

type Box = { x: number; y: number; w: number; h: number };

/** While the analysis panel (a modal dialog) is open, the tour lives inside it so its buttons can be pressed. */
function usePortalHost(step: number) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const find = () => {
      const next = document.querySelector<HTMLElement>('[data-slot="dialog-content"]') ?? document.body;
      setHost((current) => (current === next ? current : next));
    };
    find();
    const timer = setInterval(find, 250);
    return () => clearInterval(timer);
  }, [step]);
  return host;
}

/**
 * The boxes of the step's targets in the host's coordinates, followed as the screen moves (flights, panels opening,
 * images loading). Missing targets are left out; none found means the card waits in the middle.
 */
function useTargetBoxes(targets: string[], host: HTMLElement | null) {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const key = targets.join(" ");
  useEffect(() => {
    if (!host) return;
    let last = "";
    let scrolled = false;
    const measure = () => {
      const origin = host === document.body ? { left: 0, top: 0 } : host.getBoundingClientRect();
      const elements = key
        .split(" ")
        .filter(Boolean)
        .map((name) => document.querySelector<HTMLElement>(`[data-tour="${name}"]`));
      // The first time a target shows, bring it into view (the analyses list sits low in the panel's right column).
      if (!scrolled && elements[0]) {
        scrolled = true;
        elements[0].scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
      const found = elements
        .map((element) => element?.getBoundingClientRect())
        .filter((rect): rect is DOMRect => !!rect && rect.width > 0 && rect.height > 0)
        .map((rect) => ({ x: rect.left - origin.left, y: rect.top - origin.top, w: rect.width, h: rect.height }));
      const text = JSON.stringify(found);
      if (text !== last) {
        last = text;
        setBoxes(found);
      }
    };
    measure();
    const timer = setInterval(measure, 200);
    return () => clearInterval(timer);
  }, [key, host]);
  return boxes;
}

/** Beside the first target where it fits (right, then left, then below or above), kept on screen. */
function cardPosition(
  boxes: Box[],
  size: { w: number; h: number },
  view: { w: number; h: number },
  { place, alignBottom, under }: Pick<TourStep, "place" | "alignBottom" | "under">,
) {
  const clampX = (x: number) => Math.min(Math.max(x, EDGE), view.w - size.w - EDGE);
  const clampY = (y: number) => Math.min(Math.max(y, HEADER), view.h - size.h - EDGE);
  const target = boxes[0];
  if (!target) {
    const y = place === "low" ? view.h * 0.62 - size.h / 2 : place === "underCenter" ? view.h / 2 + 96 : (view.h - size.h) / 2;
    return { x: clampX((view.w - size.w) / 2), y: clampY(y) };
  }
  if (under) return { x: clampX(target.x + target.w - size.w), y: clampY(target.y + target.h + GAP) };
  const y = clampY(alignBottom ? target.y + target.h - size.h : target.y);
  if (target.x + target.w + GAP + size.w <= view.w - EDGE) return { x: target.x + target.w + GAP, y };
  if (target.x - GAP - size.w >= EDGE) return { x: target.x - GAP - size.w, y };
  const below = target.y + target.h + GAP;
  return { x: clampX(target.x), y: below + size.h <= view.h - EDGE ? below : clampY(target.y - GAP - size.h) };
}

/** Pop-ups only open from a trigger the step allows (Search, the layers panel, tool tips), so they may be used. */
const POPUPS = ['[data-slot="popover-content"]', '[data-slot="tooltip-content"]', '[data-slot="dropdown-menu-content"]', '[data-slot="dropdown-menu-sub-content"]'];
const POINTER_EVENTS = ["pointerdown", "mousedown", "touchstart", "click", "dblclick", "auxclick", "contextmenu"] as const;
const RELEASE_EVENTS = ["pointerup", "mouseup", "touchend"] as const;
const ACTIVATION_KEYS = new Set(["Enter", " "]);

/**
 * Only what the step teaches responds (Figma "I · Tour · interaction note"). Every press, wheel and key outside the
 * step's allowed areas is stopped before the page sees it, and the rest of the screen takes no pointer (no hover
 * either). The card and Esc (end the tour) always work; scrolling works inside what responds. With the images open on a sky step (step 2), Esc closes them instead.
 */
function useStepOnly(step: TourStep, card: React.RefObject<HTMLDivElement | null>, onFinish: () => void) {
  useEffect(() => {
    const allow = (step.allow ?? [...step.targets, ...(step.targetsUnrated ?? [])]).map((name) =>
      // The analysis panel's close button (shadcn source, so it carries no tour name).
      name === "panel-close" ? '[data-slot="dialog-close"]' : `[data-tour="${name}"]`,
    );
    if (step.id === "tools") allow.push('[data-slot="dialog-content"]'); // the shortcut sheet opened with ?
    const deny = (step.deny ?? []).map((name) => `[data-tour="${name}"]`);
    // Blocked parts take no pointer at all, so they show no hover, highlight or pointer cursor either.
    // Covers (useCovers) take the pointer so a press on a blocked control stops on them, not on the sky underneath.
    const open = [...allow, ...POPUPS, '[aria-labelledby="tour-title"]', '[data-tour="cover"]'].join(", ");
    const lock = document.createElement("style");
    lock.textContent = [
      "html[data-tour-lock] body * { pointer-events: none !important; }",
      `html[data-tour-lock] :is(${open}), html[data-tour-lock] :is(${open}) * { pointer-events: auto !important; }`,
      deny.length ? `html[data-tour-lock] :is(${deny.join(", ")}), html[data-tour-lock] :is(${deny.join(", ")}) * { pointer-events: none !important; }` : "",
    ].join("\n");
    document.head.appendChild(lock);
    document.documentElement.dataset.tourLock = "";
    const allowed = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      if (card.current?.contains(target)) return true;
      if (deny.some((selector) => target.closest(selector))) return false;
      return [...allow, ...POPUPS].some((selector) => target.closest(selector));
    };
    const stop = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    // A press that was stopped stops its release too, so the sky never reads half a click.
    let held = false;
    const onPress = (event: Event) => {
      if (allowed(event.target)) return;
      if (event.type === "pointerdown" || event.type === "mousedown" || event.type === "touchstart") held = true;
      stop(event);
    };
    const onRelease = (event: Event) => {
      if (!held) return;
      stop(event);
      // pointerup comes first; mouseup or touchend ends the press.
      if (event.type !== "pointerup") held = false;
    };
    const onWheel = (event: WheelEvent) => {
      // Zooming the sky only where the step allows it; scrolling a list or the panel is always fine.
      const onSky = event.target instanceof Element && event.target.closest('[data-tour="sky"]');
      if (onSky && !allowed(event.target)) stop(event);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const panelOpen = step.scene === "sky" && document.querySelector('[data-slot="dialog-content"]');
        if (panelOpen) return;
        stop(event);
        onFinish();
        return;
      }
      if (event.key === "Tab" || step.keys?.includes(event.key)) return;
      // In an allowed area keys press buttons and type (Search); they never reach the screen's
      // shortcuts, which would open what the step does not teach (Q for the queue, for one).
      const target = event.target;
      const typing = target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if (allowed(target) && (typing || ACTIVATION_KEYS.has(event.key))) return;
      stop(event);
    };
    for (const type of POINTER_EVENTS) window.addEventListener(type, onPress, { capture: true, passive: false });
    for (const type of RELEASE_EVENTS) window.addEventListener(type, onRelease, { capture: true, passive: false });
    window.addEventListener("wheel", onWheel, { capture: true, passive: false });
    window.addEventListener("keydown", onKey, true);
    return () => {
      lock.remove();
      delete document.documentElement.dataset.tourLock;
      for (const type of POINTER_EVENTS) window.removeEventListener(type, onPress, true);
      for (const type of RELEASE_EVENTS) window.removeEventListener(type, onRelease, true);
      window.removeEventListener("wheel", onWheel, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [step, card, onFinish]);
}

const NO_COVERS: Box[] = [];
const CONTROLS = 'button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="slider"], [role="menuitem"]';

/**
 * On a step where the sky responds (step 2), a blocked control that takes no pointer would let a press fall through to
 * the sky under it. Clear covers over those controls catch the press instead (Figma "I · Tour · interaction note").
 */
function useCovers(step: TourStep, host: HTMLElement | null) {
  const [covers, setCovers] = useState<Box[]>([]);
  const active = !!step.allow?.includes("sky");
  useEffect(() => {
    if (!active || !host) return;
    let last = "";
    const measure = () => {
      const origin = host === document.body ? { left: 0, top: 0 } : host.getBoundingClientRect();
      const found = [...document.querySelectorAll<HTMLElement>(CONTROLS)]
        .filter((element) => !element.closest('[aria-labelledby="tour-title"], [data-slot="dialog-close"]'))
        .map((element) => element.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map((rect) => ({ x: rect.left - origin.left, y: rect.top - origin.top, w: rect.width, h: rect.height }));
      const text = JSON.stringify(found);
      if (text !== last) {
        last = text;
        setCovers(found);
      }
    };
    measure();
    const timer = setInterval(measure, 200);
    return () => clearInterval(timer);
  }, [active, host]);
  return active ? covers : NO_COVERS;
}

/** Whether this browser has rated the open place (the step after rating says what changed, or what will). */
function useRated(point: EquatorialCoordinates | null) {
  const state = useRating(point ?? { ra: 0, dec: 0 });
  return !!point && !!state.data?.mine;
}

/**
 * Step-by-step guide over the real screen (decision #61): the step's targets stay lit, the rest is dimmed, and a card
 * beside them says what they do. Only what the step teaches responds, so the reader can try exactly that. Esc or Skip
 * ends it.
 */
export function SkyTour({
  step,
  point,
  onStep,
  onFinish,
  onDone,
}: {
  step: number;
  /** The place the panel shows, for the rating step. */
  point: EquatorialCoordinates | null;
  onStep: (step: number) => void;
  /** Skip, Close or Esc. */
  onFinish: () => void;
  /** The last step's main button. */
  onDone: () => void;
}) {
  const t = useT();
  const current = TOUR_STEPS[step];
  const host = usePortalHost(step);
  const rated = useRated(current.bodyUnrated ? point : null);
  const unrated = !!current.bodyUnrated && !rated;
  const boxes = useTargetBoxes(unrated && current.targetsUnrated ? current.targetsUnrated : current.targets, host);
  const besideBoxes = useTargetBoxes(current.beside ? [current.beside] : [], host);
  const covers = useCovers(current, host);
  const card = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const [size, setSize] = useState({ w: CARD_WIDTH, h: 200 });
  const [view, setView] = useState({ w: 1280, h: 720 });

  useLayoutEffect(() => {
    if (!host) return;
    const measure = () => {
      const rect = host === document.body ? { width: window.innerWidth, height: window.innerHeight } : host.getBoundingClientRect();
      setView({ w: rect.width, h: rect.height });
      if (card.current) setSize({ w: card.current.offsetWidth, h: card.current.offsetHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [host, step, boxes, rated]);

  useEffect(() => {
    primary.current?.focus({ preventScroll: true });
  }, [step, host]);

  // Esc ends the tour before the panel or the queue hear it.
  useStepOnly(current, card, onFinish);

  if (!host) return null;
  const last = step === TOUR_STEPS.length - 1;
  const waiting = current.targets.length > 0 && boxes.length === 0;
  const position = cardPosition(current.beside && besideBoxes.length ? besideBoxes : boxes, size, view, {
    ...current,
    // While the images download, the card sits under the progress bar (Figma "I · Tour 5–8 · images still downloading").
    place: waiting ? "underCenter" : current.place,
  });
  const body = unrated && current.bodyUnrated ? current.bodyUnrated : current.body;
  const lit = boxes.map((box) => ({ x: box.x - PAD, y: box.y - PAD, w: box.w + PAD * 2, h: box.h + PAD * 2 }));

  return createPortal(
    <div className="font-ui">
      {/* The dim with holes over the targets. It never takes clicks, so everything stays usable. */}
      {!waiting && (lit.length > 0 || current.place !== "low") && (
        <svg aria-hidden className="pointer-events-none fixed inset-0 z-[70] size-full">
          <defs>
            <mask id="tour-holes">
              <rect width="100%" height="100%" fill="white" />
              {lit.map((box, index) => (
                <rect key={index} x={box.x} y={box.y} width={box.w} height={box.h} rx="4" fill="black" />
              ))}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="black" fillOpacity={lit.length ? 0.6 : 0.45} mask="url(#tour-holes)" />
          {lit.map((box, index) => (
            <rect key={index} x={box.x} y={box.y} width={box.w} height={box.h} rx="4" fill="none" className="stroke-paper/90" />
          ))}
        </svg>
      )}
      {covers.map((box, index) => (
        <div
          key={index}
          aria-hidden
          data-tour="cover"
          className="fixed z-[70] cursor-default"
          style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
        />
      ))}
      <div
        ref={card}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        style={{ left: position.x, top: position.y, width: CARD_WIDTH }}
        className="fixed z-[71] rounded-[2px] border border-rule bg-ink/92 px-[18px] pt-4 pb-4 text-bone shadow-lg transition-[left,top] duration-300 ease-out-expo"
      >
        <p className="font-data text-[11px] text-smoke">{t("tour.stepOf", { n: step + 1, total: TOUR_STEPS.length })}</p>
        <h2 id="tour-title" className="mt-1.5 text-[15px] font-medium text-paper">
          {t(current.title)}
        </h2>
        <p className="mt-1.5 text-xs leading-[17px] text-ash">{t(body)}</p>
        {waiting && <p className="mt-2 text-xs leading-[17px] text-smoke">{t("tour.waiting")}</p>}
        <div className="mt-4 flex items-center gap-4">
          <button type="button" onClick={onFinish} className="text-xs text-smoke hover:text-paper">
            {t(current.skip ?? "tour.skip")}
          </button>
          {step > 0 && (
            <button type="button" onClick={() => onStep(step - 1)} className="ml-auto text-[13px] font-medium text-paper">
              {t("tour.back")}
            </button>
          )}
          <button
            ref={primary}
            type="button"
            onClick={() => (last ? onDone() : onStep(step + 1))}
            className={cn(
              "h-[30px] rounded-[2px] bg-paper px-3.5 text-[13px] font-medium text-ink hover:bg-bone",
              step === 0 && "ml-auto",
            )}
          >
            {t(current.primary ?? "tour.next")}
          </button>
        </div>
      </div>
    </div>,
    host,
  );
}
