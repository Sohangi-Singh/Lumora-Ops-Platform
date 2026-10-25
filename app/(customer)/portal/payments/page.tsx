import { CheckCircle2, Clock, Download } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { OfflinePaymentForm } from "@/components/customer/offline-payment-form";
import { RazorpayButton } from "@/components/customer/razorpay-button";
import { EmptyState } from "@/components/shared/empty-state";
import { LiveIndicator } from "@/components/shared/live-indicator";
import { PageHeader } from "@/components/shared/page-header";
import { StatusChip, type ChipTone } from "@/components/shared/status-chip";
import { Card } from "@/components/ui/card";
import { requirePageRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { formatDate, formatINR } from "@/lib/format";
import { getMilestones } from "@/lib/payments/service";
import { getCustomerProject } from "@/lib/portal/data";
import { projectTopic } from "@/lib/realtime/topics";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("payments"))("title") };
}

const TONE: Record<string, ChipTone> = { CREATED: "neutral", PAID: "success", VERIFIED: "success", FAILED: "danger", PENDING_VERIFICATION: "warning", REJECTED: "danger" };

export default async function PaymentsPage() {
  const user = await requirePageRole("CUSTOMER");
  const { project } = await getCustomerProject(user);
  const t = await getTranslations("payments");
  const tq = await getTranslations("quote");
  const locale = await getLocale();
  const settings = await getSettings();
  const { quote, milestones } = await getMilestones(project.id);
  const header = <PageHeader title={t("title")} description={t("subtitle")} actions={<LiveIndicator topics={[projectTopic(project.id)]} />} />;

  if (!quote) {
    return (
      <div>
        {header}
        <EmptyState title={t("noHistory")} description={tq("preparingBody")} />
      </div>
    );
  }
  const history = await db.payment.findMany({ where: { projectId: project.id, status: { not: "CREATED" } }, orderBy: { createdAt: "desc" } });
  const bank = { name: settings.bank.accountName, bankName: settings.bank.bankName, account: settings.bank.accountNumber, ifsc: settings.bank.ifsc };

  return (
    <div>
      {header}
      <div className="grid gap-4 md:grid-cols-2">
        {milestones.map((m) => {
          const label = m.milestone === "ADVANCE" ? t("advance") : t("balance");
          const settled = m.settled;
          return (
            <Card key={m.milestone} className={`gap-4 p-5 ${m.payable ? "ring-gold/60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-navy">{label}</h2>
                  <p className="text-xs text-muted-foreground">{m.milestone === "ADVANCE" ? t("advanceWhen") : t("balanceWhen")}</p>
                </div>
                {settled ? (
                  <StatusChip tone="success">
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    {t(`status.${settled.status}`)}
                  </StatusChip>
                ) : m.pending ? (
                  <StatusChip tone="warning">
                    <Clock className="size-3.5" aria-hidden />
                    {t("status.PENDING_VERIFICATION")}
                  </StatusChip>
                ) : (
                  <StatusChip tone={m.payable ? "gold" : "neutral"}>{m.payable ? t("due") : t("notYet")}</StatusChip>
                )}
              </div>
              <div className="text-3xl font-semibold text-navy tabular">{formatINR(m.amount)}</div>
              {settled ? (
                <a href={`/api/payments/${settled.id}/receipt`} className="inline-flex items-center gap-1.5 text-sm font-medium text-navy hover:underline">
                  <Download className="size-4" aria-hidden />
                  {t("receiptDownload")}
                </a>
              ) : m.payable ? (
                <div className="space-y-2">
                  {env.razorpay.enabled ? (
                    <>
                      <RazorpayButton milestone={m.milestone} amountLabel={formatINR(m.amount)} description={`${label} · ${quote.refNo}`} />
                      <p className="text-center text-xs text-muted-foreground">{t("methods")}</p>
                    </>
                  ) : (
                    <p className="rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning">{t("notConfigured")}</p>
                  )}
                  <OfflinePaymentForm milestone={m.milestone} bank={bank} />
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 gap-0 p-0">
        <h2 className="px-5 pt-4 pb-2 font-semibold text-navy">{t("history")}</h2>
        {history.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">{t("noHistory")}</p>
        ) : (
          <ul>
            {history.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-5 py-3 text-sm">
                <span>
                  <span className="font-medium">{p.milestone === "ADVANCE" ? t("advance") : t("balance")}</span>
                  <span className="text-muted-foreground"> · {formatDate(p.createdAt, locale)} · {p.utr ?? p.razorpayPaymentId ?? p.method}</span>
                  {p.status === "REJECTED" && p.failureReason ? <span className="block text-xs text-danger">{t("rejectedReason", { reason: p.failureReason })}</span> : null}
                </span>
                <span className="flex items-center gap-2">
                  <span className="tabular">{formatINR(p.amount)}</span>
                  <StatusChip tone={TONE[p.status]}>{t(`status.${p.status}`)}</StatusChip>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
