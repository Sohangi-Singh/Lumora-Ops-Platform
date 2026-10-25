import { getLocale, getTranslations } from "next-intl/server";
import { RecordPayment, VerifyPayment } from "@/components/admin/payment-controls";
import { StatusChip, type ChipTone } from "@/components/shared/status-chip";
import { Card } from "@/components/ui/card";
import type { Project360 } from "@/lib/admin/data";
import { db } from "@/lib/db";
import { formatDateTime, formatINR } from "@/lib/format";
import { getMilestones } from "@/lib/payments/service";

const TONE: Record<string, ChipTone> = { CREATED: "neutral", PAID: "success", VERIFIED: "success", FAILED: "danger", PENDING_VERIFICATION: "warning", REJECTED: "danger" };

export async function PaymentsTab({ data }: { data: Project360 }) {
  const t = await getTranslations("admin.pay");
  const tp = await getTranslations("payments");
  const locale = await getLocale();
  const { quote, milestones } = await getMilestones(data.project.id);
  if (!quote) return <p className="text-sm text-muted-foreground">{t("noQuote")}</p>;
  const payments = await db.payment.findMany({ where: { projectId: data.project.id }, orderBy: { createdAt: "desc" } });
  const label = (m: string) => (m === "ADVANCE" ? tp("advance") : tp("balance"));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        {milestones.map((m) => (
          <Card key={m.milestone} className="gap-1 p-5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-navy">{label(m.milestone)}</span>
              <StatusChip tone={m.settled ? "success" : m.pending ? "warning" : m.payable ? "gold" : "neutral"}>
                {m.settled ? tp(`status.${m.settled.status}`) : m.pending ? tp("status.PENDING_VERIFICATION") : m.payable ? tp("due") : tp("notYet")}
              </StatusChip>
            </div>
            <div className="text-2xl font-semibold tabular">{formatINR(m.amount)}</div>
          </Card>
        ))}
      </div>
      <div className="flex justify-end">
        <RecordPayment projectId={data.project.id} milestones={milestones.filter((m) => m.payable).map((m) => ({ milestone: m.milestone, label: label(m.milestone) }))} />
      </div>
      <Card className="gap-0 p-0">
        {payments.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">{t("none")}</p>
        ) : (
          <ul>
            {payments.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 border-b border-border/60 px-5 py-3 last:border-0 md:flex-row md:items-center md:justify-between">
                <div className="text-sm">
                  <div className="font-medium">
                    {label(p.milestone)} · {formatINR(p.amount)} · {tp(`methodShort.${p.method}`)}
                  </div>
                  <div className="text-xs text-muted-foreground tabular">
                    {formatDateTime(p.createdAt, locale)} · {p.razorpayPaymentId ?? p.razorpayOrderId ?? ""} {p.utr ? `UTR ${p.utr}` : ""}
                  </div>
                  {p.failureReason ? <div className="text-xs text-danger">{p.failureReason}</div> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip tone={TONE[p.status]}>{tp(`status.${p.status}`)}</StatusChip>
                  {p.receiptPath ? (
                    <a className="text-xs font-medium text-gold-ink hover:underline" href={`/api/payments/${p.id}/proof`} target="_blank" rel="noopener">
                      {t("viewReceipt")}
                    </a>
                  ) : null}
                  {p.status === "PAID" || p.status === "VERIFIED" ? (
                    <a className="text-xs font-medium text-navy hover:underline" href={`/api/payments/${p.id}/receipt`}>
                      {t("receipt")}
                    </a>
                  ) : null}
                  {p.status === "PENDING_VERIFICATION" ? <VerifyPayment paymentId={p.id} /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
