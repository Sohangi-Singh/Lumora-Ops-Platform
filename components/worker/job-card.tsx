import { ClipboardCheck, MapPin, Navigation, Phone, Wrench } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { StatusChip } from "@/components/shared/status-chip";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import type { Job } from "@/lib/worker/data";

export async function JobCard({ job }: { job: Job }) {
  const t = await getTranslations("worker");
  const locale = await getLocale();
  const Icon = job.type === "SURVEY" ? ClipboardCheck : Wrench;
  const maps = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address)}`;
  return (
    <Card className="gap-3 p-4">
      <Link href={`/worker/jobs/${job.projectId}`} className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cream text-navy">
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <StatusChip tone={job.type === "SURVEY" ? "info" : "gold"}>{t(`type.${job.type}`)}</StatusChip>
            {job.overdue ? <StatusChip tone="danger">{t("overdue")}</StatusChip> : null}
          </span>
          <span className="mt-1 block truncate text-base font-semibold text-navy">{job.customerName}</span>
          <span className="flex items-center gap-1 truncate text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            {job.area}
          </span>
          {job.when ? <span className="mt-0.5 block text-xs text-muted-foreground">{formatDateTime(job.when, locale)}</span> : null}
        </span>
      </Link>
      <div className="grid grid-cols-2 gap-2">
        {job.phone ? (
          <a href={`tel:+91${job.phone}`} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-white text-sm font-medium text-navy">
            <Phone className="size-4" aria-hidden />
            {t("call")}
          </a>
        ) : (
          <span />
        )}
        <a href={maps} target="_blank" rel="noopener" className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-white text-sm font-medium text-navy">
          <Navigation className="size-4" aria-hidden />
          {t("directions")}
        </a>
      </div>
    </Card>
  );
}
