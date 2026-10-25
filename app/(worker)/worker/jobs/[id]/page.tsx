import { ChevronLeft, ClipboardCheck, MapPin, Navigation, Phone, Wrench } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { StatusChip } from "@/components/shared/status-chip";
import { requirePageRole } from "@/lib/authz";
import { formatDateTime, formatMobile } from "@/lib/format";
import { getWorkerJob } from "@/lib/worker/data";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole("WORKER", "ADMIN");
  const { id } = await params;
  const job = await getWorkerJob(user, id);
  const t = await getTranslations();
  const locale = await getLocale();
  const c = job.customer;
  const address = [c.addressLine1, c.addressLine2, c.city, c.state, c.pincode].filter(Boolean).join(", ");
  const survey = job.survey;
  const surveyDone = survey?.status === "SUBMITTED";
  const showInstall = job.stage === "INSTALLATION" || Boolean(job.installedAt);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link href="/worker" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy">
        <ChevronLeft className="size-4" aria-hidden />
        {t("worker.title")}
      </Link>
      <Card className="gap-3 p-5">
        <div className="text-xs font-medium tracking-wide text-gold-ink uppercase">{t("worker.customer")}</div>
        <h1 className="text-xl font-semibold">
          {c.salutation} {c.user.name}
        </h1>
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
          {address}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {c.user.phone ? (
            <a href={`tel:+91${c.user.phone}`} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-navy text-sm font-medium text-white">
              <Phone className="size-4" aria-hidden />
              {formatMobile(c.user.phone)}
            </a>
          ) : null}
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`}
            target="_blank"
            rel="noopener"
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-white text-sm font-medium text-navy"
          >
            <Navigation className="size-4" aria-hidden />
            {t("worker.directions")}
          </a>
        </div>
      </Card>

      {survey ? (
        <Card className="gap-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-navy">
              <ClipboardCheck className="size-5" aria-hidden />
              {t("worker.type.SURVEY")}
            </h2>
            <StatusChip tone={surveyDone ? "success" : "info"}>{t(`admin.assign.status.${survey.status}`)}</StatusChip>
          </div>
          <p className="text-sm text-muted-foreground">
            {surveyDone && survey.submittedAt ? t("worker.surveyDone", { date: formatDateTime(survey.submittedAt, locale) }) : formatDateTime(survey.scheduledAt, locale)}
          </p>
          {!surveyDone ? (
            <Link href={`/worker/jobs/${job.id}/survey`} className="flex h-14 items-center justify-center rounded-xl bg-navy text-base font-medium text-white">
              {survey.status === "IN_PROGRESS" ? t("worker.continueSurvey") : t("worker.startSurvey")}
            </Link>
          ) : null}
        </Card>
      ) : null}

      {showInstall ? (
        <Card className="gap-3 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-navy">
            <Wrench className="size-5" aria-hidden />
            {t("worker.type.INSTALLATION")}
          </h2>
          <Link href={`/worker/jobs/${job.id}/installation`} className="flex h-14 items-center justify-center rounded-xl bg-navy text-base font-medium text-white">
            {t("worker.openInstallation")}
          </Link>
        </Card>
      ) : null}
    </div>
  );
}
