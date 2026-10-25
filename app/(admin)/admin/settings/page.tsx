import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CatalogEditor, PricingEditor, type CatalogRow, type SlabRow } from "@/components/admin/catalog-editor";
import { SettingsForm } from "@/components/admin/settings-form";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { requirePageRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("admin.settings"))("title") };
}

const TABS = ["general", "catalog", "pricing", "audit"] as const;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePageRole("ADMIN");
  const { tab: raw } = await searchParams;
  const tab = (TABS as readonly string[]).includes(raw ?? "") ? (raw as (typeof TABS)[number]) : "general";
  const t = await getTranslations("admin.settings");
  const locale = await getLocale();

  return (
    <div>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <nav className="mb-5 flex gap-1 overflow-x-auto rounded-2xl bg-white/70 p-1 ring-1 ring-border" aria-label={t("title")}>
        {TABS.map((k) => (
          <Link
            key={k}
            href={`/admin/settings?tab=${k}`}
            aria-current={tab === k ? "page" : undefined}
            className={cn("rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap", tab === k ? "bg-navy text-white" : "text-muted-foreground hover:text-navy")}
          >
            {t(`tabs.${k}`)}
          </Link>
        ))}
      </nav>

      {tab === "general" ? <SettingsForm settings={await getSettings()} /> : null}
      {tab === "catalog" ? (
        <CatalogEditor items={(await db.catalogItem.findMany({ orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }] })) as CatalogRow[]} />
      ) : null}
      {tab === "pricing" ? (
        <PricingEditor
          slabs={(await db.pricingSlab.findMany({ where: { isActive: true }, orderBy: { minKw: "asc" } })).map(
            (s): SlabRow => ({ id: s.id, minKw: s.minKw, maxKw: s.maxKw, ratePerKwInclGst: s.ratePerKwInclGst, phase: s.phase, isActive: s.isActive }),
          )}
        />
      ) : null}
      {tab === "audit" ? <AuditLogList locale={locale} empty={t("auditEmpty")} /> : null}
    </div>
  );
}

async function AuditLogList({ locale, empty }: { locale: string; empty: string }) {
  const rows = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const actors = new Map((await db.user.findMany({ where: { id: { in: rows.map((r) => r.actorId).filter((x): x is string => Boolean(x)) } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  if (!rows.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <Card className="gap-0 p-0">
      <ul>
        {rows.map((r) => (
          <li key={r.id} className="border-b border-border/60 px-5 py-3 text-sm last:border-0">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium">
                {r.entity} · {r.action}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(r.createdAt, locale)} · {r.actorId ? actors.get(r.actorId) ?? "—" : "system"}
              </span>
            </div>
            {r.entity === "Settings" ? (
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {Object.entries(r.diff as Record<string, { from: unknown; to: unknown }>)
                  .slice(0, 8)
                  .map(([k, v]) => (
                    <li key={k} className="truncate">
                      {k}: {JSON.stringify(v.from)} → {JSON.stringify(v.to)}
                    </li>
                  ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
