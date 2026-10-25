import { getLocale, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { StatusChip } from "@/components/shared/status-chip";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

/** Full audit log, including internal events (document views, extraction, overrides). */
export async function TimelineTab({ projectId }: { projectId: string }) {
  const t = await getTranslations("timeline");
  const locale = await getLocale();
  const events = await db.projectEvent.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { actor: { select: { name: true, role: true } } },
  });
  if (!events.length) return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  return (
    <Card className="gap-0 p-0">
      <ul>
        {events.map((e) => (
          <li key={e.id} className="flex flex-col gap-1 border-b border-border/60 px-5 py-3 last:border-0 sm:flex-row sm:items-center sm:gap-4">
            <time className="w-36 shrink-0 text-xs text-muted-foreground tabular">{formatDateTime(e.createdAt, locale)}</time>
            <span className="flex-1 text-sm">{locale === "hi" ? e.messageHi : e.messageEn}</span>
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              {e.internal ? <StatusChip tone="neutral">internal</StatusChip> : null}
              {e.actor ? `${e.actor.name} · ${e.actor.role.toLowerCase()}` : "system"}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
