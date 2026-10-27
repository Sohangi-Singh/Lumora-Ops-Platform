import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white/60 px-6 py-12 text-center",
        className,
      )}
    >
      <Image src="/brand/mark.png" alt="" width={640} height={479} className="animate-float mb-4 h-16 w-auto opacity-80 drop-shadow-[0_10px_24px_rgb(247_167_51/0.3)]" />
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
