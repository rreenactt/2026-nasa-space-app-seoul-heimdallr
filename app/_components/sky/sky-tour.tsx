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
  /** Where the card sits when there is no target: the middle, or low so the sky stays in view. */
  place?: "center" | "low";
};

/** The tour (decision #61, Figma "I · Tour 1–10"). */
export const TOUR_STEPS: TourStep[] = [
  { id: "welcome", scene: "sky", targets: [], title: "tour.welcomeTitle", body: "tour.welcomeBody", primary: "tour.start", skip: "tour.skipShort" },
  { id: "explore", scene: "sky", targets: [], title: "tour.exploreTitle", body: "tour.exploreBody", place: "low" },
  { id: "queue", scene: "queue", targets: ["queue"], title: "tour.queueTitle", body: "tour.queueBody" },
  { id: "open", scene: "queue", targets: ["open-blink"], title: "tour.openTitle", body: "tour.openBody", primary: "tour.openBarnard" },
  { id: "blink", scene: "panel", targets: ["blink"], title: "tour.blinkTitle", body: "tour.blinkBody" },
  { id: "rate", scene: "panel", targets: ["assessment"], title: "tour.rateTitle", body: "tour.rateBody" },
  {
    id: "counts",
    scene: "panel",
    targets: ["rating-badge", "rating-tally"],
    title: "tour.countsTitle",
    body: "tour.countsBody",
    bodyUnrated: "tour.countsBodyUnrated",
    targetsUnrated: ["assessment"],
  },
  { id: "analyses", scene: "panel", targets: ["analyses"], title: "tour.analysesTitle", body: "tour.analysesBody" },
  { id: "tools", scene: "sky", targets: ["tools", "search"], title: "tour.toolsTitle", body: "tour.toolsBody" },
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
    const measure = () => {
      const origin = host === document.body ? { left: 0, top: 0 } : host.getBoundingClientRect();
      const found = key
        .split(" ")
        .filter(Boolean)
        .map((name) => document.querySelector<HTMLElement>(`[data-tour="${name}"]`)?.getBoundingClientRect())
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
function cardPosition(boxes: Box[], size: { w: number; h: number }, view: { w: number; h: number }, place: TourStep["place"]) {
  const clampX = (x: number) => Math.min(Math.max(x, EDGE), view.w - size.w - EDGE);
  const clampY = (y: number) => Math.min(Math.max(y, HEADER), view.h - size.h - EDGE);
  const target = boxes[0];
  if (!target) {
    return { x: clampX((view.w - size.w) / 2), y: clampY(place === "low" ? view.h * 0.62 - size.h / 2 : (view.h - size.h) / 2) };
  }
  if (target.x + target.w + GAP + size.w <= view.w - EDGE) return { x: target.x + target.w + GAP, y: clampY(target.y) };
  if (target.x - GAP - size.w >= EDGE) return { x: target.x - GAP - size.w, y: clampY(target.y) };
  const below = target.y + target.h + GAP;
  return { x: clampX(target.x), y: below + size.h <= view.h - EDGE ? below : clampY(target.y - GAP - size.h) };
}

/** Whether this browser has rated the open place (the step after rating says what changed, or what will). */
function useRated(point: EquatorialCoordinates | null) {
  const state = useRating(point ?? { ra: 0, dec: 0 });
  return !!point && !!state.data?.mine;
}

/**
 * Step-by-step guide over the real screen (decision #61): the step's targets stay lit, the rest is dimmed, and a card
 * beside them says what they do. Nothing is blocked; the reader can try each thing. Esc or Skip ends it.
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
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onFinish();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onFinish]);

  if (!host) return null;
  const last = step === TOUR_STEPS.length - 1;
  const waiting = current.targets.length > 0 && boxes.length === 0;
  const position = cardPosition(boxes, size, view, current.place);
  const body = unrated && current.bodyUnrated ? current.bodyUnrated : current.body;
  const lit = boxes.map((box) => ({ x: box.x - PAD, y: box.y - PAD, w: box.w + PAD * 2, h: box.h + PAD * 2 }));

  return createPortal(
    <div className="font-ui">
      {/* The dim with holes over the targets. It never takes clicks, so everything stays usable. */}
      {(lit.length > 0 || current.place !== "low") && (
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
