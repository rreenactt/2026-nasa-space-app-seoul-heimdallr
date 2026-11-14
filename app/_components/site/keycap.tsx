import { Kbd } from "@/components/ui/kbd";
import { cn } from "cn";

/** One key, drawn as an outlined cap in the data font (Figma design I). */
export function Keycap({ children, className }: { children: string; className?: string }) {
  return (
    <Kbd
      className={cn(
        "h-5 min-w-5 rounded-sm border border-smoke bg-transparent px-1.5 font-data text-[11px] font-normal text-bone",
        "in-data-[slot=tooltip-content]:bg-transparent in-data-[slot=tooltip-content]:text-bone",
        className,
      )}
    >
      {children}
    </Kbd>
  );
}
