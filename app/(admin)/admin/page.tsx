import { AlertTriangle, BadgeIndianRupee, ClipboardCheck, FolderKanban, Hourglass, Search, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { EmptyState } from "@/components/shared/empty-state";
import { LiveIndicator } from "@/components/shared/live-indicator";
import { PageHeader } from "@/components/shared/page-header";
import { StatusChip } from "@/components/shared/status-chip";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDashboard } from "@/lib/admin/dashboard";
import { requirePageRole } from "@/lib/authz";
import { formatINR } from "@/lib/format";
import { describeBlocker } from "@/lib/i18n/blockers";
import { ADMIN_TOPIC } from "@/lib/realtime/topics";
import { cn } from "@/lib/utils";
import { STAGES } from "@/lib/workflow/stateMachine";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("admin.dash"))("title") };
}

const OWNERS = ["ALL", "CUSTOMER", "WORKER", "ADMIN"] as const;
const DAY = 86_400_000;

export default async function AdminOverview({ searchParams }: { searchParams: Promise<{ owner?: string }> }) {
  await requirePageRole("ADMIN");
  const { owner: rawOwner } = await searchParams;
  const owner = (OWNERS as readonly string[]).includes(rawOwner ?? "") ? (rawOwner as (typeof OWNERS)[number]) : "ALL";
  const t = await getTranslations();
  const tr = (key: string, values?: Record<string, string | number>) => t(key as Parameters<typeof t>[0], values as never);
  const d = await getDashboard();
  const blockers = d.blockers.filter((b) => owner === "ALL" || b.owner === owner);

  const kpis = [
    { label: t("admin.dash.kpi.active"), value: String(d.kpis.active), icon: FolderKanban, href: "/admin/projects" },
    { label: t("admin.dash.kpi.quotes"), value: String(d.kpis.quotesPending), icon: ClipboardCheck, href: "/admin/projects?stage=QUOTE", attention: d.kpis.quotesPending > 0 },
    { label: t("admin.dash.kpi.verify"), value: String(d.kpis.paymentsToVerify), icon: Wallet, href: "/admin?owner=ADMIN", attention: d.kpis.paymentsToVerify > 0 },
    { label: t("admin.dash.kpi.collected"), value: formatINR(d.kpis.collected), icon: BadgeIndianRupee },
    { label: t("admin.dash.kpi.pending"), value: formatINR(d.kpis.pending), icon: Hourglass },
    { label: t("admin.dash.kpi.sla"), value: String(d.kpis.slaRisk), icon: AlertTriangle, attention: d.kpis.slaRisk > 0 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.dash.title")} description={t("admin.dash.subtitle")} actions={<LiveIndicator topics={[ADMIN_TOPIC]} />} />

      <form action="/admin/projects" role="search" className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input name="q" placeholder={t("admin.dash.searchPlaceholder")} aria-label={t("admin.dash.searchPlaceholder")} className="h-12 pl-10" />
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => {
          const body = (
            <Card className={cn("h-full gap-1 p-4", k.attention && "ring-gold/70")}>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{k.label}</span>
                <k.icon className={cn("size-4", k.attention ? "text-gold-ink" : "text-muted-foreground/70")} aria-hidden />
              </div>
              <div className="text-xl font-semibold text-navy tabular sm:text-2xl">{k.value}</div>
            </Card>
          );
          return k.href ? (
            <Link key={k.label} href={k.href} className="rounded-2xl focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none">
              {body}
            </Link>
          ) : (
            <div key={k.label}>{body}</div>
          );
        })}
      </div>

      <Card className="gap-3 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{t("admin.dash.pipeline")}</h2>
          <p className="text-xs text-muted-foreground">{t("admin.dash.pipelineHint")}</p>
        </div>
        {d.projects.length === 0 ? (
          <EmptyState title={t("admin.dash.empty")} />
        ) : (
          <div className="-mx-5 overflow-x-auto px-5 pb-2">
            <div className="flex min-w-max gap-3">
              {STAGES.map((stage) => {
                const items = d.projects.filter((p) => p.stage === stage);
                return (
                  <section key={stage} className="w-56 shrink-0 rounded-xl bg-cream/70 p-2" aria-label={t(`stages.${stage}`)}>
                    <header className="flex items-center justify-between px-1.5 pt-1 pb-2 text-xs font-semibold text-navy">
                      <span>{t(`stages.${stage}`)}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 tabular">{items.length}</span>
                    </header>
                    <ul className="space-y-2">
                      {items.map((p) => (
                        <li key={p.id}>
                          <Link
                            href={`/admin/projects/${p.id}`}
                            className={cn(
                              "block rounded-lg border bg-white p-2.5 text-sm shadow-xs transition-colors hover:border-navy/40",
                              p.critical ? "border-danger/40" : "border-border",
                            )}
                          >
                            <div className="truncate font-medium text-navy">{p.name}</div>
                            <div className="mt-0.5 flex items-center justify-between text-[11px] text-muted-foreground">
                              <span className="truncate">
                                {p.city}
                                {p.kw ? ` · ${p.kw} kW` : ""}
                              </span>
                              <span className="tabular">{t("admin.dash.daysInStage", { n: p.daysInStage })}</span>
                            </div>
                            {p.complete ? (
                              <StatusChip tone="success" className="mt-1.5">
                                ✓
                              </StatusChip>
                            ) : p.blockerCount ? (
                              <StatusChip tone={p.critical ? "danger" : "neutral"} className="mt-1.5">
                                {t("admin.dash.blockerCount", { n: p.blockerCount })}
                              </StatusChip>
                            ) : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card className="gap-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {t("admin.dash.blockers")} <span className="text-sm font-normal text-muted-foreground">· {t("admin.dash.blockersHint")}</span>
            </h2>
          </div>
          <nav className="flex flex-wrap gap-1.5" aria-label={t("admin.dash.blockers")}>
            {OWNERS.map((o) => (
              <Link
                key={o}
                href={o === "ALL" ? "/admin" : `/admin?owner=${o}`}
                scroll={false}
                aria-current={owner === o ? "page" : undefined}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium",
                  owner === o ? "bg-navy text-white" : "bg-muted text-muted-foreground hover:text-navy",
                )}
              >
                {t(`admin.dash.filter.${o}`)}
              </Link>
            ))}
          </nav>
          {blockers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("admin.dash.noBlockers")}</p>
          ) : (
            <ul className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
              {blockers.map((b, i) => (
                <li key={`${b.projectId}-${b.code}-${i}`}>
                  <Link href={`/admin/projects/${b.projectId}`} className="flex items-start justify-between gap-3 rounded-xl px-3 py-2 hover:bg-cream/70">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-navy">{b.projectName}</span>
                      <span className={cn("block text-xs", b.severity === "critical" ? "text-danger" : "text-muted-foreground")}>{describeBlocker(b, tr)}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <StatusChip tone={b.owner === "ADMIN" ? "gold" : b.owner === "WORKER" ? "info" : "neutral"}>{t(`blockers.owner.${b.owner}`)}</StatusChip>
                      {b.since ? (
                        <span className="text-[11px] text-muted-foreground tabular">
                          {t("admin.dash.since", { n: Math.max(0, Math.floor((Date.now() - b.since.getTime()) / DAY)) })}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="gap-3 p-5">
          <h2 className="text-lg font-semibold">{t("admin.dash.revenue")}</h2>
          <RevenueChart data={d.revenue} />
        </Card>
      </div>
    </div>
  );
}
