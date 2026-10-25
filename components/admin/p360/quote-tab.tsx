import { getLocale, getTranslations } from "next-intl/server";
import { ApproveQuoteButton, GenerateQuoteButton, QuoteOverrides } from "@/components/admin/quote-controls";
import { SavingsSummary } from "@/components/shared/savings-summary";
import { StatusChip, type ChipTone } from "@/components/shared/status-chip";
import { Card } from "@/components/ui/card";
import type { Project360 } from "@/lib/admin/data";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import { expireStaleQuotes } from "@/lib/quotes/service";
import { getSettings } from "@/lib/settings";
import type { CableEstimate, LineItem } from "@/lib/solar/bom";
import type { EconomicsResult } from "@/lib/solar/economics";
import type { PricingResult } from "@/lib/solar/pricing";
import type { SizingResult } from "@/lib/solar/sizing";

const TONE: Record<string, ChipTone> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "warning",
  APPROVED: "info",
  SENT: "info",
  ACCEPTED: "success",
  EXPIRED: "danger",
  SUPERSEDED: "neutral",
};

const strip = (s: string) => s.replaceAll("**", "");

export async function QuoteTab({ data }: { data: Project360 }) {
  const { project } = data;
  await expireStaleQuotes(project.id);
  const t = await getTranslations("admin.quote");
  const locale = await getLocale();
  const settings = await getSettings();
  const quotes = await db.quote.findMany({ where: { projectId: project.id }, orderBy: { version: "desc" } });
  const current = quotes.find((q) => q.status !== "SUPERSEDED") ?? null;
  const ready = Boolean(project.billData?.confirmedByAdmin) && project.survey?.status === "SUBMITTED";

  if (!current) {
    return (
      <Card className="items-start gap-4 p-6">
        <p className="text-sm text-muted-foreground">{t("notReady")}</p>
        {ready && project.stage === "QUOTE" ? <GenerateQuoteButton projectId={project.id} /> : null}
      </Card>
    );
  }

  const computed = current.computed as unknown as { sizing: SizingResult; pricing: PricingResult; economics: EconomicsResult; cables: CableEstimate };
  const { sizing, pricing, economics, cables } = computed;
  const lineItems = current.lineItems as unknown as LineItem[];
  const editable = project.stage === "QUOTE" && current.status !== "ACCEPTED";
  const kv = (label: string, value: string, highlight = false) => (
    <div className={`flex justify-between gap-4 py-2 text-sm ${highlight ? "rounded-lg bg-gold-soft px-2 font-semibold text-navy" : ""}`}>
      <span className={highlight ? "" : "text-muted-foreground"}>{label}</span>
      <span className="text-right tabular">{value}</span>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="gap-1 p-5">
          <h3 className="mb-2 font-semibold text-navy">{t("sizing")}</h3>
          {kv(t("monthsUsed"), String(sizing.monthsUsed.length))}
          {kv(t("avgMonthly"), Math.round(sizing.avgMonthlyUnits).toLocaleString("en-IN"))}
          {kv(t("avgDaily"), sizing.avgDailyUnits.toFixed(1))}
          {kv(t("requiredKw"), `${sizing.requiredKw.toFixed(2)} kW`, sizing.binding === "CONSUMPTION")}
          {kv(t("loadCap"), sizing.loadCapKw !== null ? `${sizing.loadCapKw.toFixed(2)} kW` : "—", sizing.binding === "SANCTIONED_LOAD")}
          {kv(t("roofCap", { sqm: settings.sizing.sqmPerKwp }), sizing.roofCapKw !== null ? `${sizing.roofCapKw.toFixed(2)} kW` : "—", sizing.binding === "ROOF_AREA")}
          {kv(t("recommended"), `${sizing.recommendedKw} kW`)}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusChip tone="gold">{t("binding", { what: t(`bindingWhat.${sizing.binding}`) })}</StatusChip>
            {sizing.roundedDownForCap ? <StatusChip tone="warning">{t("roundedDown")}</StatusChip> : null}
            {sizing.capBelowMinimum ? <StatusChip tone="danger">{t("capBelowMin")}</StatusChip> : null}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t("cables", { dc: cables.dcRunM ?? "—", ac: cables.acRunM ?? "—", earth: cables.earthingRunM ?? "—" })}</p>
        </Card>

        <Card className="gap-1 p-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-navy">{t("current")}</h3>
            <StatusChip tone={TONE[current.status]}>{t(`status.${current.status}`)}</StatusChip>
          </div>
          <p className="mb-1 text-xs text-muted-foreground tabular">
            {current.refNo} · {t("version", { n: current.version })} · {current.systemKw} kW · {current.phase === "THREE" ? "3φ" : "1φ"} · {current.panelCount} × {settings.sizing.panelWattage} Wp
          </p>
          {kv(t("total"), formatINR(current.totalInclGst), true)}
          {kv(t("advance"), formatINR(pricing.advanceAmount))}
          {kv(t("balance"), formatINR(pricing.balanceAmount))}
          {kv(t("basicPerWp"), pricing.basicPerWp.toFixed(3))}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {t("basicNote", { value: pricing.basicPerWp.toFixed(3), alt: pricing.basicPerWpBlended.toFixed(3) })}
          </p>
          {kv(t("validTill"), formatDate(current.validTill, locale))}
          {current.overrideReason ? <p className="mt-1 rounded-lg bg-cream px-2 py-1.5 text-xs">{current.overrideReason}</p> : null}
          {current.acceptedAt ? <p className="mt-1 text-xs text-success">{t("accepted", { date: formatDateTime(current.acceptedAt, locale), ip: current.acceptedIp ?? "—" })}</p> : null}
          {current.status === "PENDING_APPROVAL" || current.status === "DRAFT" ? (
            <div className="mt-3">
              <ApproveQuoteButton quoteId={current.id} />
            </div>
          ) : null}
        </Card>

        <Card className="p-5">
          <h3 className="mb-2 font-semibold text-navy">{t("economics")}</h3>
          <SavingsSummary e={economics} exportRate={settings.economics.exportTariffPerUnit} />
        </Card>
      </div>

      <QuoteOverrides
        projectId={project.id}
        pdfUrl={current.pdfPath ? `/api/quotes/${current.id}/pdf` : null}
        defaults={{ systemKw: current.systemKw, phase: current.phase, panelCount: current.panelCount }}
        editable={editable}
      />

      <Card className="gap-0 overflow-x-auto p-0">
        <h3 className="px-5 pt-4 pb-2 font-semibold text-navy">{t("lineItems")}</h3>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-y border-border bg-cream/50 text-xs text-muted-foreground">
            <tr>
              {["#", "Description", "Specification", "Make", "Warranty", "Unit", "Qty"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lineItems.map((r) => (
              <tr key={r.sNo} className="border-b border-border/60 align-top">
                <td className="px-3 py-2 tabular">{r.sNo}</td>
                <td className="px-3 py-2">{strip(r.description)}</td>
                <td className="px-3 py-2 text-muted-foreground">{strip(r.specification)}</td>
                <td className="px-3 py-2 text-muted-foreground">{strip(r.make)}</td>
                <td className="px-3 py-2 text-muted-foreground">{strip(r.warranty)}</td>
                <td className="px-3 py-2">{r.unit}</td>
                <td className="px-3 py-2 tabular">{r.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {quotes.length > 1 ? (
        <Card className="gap-2 p-5">
          <h3 className="font-semibold text-navy">{t("versions")}</h3>
          <ul className="divide-y divide-border/60 text-sm">
            {quotes.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="tabular">
                  {t("version", { n: q.version })} · {q.systemKw} kW · {formatINR(q.totalInclGst)} · {formatDate(q.createdAt, locale)}
                </span>
                <span className="flex items-center gap-2">
                  <StatusChip tone={TONE[q.status]}>{t(`status.${q.status}`)}</StatusChip>
                  {q.pdfPath ? (
                    <a href={`/api/quotes/${q.id}/pdf`} target="_blank" rel="noopener" className="text-xs font-medium text-gold-ink hover:underline">
                      PDF
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
