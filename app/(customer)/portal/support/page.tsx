import { Mail, Phone } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { TicketForm } from "@/components/customer/ticket-form";
import { PageHeader } from "@/components/shared/page-header";
import { StatusChip } from "@/components/shared/status-chip";
import { Card } from "@/components/ui/card";
import { requirePageRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getCustomerProject } from "@/lib/portal/data";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("support"))("title") };
}

export default async function SupportPage() {
  const user = await requirePageRole("CUSTOMER");
  const { project } = await getCustomerProject(user);
  const t = await getTranslations("support");
  const locale = await getLocale();
  const settings = await getSettings();
  const tickets = await db.serviceTicket.findMany({ where: { projectId: project.id }, orderBy: { createdAt: "desc" }, include: { photos: { where: { uploaded: true }, select: { id: true } } } });
  const open = Boolean(project.commissionedAt || project.completedAt);
  const phoneHref = settings.company.supportPhone.replace(/[^\d+]/g, "");

  return (
    <div className="space-y-5">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="grid gap-3 sm:grid-cols-2">
        <a href={`tel:${phoneHref}`} className="flex items-center gap-3 rounded-2xl bg-navy p-4 text-white hover:bg-navy-soft">
          <Phone className="size-5 text-gold" aria-hidden />
          <span>
            <span className="block text-xs text-white/70">{t("call")}</span>
            <span className="font-semibold tabular">{settings.company.supportPhone}</span>
          </span>
        </a>
        <a href={`mailto:${settings.company.supportEmail}`} className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-border hover:ring-navy/30">
          <Mail className="size-5 text-navy" aria-hidden />
          <span className="min-w-0">
            <span className="block text-xs text-muted-foreground">{t("email")}</span>
            <span className="block truncate font-semibold text-navy">{settings.company.supportEmail}</span>
          </span>
        </a>
      </div>

      <Card className="gap-3 p-5">
        <div>
          <h2 className="text-lg font-semibold">{t("raise")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("raiseHint")}
            {project.amcEndDate ? ` ${t("amcUntil", { date: formatDate(project.amcEndDate, locale) })}` : ""}
          </p>
        </div>
        {open ? <TicketForm /> : <p className="rounded-xl bg-cream px-3 py-2 text-sm text-muted-foreground">{t("locked")}</p>}
      </Card>

      <Card className="gap-0 p-0">
        <h2 className="px-5 pt-4 pb-2 font-semibold text-navy">{t("mine")}</h2>
        {tickets.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">{t("none")}</p>
        ) : (
          <ul>
            {tickets.map((k) => (
              <li key={k.id} className="border-t border-border/60 px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-navy">{t(`categories.${k.category}` as "categories.OTHER")}</span>
                  <StatusChip tone={k.status === "RESOLVED" || k.status === "CLOSED" ? "success" : k.status === "IN_PROGRESS" ? "info" : "warning"}>
                    {t(`status.${k.status}`)}
                  </StatusChip>
                </div>
                <p className="mt-1 text-sm">{k.description}</p>
                {k.adminNote ? <p className="mt-1 rounded-lg bg-cream px-2 py-1 text-xs">{t("reply", { note: k.adminNote })}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(k.createdAt, locale)}
                  {k.photos.length ? ` · ${k.photos.length} 📷` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
