"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { markAllNotificationsReadAction } from "@/lib/actions/notifications";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type BellItem = {
  id: string;
  titleEn: string;
  titleHi: string;
  bodyEn: string;
  bodyHi: string;
  href: string | null;
  read: boolean;
  createdAt: string;
};

export function NotificationBell({ items, unread, topics }: { items: BellItem[]; unread: number; topics: string[] }) {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const [pending, start] = useTransition();
  useRealtimeRefresh(topics);
  const hi = locale === "hi";

  return (
    <Popover
      onOpenChange={(open) => {
        if (!open && unread > 0) start(() => void markAllNotificationsReadAction());
      }}
    >
      <PopoverTrigger
        id="notifications-trigger"
        aria-label={t("title")}
        className="relative flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-navy focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
      >
        <Bell className="size-[18px]" />
        {unread > 0 ? (
          <span className="absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] leading-4 font-semibold text-navy">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-semibold text-navy">{t("title")}</span>
          {unread > 0 ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => start(() => void markAllNotificationsReadAction())}
              className="text-xs text-gold-ink hover:underline"
            >
              {t("markAllRead")}
            </button>
          ) : null}
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">{t("empty")}</li>
          ) : (
            items.map((n) => {
              const body = (
                <>
                  <div className="flex items-start gap-2">
                    {!n.read ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-gold" aria-label={t("unread")} /> : null}
                    <div className={cn("min-w-0", n.read && "pl-4")}>
                      <div className="text-sm font-medium text-navy">{hi ? n.titleHi : n.titleEn}</div>
                      <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hi ? n.bodyHi : n.bodyEn}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground/80">{formatDateTime(n.createdAt, locale)}</div>
                    </div>
                  </div>
                </>
              );
              return (
                <li key={n.id} className="border-b border-border/60 last:border-0">
                  {n.href ? (
                    <Link href={n.href} className="block px-4 py-3 hover:bg-muted/60">
                      {body}
                    </Link>
                  ) : (
                    <div className="px-4 py-3">{body}</div>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
