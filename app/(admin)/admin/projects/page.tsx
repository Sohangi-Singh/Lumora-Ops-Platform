import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/shared/empty-state";
import { NativeSelect } from "@/components/shared/form";
import { LiveIndicator } from "@/components/shared/live-indicator";
import { PageHeader } from "@/components/shared/page-header";
import { StatusChip } from "@/components/shared/status-chip";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listProjects } from "@/lib/admin/data";
import { requirePageRole } from "@/lib/authz";
import { formatDate, formatMobile } from "@/lib/format";
import { describeBlocker } from "@/lib/i18n/blockers";
import { ADMIN_TOPIC } from "@/lib/realtime/topics";
import { STAGES } from "@/lib/workflow/stateMachine";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("admin.projects"))("title") };
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ q?: string; stage?: string }> }) {
  await requirePageRole("ADMIN");
  const { q, stage } = await searchParams;
  const t = await getTranslations();
  const locale = await getLocale();
  const tr = (key: string, values?: Record<string, string | number>) => t(key as Parameters<typeof t>[0], values as never);
  const rows = await listProjects(q, stage && (STAGES as readonly string[]).includes(stage) ? stage : undefined);

  return (
    <div>
      <PageHeader title={t("admin.projects.title")} description={t("admin.projects.subtitle")} actions={<LiveIndicator topics={[ADMIN_TOPIC]} />} />
      <form className="mb-5 flex flex-col gap-2 sm:flex-row" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input name="q" defaultValue={q} placeholder={t("admin.projects.search")} aria-label={t("admin.projects.search")} className="pl-10" />
        </div>
        <NativeSelect name="stage" defaultValue={stage ?? ""} className="sm:w-56" aria-label={t("admin.projects.stage")}>
          <option value="">{t("admin.projects.allStages")}</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {t(`stages.${s}`)}
            </option>
          ))}
        </NativeSelect>
        <button type="submit" className="h-11 rounded-xl bg-navy px-5 text-sm font-medium text-white hover:bg-navy-soft">
          {t("common.search")}
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState title={t("admin.projects.empty")} />
      ) : (
        <Card className="gap-0 p-0">
          <div className="hidden grid-cols-[2fr_1.3fr_1fr_0.7fr_2fr] gap-4 border-b border-border px-5 py-3 text-xs font-medium text-muted-foreground uppercase md:grid">
            <span>{t("admin.projects.customer")}</span>
            <span>{t("admin.projects.stage")}</span>
            <span>{t("admin.projects.worker")}</span>
            <span>{t("admin.projects.size")}</span>
            <span>{t("admin.projects.blockers")}</span>
          </div>
          <ul>
            {rows.map((r) => (
              <li key={r.id} className="border-b border-border/60 last:border-0">
                <Link
                  href={`/admin/projects/${r.id}`}
                  className="grid gap-1.5 px-5 py-4 hover:bg-cream/50 md:grid-cols-[2fr_1.3fr_1fr_0.7fr_2fr] md:items-center md:gap-4"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-navy">{r.customer.user.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {formatMobile(r.customer.user.phone)} · {r.customer.city} · {formatDate(r.updatedAt, locale)}
                    </div>
                  </div>
                  <div>
                    <StatusChip tone={r.completedAt ? "success" : "info"}>{t(`stages.${r.stage}`)}</StatusChip>
                  </div>
                  <div className="text-sm text-muted-foreground">{r.assignedWorker?.name ?? t("admin.projects.unassigned")}</div>
                  <div className="text-sm tabular">{r.systemKw ? `${r.systemKw} kW` : "—"}</div>
                  <div className="flex flex-wrap gap-1">
                    {r.blockers.slice(0, 2).map((b, i) => (
                      <StatusChip key={i} tone={b.severity === "critical" ? "danger" : b.owner === "ADMIN" ? "gold" : "neutral"} className="max-w-full truncate">
                        {describeBlocker(b, tr)}
                      </StatusChip>
                    ))}
                    {r.blockers.length > 2 ? <StatusChip>+{r.blockers.length - 2}</StatusChip> : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
