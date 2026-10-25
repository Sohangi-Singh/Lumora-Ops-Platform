import { cn } from "@/lib/utils";

export type ChipTone = "neutral" | "info" | "success" | "warning" | "danger" | "gold";

const tones: Record<ChipTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-[#e6ecf3] text-navy",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  gold: "bg-gold-soft text-gold-ink",
};

export function StatusChip({
  tone = "neutral",
  children,
  className,
}: {
  tone?: ChipTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
