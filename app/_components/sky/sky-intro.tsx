"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/app/_i18n/i18n-provider";
import "./sky-intro.css";

const WORD = "HEIMDALLR";
const SEEN_KEY = "heimdallr:intro-seen";
/**
 * How much slower than the Figma timings (3.2 s) the intro runs: 1.7 makes it about 5.4 s. The CSS reads the same
 * value as --intro-tempo, so this one number sets every phase.
 */
const TEMPO = 1.7;
/** Phase starts in ms at Figma speed, from "Sky screen · Directions" → "I · Intro 1–4". */
const LETTERS_AT = 400;
const REVEAL_AT = 2000;
const END_AT = 3200;
/**
 * When each letter switches on (ms). Out of order and uneven, as in frame 2 where H, I, M and the first L are lit
 * first; all are on by 1.2 s.
 */
const LETTER_ON = [400, 720, 480, 560, 820, 900, 620, 1060, 980];

/**
 * The intro (decision #37), built to the Figma frames "I · Intro 1–4" (3.2 s there, × TEMPO here):
 * 1. 0.0–0.4 s: black; a 1px line warms up across the middle like a lamp striking.
 * 2. 0.4–1.2 s: letters switch on one by one with an uneven flicker and a soft glow; unlit letters sit at 8%.
 * 3. 1.2–2.0 s: all lit, the glow settles; one line of purpose fades in under it.
 * 4. 2.0–3.2 s: the name shrinks into the header slot and the sky fades up full-bleed, scale 1.04 to 1.
 * Skippable; skipped for reduced motion, for shared links, and after the first time in a browser session.
 */
export function SkyIntro({ enabled }: { enabled: boolean }) {
  const t = useT();
  const [show, setShow] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const word = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!enabled) return;
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      // Storage blocked: show it.
    }
    if (seen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    // Deferred so the first paint is the sky screen itself (the server render has no intro). Marked as seen only once
    // it shows, so an effect that is set up twice (React development mode) does not skip it.
    const start = setTimeout(() => {
      root.style.setProperty("--intro-tempo", String(TEMPO));
      root.dataset.intro = "on";
      setShow(true);
      try {
        window.sessionStorage.setItem(SEEN_KEY, "1");
      } catch {
        // Storage blocked: it shows again next time.
      }
    }, 0);
    const reveal = setTimeout(() => {
      root.dataset.intro = "reveal";
      setRevealing(true);
    }, REVEAL_AT * TEMPO);
    const end = setTimeout(() => setShow(false), END_AT * TEMPO);
    return () => {
      clearTimeout(start);
      clearTimeout(reveal);
      clearTimeout(end);
      delete root.dataset.intro;
    };
  }, [enabled]);

  // Leaving (at the end or by Skip) hands the screen back: the header wordmark and the sky scale return.
  useEffect(() => {
    if (show) return;
    const root = document.documentElement;
    delete root.dataset.intro;
    // Kept until the sky has settled back from 1.04, which reads the tempo for its transition.
    const timer = setTimeout(() => root.style.removeProperty("--intro-tempo"), 1200 * TEMPO + 100);
    return () => clearTimeout(timer);
  }, [show]);

  // Frame 4: the name flies from the middle into the header wordmark's place (measured, so it lands exactly).
  useEffect(() => {
    if (!revealing || !word.current) return;
    const target = document.querySelector("[data-wordmark]");
    if (!target) return;
    const from = word.current.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const fontSize = parseFloat(getComputedStyle(word.current).fontSize);
    const scale = parseFloat(getComputedStyle(target).fontSize) / fontSize;
    // The tracking tightens from 0.3em to 0.22em during the flight (the header value), which moves the centred word
    // by half the change in its trailing negative margin.
    const tracking = ((0.3 - 0.22) / 2) * fontSize;
    const dx = to.left + to.width / 2 - (from.left + from.width / 2) + tracking;
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    word.current.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
  }, [revealing]);

  if (!show) return null;
  return (
    <div
      className="sky-intro absolute inset-0 z-40 overflow-hidden"
      data-phase={revealing ? "reveal" : "lights"}
      role="presentation"
    >
      <div className="sky-intro-black absolute inset-0 bg-ink" />
      <div className="sky-intro-line absolute top-1/2 left-1/2" aria-hidden>
        <span className="sky-intro-core" />
      </div>
      <div className="absolute inset-0 grid place-items-center">
        <div className="sky-intro-type grid justify-items-center">
          <p ref={word} aria-label={WORD} className="sky-intro-word font-display text-paper">
            {[...WORD].map((letter, index) => (
              <span
                key={index}
                aria-hidden
                className={`sky-intro-letter sky-intro-flicker-${index % 3}`}
                style={{ animationDelay: `${(LETTER_ON[index] ?? LETTERS_AT) * TEMPO}ms, ${1400 * TEMPO}ms` }}
              >
                {letter}
              </span>
            ))}
          </p>
          <p className="sky-intro-purpose font-ui text-ash">{t("intro.purpose")}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setShow(false)}
        className="sky-intro-skip absolute font-ui text-smoke hover:text-ash"
      >
        {t("intro.skip")}
      </button>
    </div>
  );
}
