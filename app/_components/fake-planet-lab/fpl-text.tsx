import { Fragment, type ReactNode } from "react";
import type { Translate } from "@/app/_i18n/i18n-provider";
import type { MessageKey } from "@/app/_i18n/message-keys";
import { VERDICT_TEXT } from "@/app/_lib/fpl/checks";
import type { Judgment } from "@/app/_lib/fpl/types";

/**
 * Screen text for values that come from app/_lib/fpl (flag categories, check names, verdicts) and for the
 * example targets. The library keeps its English strings: they also go into the saved records (data).
 */

/**
 * Renders a translated sentence whose `{name}` placeholders are left unfilled by `t` and replaced here by
 * elements (a monospace span, a bold title), so the sentence stays one key.
 */
export function richText(text: string, parts: Record<string, ReactNode>) {
  return text.split(/\{(\w+)\}/g).map((s, i) => (i % 2 ? <Fragment key={i}>{s in parts ? parts[s] : `{${s}}`}</Fragment> : s));
}

const FLAG_TEXT: Record<string, { label: MessageKey; explain: MessageKey }> = {
  unusable: { label: "fpl.flagUnusable", explain: "fpl.flagUnusableExplain" },
  saturation: { label: "fpl.flagSaturation", explain: "fpl.flagSaturationExplain" },
  transient: { label: "fpl.flagTransient", explain: "fpl.flagTransientExplain" },
  ghost: { label: "fpl.flagGhost", explain: "fpl.flagGhostExplain" },
  persistence: { label: "fpl.flagPersistence", explain: "fpl.flagPersistenceExplain" },
  crosstalk: { label: "fpl.flagCrosstalk", explain: "fpl.flagCrosstalkExplain" },
  streak: { label: "fpl.flagStreak", explain: "fpl.flagStreakExplain" },
  outlier: { label: "fpl.flagOutlier", explain: "fpl.flagOutlierExplain" },
  info: { label: "fpl.flagInfo", explain: "fpl.flagInfoExplain" },
  unknown: { label: "fpl.flagUnknown", explain: "fpl.flagUnknownExplain" },
};

export const flagLabel = (t: Translate, c: { id: string; label: string }) => (FLAG_TEXT[c.id] ? t(FLAG_TEXT[c.id].label) : c.label);
export const flagExplain = (t: Translate, c: { id: string; explain: string }) => (FLAG_TEXT[c.id] ? t(FLAG_TEXT[c.id].explain) : c.explain);

const CHECK_LABEL: Record<string, MessageKey> = {
  validity: "fpl.checkValidity",
  flags: "fpl.checkFlags",
  edge: "fpl.checkEdge",
  snr: "fpl.checkSnr",
  shape: "fpl.checkShape",
  repeat: "fpl.checkRepeat",
  conditions: "fpl.checkConditions",
  neighbours: "fpl.checkNeighbours",
};

export const checkLabel = (t: Translate, c: { id: string; label: string }) => (CHECK_LABEL[c.id] ? t(CHECK_LABEL[c.id]) : c.label);

const VERDICT_KEY: Record<keyof typeof VERDICT_TEXT, MessageKey> = {
  "quality-issue": "fpl.verdictQualityIssue",
  "needs-review": "fpl.verdictNeedsReview",
  "no-issue-found": "fpl.verdictNoIssue",
};

export const verdictText = (t: Translate, v: keyof typeof VERDICT_TEXT) => t(VERDICT_KEY[v]);

/** A saved record keeps the English verdict (data); shown translated when it is one of the known ones. */
export function storedVerdictText(t: Translate, stored: string) {
  const v = (Object.keys(VERDICT_TEXT) as (keyof typeof VERDICT_TEXT)[]).find((k) => VERDICT_TEXT[k] === stored);
  return v ? verdictText(t, v) : stored;
}

export const JUDGMENT_LABEL: Record<Judgment, MessageKey> = {
  moving: "review.moving",
  "not-moving": "review.notMoving",
  "noise-or-artifact": "review.noiseOrArtifact",
  undecided: "fpl.undecided",
};

/** Lowercase form used in the Records table. */
export const JUDGMENT_CELL: Record<Judgment, MessageKey> = {
  moving: "fpl.judgmentCellMoving",
  "not-moving": "fpl.judgmentCellNotMoving",
  "noise-or-artifact": "fpl.judgmentCellNoise",
  undecided: "fpl.judgmentCellUndecided",
};

/** Example targets by their (English, data) name; "Custom position" is the name of a typed-in target. */
const EXAMPLE_TEXT: Record<string, { name: MessageKey; note?: MessageKey }> = {
  "Bright star: Barnard's Star": { name: "fpl.exampleBarnard", note: "fpl.exampleBarnardNote" },
  "Ordinary field near Barnard's Star": { name: "fpl.exampleField", note: "fpl.exampleFieldNote" },
  "Very bright star: ε Indi A": { name: "fpl.exampleEpsInd", note: "fpl.exampleEpsIndNote" },
  "Custom position": { name: "fpl.customPosition" },
};

export const targetName = (t: Translate, name: string) => (EXAMPLE_TEXT[name] ? t(EXAMPLE_TEXT[name].name) : name);
export function targetNote(t: Translate, target: { name: string; note: string }) {
  const k = EXAMPLE_TEXT[target.name]?.note;
  return k ? t(k) : target.note;
}
