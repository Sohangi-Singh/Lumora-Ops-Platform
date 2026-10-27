import type { ReactNode } from "react";
import { Swoosh } from "./swoosh";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-gold-soft/80 px-3 py-1 text-[11px] font-semibold tracking-wide text-gold-ink uppercase ring-1 ring-gold/30">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-2xl font-semibold sm:text-[30px]">{title}</h1>
        <Swoosh className="-mt-0.5" />
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
