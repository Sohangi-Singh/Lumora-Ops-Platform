"use client";

import { useTranslations } from "next-intl";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { cn } from "@/lib/utils";

/** Subscribes the page to realtime refresh pings and shows a small "Live" dot. */
export function LiveIndicator({ topics, className }: { topics: string[]; className?: string }) {
  const t = useTranslations("tracker");
  const { live } = useRealtimeRefresh(topics);
  if (!live) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-success", className)} aria-live="polite">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-success" />
      </span>
      {t("live")}
    </span>
  );
}
