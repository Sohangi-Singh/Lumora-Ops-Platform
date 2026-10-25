import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { TicketUpdate } from "@/components/admin/ticket-update";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusChip } from "@/components/shared/status-chip";
import { Card } from "@/components/ui/card";
import { requirePageRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatDateTime, formatMobile } from "@/lib/format";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("admin.tickets"))("title") };
}

const FILTERS = ["ALL", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

export default async function TicketsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePageRole("ADMIN");
  const { status } = await searchParams;
  const filter = (FILTERS as readonly string[]).includes(status ?? "") ? (status as (typeof FILTERS)[number]) : "ALL";
  const t = await getTranslations();
  const locale = await getLocale();
  const tickets = await db.serviceTicket.findMany({
    where: filter === "ALL" ? {} : { status: filter },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { photos: { where: { uploaded: true }, select: { id: true } }, project: { select: { id: true, customer: { select: { city: true, user: { select: { name: true, phone: true } } } } } } },
  });
  return (
    <div className="space-y-5">
      <PageHeader title={t("admin.tickets.title")} description={t("admin.tickets.subtitle")} />
      <nav className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link key={f} href={f === "ALL" ? "/admin/tickets" : `/admin/tickets?status=${f}`} className={cn("rounded-full px-3 py-1.5 text-xs font-medium", filter === f ? "bg-navy text-white" : "bg-muted text-muted-foreground")}>
            {f === "ALL" ? t("admin.tickets.all") : t(`support.status.${f}`)}
          </Link>
        ))}
      </nav>
      {tickets.length === 0 ? (
        <EmptyState title={t("admin.tickets.none")} />
      ) : (
        <div className="space-y-3">
          {tickets.map((k) => (
            <Card key={k.id} className="gap-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/admin/projects/${k.project.id}`} className="font-semibold text-navy hover:underline">
                    {k.project.customer.user.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {k.project.customer.city} · {formatMobile(k.project.customer.user.phone)} · {formatDateTime(k.createdAt, locale)}
                  </div>
                </div>
                <StatusChip tone={k.status === "OPEN" ? "warning" : k.status === "IN_PROGRESS" ? "info" : "success"}>{t(`support.categories.${k.category}` as "support.categories.OTHER")}</StatusChip>
              </div>
              <p className="text-sm">{k.description}</p>
              {k.photos.length ? (
                <div className="flex gap-2">
                  {k.photos.map((p) => (
                    <a key={p.id} href={`/api/photos/${p.id}`} target="_blank" rel="noopener" className="size-16 overflow-hidden rounded-lg bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/photos/${p.id}`} alt="" className="size-full object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              ) : null}
              <TicketUpdate ticketId={k.id} status={k.status} note={k.adminNote} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
