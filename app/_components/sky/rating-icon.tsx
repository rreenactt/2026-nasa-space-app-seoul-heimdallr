import { cn } from "cn";
import type { RatingChoiceId } from "@/app/_lib/ratings/types";

/**
 * The rating choices drawn like the "How to rate" examples, in the text color (Figma "I · Rating choice icons"):
 * a dot moving across visits, a dot staying put, a streak.
 */
export function RatingIcon({ choice, className }: { choice: RatingChoiceId; className?: string }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden className={cn("inline-block size-3 shrink-0 align-[-1px]", className)}>
      {choice === "moving" && (
        <>
          <circle cx="2.5" cy="9.5" r="1.3" fill="currentColor" opacity="0.35" />
          <circle cx="6" cy="6" r="1.3" fill="currentColor" opacity="0.65" />
          <circle cx="9.5" cy="2.5" r="1.3" fill="currentColor" />
        </>
      )}
      {choice === "not-moving" && <circle cx="6" cy="6" r="2" fill="currentColor" />}
      {choice === "noise-or-artifact" && (
        <path d="M1.5 10.5 10.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      )}
    </svg>
  );
}
