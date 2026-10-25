import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepperStage = { key: string; label: string; state: "done" | "current" | "todo"; date?: string };

/** Horizontal on desktop, vertical on mobile. Navy = done, gold pulse = current, grey = upcoming. */
export function StageStepper({ stages }: { stages: StepperStage[] }) {
  return (
    <>
      <ol className="hidden items-start md:flex" aria-label="Project progress">
        {stages.map((s, i) => (
          <li key={s.key} className="relative flex flex-1 flex-col items-center text-center" aria-current={s.state === "current" ? "step" : undefined}>
            {i > 0 ? (
              <span
                aria-hidden
                className={cn("absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2", s.state === "todo" ? "bg-border" : "bg-navy")}
              />
            ) : null}
            <Dot state={s.state} index={i} />
            <span
              className={cn(
                "mt-2 px-1 text-[11px] leading-tight font-medium lg:text-xs",
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
                className={cn("absolute top-8 bottom-0 left-4 w-0.5 -translate-x-1/2", stages[i + 1].state === "todo" ? "bg-border" : "bg-navy")}
              />
            ) : null}
            <Dot state={s.state} index={i} />
            <div className="pt-1.5">
              <div className={cn("text-sm font-medium", s.state === "todo" ? "text-muted-foreground" : "text-navy", s.state === "current" && "font-semibold")}>
                {s.label}
              </div>
              {s.date ? <div className="text-xs text-muted-foreground">{s.date}</div> : null}
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
        "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular",
        state === "done" && "bg-navy text-white",
        state === "current" && "animate-gold-pulse bg-gold text-navy ring-4 ring-gold/25",
        state === "todo" && "border-2 border-border bg-white text-muted-foreground",
      )}
    >
      {state === "done" ? <Check className="size-4" aria-hidden /> : index + 1}
    </span>
  );
}
