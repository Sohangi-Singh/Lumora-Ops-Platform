import { cn } from "@/lib/utils"

/** Accessible determinate progress bar (plain markup, SSR-stable). */
function Progress({ value = 0, className, label }: { value?: number | null; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      aria-label={label}
      data-slot="progress"
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div className="h-full rounded-full bg-gold transition-[width] duration-300" style={{ width: `${v}%` }} />
    </div>
  )
}

export { Progress }
