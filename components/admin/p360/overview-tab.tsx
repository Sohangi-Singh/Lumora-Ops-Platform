import { Mail, MapPin, Phone, User } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { StatusChip } from "@/components/shared/status-chip";
import { Card } from "@/components/ui/card";
import type { Project360 } from "@/lib/admin/data";
import { formatDate, formatMobile } from "@/lib/format";
import { describeBlocker } from "@/lib/i18n/blockers";
import { sortBlockersByAge } from "@/lib/workflow/blockers";

export async function OverviewTab({ data }: { data: Project360 }) {
  const { project, blockers } = data;
  const t = await getTranslations();
  const locale = await getLocale();
  const tr = (key: string, values?: Record<string, string | number>) => t(key as Parameters<typeof t>[0], values as never);
  const c = project.customer;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
      <Card className="gap-3 p-5">
        <h3 className="font-semibold text-navy">{t("admin.p360.contact")}</h3>
        <dl className="space-y-2.5 text-sm">
          <div className="flex items-center gap-2">
            <User className="size-4 text-muted-foreground" aria-hidden />
            {c.salutation} {c.user.name}
          </div>
          {c.user.phone ? (
            <a href={`tel:+91${c.user.phone}`} className="flex items-center gap-2 text-navy hover:underline">
              <Phone className="size-4 text-muted-foreground" aria-hidden />
              {formatMobile(c.user.phone)}
            </a>
          ) : null}
          <a href={`mailto:${c.user.email}`} className="flex items-center gap-2 break-all text-navy hover:underline">
            <Mail className="size-4 text-muted-foreground" aria-hidden />
            {c.user.email}
          </a>
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
            <span>
              {c.addressLine1}
              {c.addressLine2 ? `, ${c.addressLine2}` : ""}, {c.city}, {c.state} {c.pincode}
            </span>
          </div>
        </dl>
        <div className="mt-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <div>
            {t("admin.p360.assignedWorker")}: <span className="font-medium text-foreground">{project.assignedWorker?.name ?? t("admin.p360.noWorker")}</span>
          </div>
          <div className="mt-1">{t("admin.p360.stageSince", { stage: t(`stages.${project.stage}`), date: formatDate(project.stageEnteredAt, locale) })}</div>
          <div className="mt-1">{t("admin.p360.consent", { date: formatDate(c.consentAt, locale) })}</div>
        </div>
      </Card>

      <Card className="gap-3 p-5">
        <h3 className="font-semibold text-navy">{t("admin.p360.blockers")}</h3>
        {blockers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin.p360.noBlockers")}</p>
        ) : (
          <ul className="space-y-2">
            {sortBlockersByAge(blockers).map((b, i) => (
              <li key={i} className="flex items-start justify-between gap-3 rounded-xl bg-cream/60 px-3 py-2.5">
                <span className="text-sm">{describeBlocker(b, tr)}</span>
                <StatusChip tone={b.severity === "critical" ? "danger" : b.owner === "ADMIN" ? "gold" : "neutral"}>
                  {t(`blockers.owner.${b.owner}`)}
                </StatusChip>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
