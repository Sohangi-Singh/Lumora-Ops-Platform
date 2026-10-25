import { formatDateTime } from "@/lib/format";

export type EventItem = { id: string; messageEn: string; messageHi: string; createdAt: Date };

export function EventList({ events, locale, emptyText }: { events: EventItem[]; locale: string; emptyText: string }) {
  if (!events.length) return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ol className="relative space-y-5 border-l border-border pl-5">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-white bg-gold ring-1 ring-gold/40" aria-hidden />
          <p className="text-sm text-foreground">{locale === "hi" ? e.messageHi : e.messageEn}</p>
          <time className="text-xs text-muted-foreground" dateTime={e.createdAt.toISOString()}>
            {formatDateTime(e.createdAt, locale)}
          </time>
        </li>
      ))}
    </ol>
  );
}
