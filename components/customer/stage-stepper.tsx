import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StepperStage = { key: string; label: string; state: "done" | "current" | "todo"; date?: string };

/** Horizontal on desktop, vertical on mobile. Navy = done, gold pulse = current, grey = upcoming. */
export function StageStepper({ stages, currentSlot }: { stages: StepperStage[]; currentSlot?: ReactNode }) {
  return (
    <>
      <ol className="hidden items-start md:flex" aria-label="Project progress">
        {stages.map((s, i) => (
          <li key={s.key} className="relative flex flex-1 flex-col items-center text-center" aria-current={s.state === "current" ? "step" : undefined}>
            {i > 0 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute top-5 right-1/2 h-1 w-full -translate-y-1/2 rounded-full",
                  s.state === "todo" ? "bg-[repeating-linear-gradient(90deg,var(--border)_0_6px,transparent_6px_10px)]" : "bg-gradient-to-r from-navy to-gold",
                )}
              />
            ) : null}
            <Dot state={s.state} index={i} />
            <span
              className={cn(
                "mt-2.5 px-1 text-[11px] leading-tight font-medium lg:text-xs",
                s.state === "todo" ? "text-muted-foreground" : "text-navy",
                s.state === "current" && "font-semibold",
              )}
            >
              {s.label}
            </span>
            {s.date ? <span className="mt-0.5 text-[10px] text-muted-foreground">{s.date}</span> : null}
          </li>
        ))}
      </ol>

      <ol className="md:hidden" aria-label="Project progress">
        {stages.map((s, i) => (
          <li key={s.key} className="relative flex gap-3 pb-4 last:pb-0" aria-current={s.state === "current" ? "step" : undefined}>
            {i < stages.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute top-10 bottom-0 left-5 w-1 -translate-x-1/2 rounded-full",
                  stages[i + 1].state === "todo" ? "bg-[repeating-linear-gradient(180deg,var(--border)_0_6px,transparent_6px_10px)]" : "bg-gradient-to-b from-navy to-gold",
                )}
              />
            ) : null}
            <Dot state={s.state} index={i} />
            <div className="min-w-0 flex-1 pt-2.5">
              <div className={cn("text-sm font-medium", s.state === "todo" ? "text-muted-foreground" : "text-navy", s.state === "current" && "font-semibold")}>
                {s.label}
              </div>
              {s.date ? <div className="text-xs text-muted-foreground">{s.date}</div> : null}
              {s.state === "current" && currentSlot ? <div className="mt-3 -ml-1">{currentSlot}</div> : null}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

function Dot({ state, index }: { state: StepperStage["state"]; index: number }) {
  return (
    <span
      className={cn(
        "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular transition-transform duration-200 hover:scale-110",
        state === "done" && "bg-gradient-to-br from-navy to-navy-soft text-gold shadow-[0_6px_14px_-6px_rgb(27_38_59/0.6)]",
        state === "current" && "animate-gold-pulse bg-sun text-navy ring-4 ring-gold/25 shadow-[var(--shadow-glow)]",
        state === "todo" && "border-2 border-dashed border-border bg-white text-muted-foreground",
      )}
    >
      {state === "done" ? <Check className="size-4" aria-hidden /> : index + 1}
    </span>
  );
}
