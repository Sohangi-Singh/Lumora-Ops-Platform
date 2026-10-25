import { Download, ExternalLink, FileClock } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { AcceptQuote, RequestRevision } from "@/components/customer/quote-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { LiveIndicator } from "@/components/shared/live-indicator";
import { PageHeader } from "@/components/shared/page-header";
import { SavingsSummary } from "@/components/shared/savings-summary";
import { StatusChip } from "@/components/shared/status-chip";
import { Card } from "@/components/ui/card";
import { requirePageRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatDate, formatINR, istCalendarDaysUntil } from "@/lib/format";
import { getCustomerProject } from "@/lib/portal/data";
import { expireStaleQuotes } from "@/lib/quotes/service";
import { projectTopic } from "@/lib/realtime/topics";
import { getSettings } from "@/lib/settings";
import type { EconomicsResult } from "@/lib/solar/economics";
import type { PricingResult } from "@/lib/solar/pricing";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("quote"))("title") };
}

export default async function CustomerQuotePage() {
  const user = await requirePageRole("CUSTOMER");
  const { project } = await getCustomerProject(user);
  await expireStaleQuotes(project.id);
  const t = await getTranslations("quote");
  const locale = await getLocale();
  const settings = await getSettings();
  // Customers only ever see approved quotes — never drafts awaiting approval.
  const quote = await db.quote.findFirst({
    where: { projectId: project.id, status: { in: ["SENT", "APPROVED", "ACCEPTED", "EXPIRED"] } },
    orderBy: { version: "desc" },
  });

  const header = <PageHeader title={t("title")} description={t("subtitle")} actions={<LiveIndicator topics={[projectTopic(project.id)]} />} />;
  if (!quote) {
    return (
      <div>
        {header}
        <EmptyState title={t("preparing")} description={t("preparingBody")} />
      </div>
    );
  }

  const computed = quote.computed as unknown as { pricing: PricingResult; economics: EconomicsResult };
  const expired = quote.status === "EXPIRED";
  const daysLeft = Math.max(0, istCalendarDaysUntil(quote.validTill));
  const pdf = `/api/quotes/${quote.id}/pdf`;

  return (
    <div>
      {header}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card className="gap-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs text-muted-foreground tabular">
                  {t("ref", { ref: quote.refNo })} · {t("dated", { date: formatDate(quote.quoteDate, locale) })}
                </div>
                <div className="mt-1 text-2xl font-semibold text-navy tabular">{formatINR(quote.totalInclGst)}</div>
                <div className="text-sm text-muted-foreground">
                  {t("system")}: {quote.systemKw} kW · {quote.panelCount} × {settings.sizing.panelWattage} Wp
                </div>
              </div>
              {quote.status === "ACCEPTED" && quote.acceptedAt ? (
                <StatusChip tone="success">{t("accepted", { date: formatDate(quote.acceptedAt, locale) })}</StatusChip>
              ) : expired ? (
                <StatusChip tone="danger">{t("expired")}</StatusChip>
              ) : (
                <StatusChip tone={daysLeft <= 1 ? "danger" : "warning"}>
                  {t("validTill", { date: formatDate(quote.validTill, locale) })} · {t("expiresIn", { days: daysLeft })}
                </StatusChip>
              )}
            </div>

            {expired ? (
              <div className="rounded-xl bg-danger-soft p-4">
                <div className="flex items-center gap-2 font-medium text-danger">
                  <FileClock className="size-4" aria-hidden />
                  {t("expired")}
                </div>
                <p className="mt-1 text-sm text-danger/90">{t("expiredBody")}</p>
                <div className="mt-3">
                  <RequestRevision />
                </div>
              </div>
            ) : quote.status !== "ACCEPTED" ? (
              <AcceptQuote quoteId={quote.id} kw={quote.systemKw} total={formatINR(quote.totalInclGst)} advance={formatINR(computed.pricing.advanceAmount)} />
            ) : null}

            <div className="flex flex-wrap gap-3 text-sm">
              <a href={pdf} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-medium text-navy hover:underline">
                <ExternalLink className="size-4" aria-hidden />
                {t("openPdf")}
              </a>
              <a href={`${pdf}?download=1`} className="inline-flex items-center gap-1.5 font-medium text-navy hover:underline">
                <Download className="size-4" aria-hidden />
                {t("download")}
              </a>
            </div>
          </Card>

          <Card className="hidden gap-0 p-2 md:flex">
            <iframe src={pdf} title={t("title")} className="h-[80vh] w-full rounded-xl bg-white" />
          </Card>
        </div>

        <Card className="self-start p-5">
          <h2 className="mb-3 text-lg font-semibold">{(await getTranslations("savings"))("title")}</h2>
          <SavingsSummary e={computed.economics} exportRate={settings.economics.exportTariffPerUnit} />
        </Card>
      </div>
    </div>
  );
}
