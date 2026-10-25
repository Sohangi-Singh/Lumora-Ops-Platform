import { getLocale, getTranslations } from "next-intl/server";
import { AssignSurvey } from "@/components/admin/assign-survey";
import { StageActions } from "@/components/admin/stage-actions";
import { StatusChip } from "@/components/shared/status-chip";
import { Card } from "@/components/ui/card";
import type { Project360 } from "@/lib/admin/data";
import { db } from "@/lib/db";
import { formatDateTime, toIstLocalInput } from "@/lib/format";

export async function ActionsTab({ data }: { data: Project360 }) {
  const t = await getTranslations("admin.assign");
  const ts = await getTranslations("admin.stage");
  const locale = await getLocale();
  const { project } = data;
  const workers = await db.user.findMany({
    where: { role: "WORKER", isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { assignedProjects: { where: { completedAt: null } } } } },
  });
  const survey = project.survey;
  const canSchedule = ["DOCUMENTS", "SURVEY"].includes(project.stage) && survey?.status !== "SUBMITTED";

  const showStage = ["SUBSIDY_APPLICATION", "INSTALLATION", "NET_METERING", "COMMISSIONED", "SUBSIDY_CREDITED"].includes(project.stage);
  const waitingOn = data.blockers[0]?.owner;

  return (
    <div className="space-y-5">
      {showStage ? (
        <Card className="gap-4 p-5">
          <h3 className="font-semibold text-navy">{ts("title")}</h3>
          <StageActions
            projectId={project.id}
            stage={project.stage}
            materialDispatchedAt={project.materialDispatchedAt?.toISOString() ?? null}
            installedAt={project.installedAt?.toISOString() ?? null}
            netMeteringFiledAt={project.netMeteringFiledAt?.toISOString() ?? null}
            amcEndDate={project.amcEndDate?.toISOString() ?? null}
            completed={Boolean(project.completedAt)}
            workers={workers.map((w) => ({ id: w.id, name: w.name }))}
            defaultWorkerId={project.assignedWorkerId}
          />
        </Card>
      ) : waitingOn && waitingOn !== "ADMIN" ? (
        <p className="text-sm text-muted-foreground">{ts("waiting", { who: ts(`who.${waitingOn}`) })}</p>
      ) : null}
      <Card className="gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-navy">{t("title")}</h3>
          {survey ? <StatusChip tone={survey.status === "SUBMITTED" ? "success" : "info"}>{t(`status.${survey.status}`)}</StatusChip> : null}
        </div>
        {survey ? (
          <p className="text-sm text-muted-foreground">{t("current", { worker: survey.worker.name, date: formatDateTime(survey.scheduledAt, locale) })}</p>
        ) : null}
        {canSchedule ? (
          <AssignSurvey
            projectId={project.id}
            workers={workers.map((w) => ({ id: w.id, name: w.name, openJobs: w._count.assignedProjects }))}
            current={survey ? { workerId: survey.workerId, scheduledAtLocal: toIstLocalInput(survey.scheduledAt) } : null}
          />
        ) : null}
      </Card>
    </div>
  );
}
