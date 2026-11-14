import { cn } from "cn";

/** What a candidate mark says on the sky and in lists. Known asteroids get their own mark whatever their status. */
export type MarkKind = "noteworthy" | "needs-ratings" | "recommended" | "known" | "test" | "opened";

export const MARK_LABELS: Record<MarkKind, string> = {
  noteworthy: "Noteworthy",
  "needs-ratings": "Needs ratings",
  recommended: "Recommended",
  known: "Known asteroid",
  test: "Test target",
  opened: "Opened before",
};

/**
 * Shape marks (decision #39): status is told by shape, not color. Only noteworthy is filled, in the one signal color.
 */
export function StatusMark({ kind, className }: { kind: MarkKind; className?: string }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden className={cn("size-3 shrink-0 overflow-visible", className)}>
      {kind === "noteworthy" && <path d="M6 0.8 11.2 6 6 11.2 0.8 6Z" className="fill-signal" />}
      {kind === "needs-ratings" && (
        <circle cx="6" cy="6" r="4.6" fill="none" className="stroke-paper" strokeWidth="1.2" strokeDasharray="2 1.6" />
      )}
      {kind === "recommended" && <circle cx="6" cy="6" r="4.6" fill="none" className="stroke-paper" strokeWidth="1.2" />}
      {kind === "known" && <path d="M6 1v10M1 6h10" className="stroke-ash" strokeWidth="1.2" />}
      {kind === "test" && <circle cx="6" cy="6" r="2" className="fill-paper" />}
      {kind === "opened" && <rect x="1.5" y="1.5" width="9" height="9" fill="none" className="stroke-ash" strokeWidth="1" />}
    </svg>
  );
}
