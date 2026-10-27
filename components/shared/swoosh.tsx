import { cn } from "@/lib/utils";

/** A hand-drawn gold underline that draws itself in under a page title. */
export function Swoosh({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 220 14" fill="none" className={cn("h-3 w-36 sm:w-44", className)}>
      <defs>
        <linearGradient id="swoosh-gold" x1="0" x2="1">
          <stop offset="0" stopColor="#f7b733" />
          <stop offset="1" stopColor="#c6a75e" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <path
        className="animate-draw"
        d="M3 9 C 45 2, 90 2, 130 6 S 195 12, 217 5"
        stroke="url(#swoosh-gold)"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
