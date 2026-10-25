import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SurveyForm } from "@/components/worker/survey-form";
import { requirePageRole } from "@/lib/authz";
import type { SurveyDraft } from "@/lib/survey/requirements";
import { getWorkerJob } from "@/lib/worker/data";

export default async function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole("WORKER", "ADMIN");
  const { id } = await params;
  const job = await getWorkerJob(user, id);
  if (!job.survey) notFound();
  if (job.survey.status === "SUBMITTED") redirect(`/worker/jobs/${id}`);
  const t = await getTranslations("survey");
  const s = job.survey;
  const initial: SurveyDraft = {
    roofLengthM: s.roofLengthM,
    roofWidthM: s.roofWidthM,
    roofType: s.roofType,
    buildingHeightM: s.buildingHeightM,
    southShadowFree: s.southShadowFree,
    shadowNotes: s.shadowNotes,
    roofToMeterVerticalM: s.roofToMeterVerticalM,
    roofToMeterHorizontalM: s.roofToMeterHorizontalM,
    panelToInverterVerticalM: s.panelToInverterVerticalM,
    panelToInverterHorizontalM: s.panelToInverterHorizontalM,
    inverterToMeterM: s.inverterToMeterM,
    phaseObserved: s.phaseObserved,
    notes: s.notes,
  };
  return (
    <div>
      <Link href={`/worker/jobs/${id}`} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy">
        <ChevronLeft className="size-4" aria-hidden />
        {job.customer.user.name}
      </Link>
      <h1 className="mb-4 text-2xl font-semibold">{t("title")}</h1>
      <SurveyForm
        projectId={id}
        initial={initial}
        started={s.status !== "SCHEDULED"}
        serverPhotos={job.photos.filter((p) => p.kind === "SURVEY_ROOF" || p.kind === "SURVEY_SHADOW")}
        customerLabel={job.customer.user.name}
      />
    </div>
  );
}
