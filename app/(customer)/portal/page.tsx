import { ArrowRight, CircleAlert, Clock, Sparkles } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { EventList } from "@/components/customer/event-list";
import { StageStepper, type StepperStage } from "@/components/customer/stage-stepper";
import { LiveIndicator } from "@/components/shared/live-indicator";
import { Card } from "@/components/ui/card";
import { requirePageRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { customerActionHref, describeBlocker } from "@/lib/i18n/blockers";
import { getCustomerProject } from "@/lib/portal/data";
import { projectTopic } from "@/lib/realtime/topics";
import { STAGE_TYPICAL_DAYS } from "@/lib/workflow/stages";
import { isProjectComplete, stageIndex, STAGES } from "@/lib/workflow/stateMachine";

export default async function TrackerPage() {
  const user = await requirePageRole("CUSTOMER");
  const { project, snapshot, blockers } = await getCustomerProject(user);
  const locale = await getLocale();
  const t = await getTranslations();
  const tr = (key: string, values?: Record<string, string | number>) =>
    t(key as Parameters<typeof t>[0], values as never);

  const events = await db.projectEvent.findMany({
    where: { projectId: project.id, internal: false },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, messageEn: true, messageHi: true, createdAt: true },
  });

  const complete = isProjectComplete(snapshot);
  const current = stageIndex(project.stage);
  const stamps = (project.stageTimestamps ?? {}) as Record<string, string>;
  const stages: StepperStage[] = STAGES.map((s, i) => ({
    key: s,
    label: t(`stages.${s}`),
    state: complete || i < current ? "done" : i === current ? "current" : "todo",
    date: stamps[s] && i <= current ? formatDate(stamps[s], locale) : undefined,
  }));

  const mine = blockers.filter((b) => b.owner === "CUSTOMER");
  const cityName = t.has(`auth.cities.${project.cityCode}` as "auth.cities.RPR")
    ? t(`auth.cities.${project.cityCode}` as "auth.cities.RPR")
    : project.customer.city;

  const statusCard = complete ? (
    <Card className="border-l-gold border-l-4 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <Sparkles className="text-gold-ink mt-0.5 size-5" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold">{t("tracker.completeTitle")}</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("tracker.allDone", {
              date: project.amcEndDate ? formatDate(project.amcEndDate, locale) : "—",
            })}
          </p>
        </div>
      </div>
    </Card>
  ) : (
    <Card className={`border-l-4 p-5 sm:p-6 ${mine.length ? "border-l-gold" : "border-l-navy"}`}>
      <div className="text-gold-ink text-xs font-medium tracking-wide uppercase">
        {t("tracker.stepOf", { current: current + 1, total: STAGES.length })} · {t(`stages.${project.stage}`)}
      </div>
      {mine.length ? (
        <>
          <h2 className="mt-2 flex items-center gap-2 text-lg font-semibold">
            <CircleAlert className="text-gold-ink size-5" aria-hidden />
            {t("tracker.actionNeeded")}
          </h2>
          <ul className="mt-3 space-y-2.5">
            {mine.map((b, i) => {
              const href = customerActionHref(b.code);
              return (
                <li
                  key={i}
                  className="bg-cream/60 flex flex-col gap-2 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span
                    className={`text-sm ${b.severity === "critical" ? "text-danger font-medium" : "text-foreground"}`}
                  >
                    {describeBlocker(b, tr)}
                  </span>
                  {href ? (
                    <Link
                      href={href}
                      className="bg-navy hover:bg-navy-soft inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-medium text-white"
                    >
                      {href.includes("documents")
                        ? b.code === "DOC_REJECTED"
                          ? t("actions.reuploadDocument")
                          : t("actions.uploadDocuments")
                        : href.includes("quote")
                          ? t("actions.viewQuote")
                          : t("actions.payNow")}
                      <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <>
          <h2 className="mt-2 flex items-center gap-2 text-lg font-semibold">
            <Clock className="text-navy size-5" aria-hidden />
            {t("tracker.working")}
          </h2>
          <p className="text-foreground mt-1.5 text-sm">{t(`tracker.workingOn.${project.stage}`)}</p>
          <p className="text-muted-foreground mt-3 text-xs">
            {STAGE_TYPICAL_DAYS[project.stage] > 0
              ? `${t("tracker.eta", { days: STAGE_TYPICAL_DAYS[project.stage] })} · `
              : ""}
            {t("tracker.since", { date: formatDate(project.stageEnteredAt, locale) })}
            {project.targetCompletionDate
              ? ` · ${t("tracker.targetDate", { date: formatDate(project.targetCompletionDate, locale) })}`
              : ""}
          </p>
        </>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-sm">
            {t("tracker.greeting", { name: user.name.split(" ")[0] })}
          </p>
          <h1 className="text-2xl font-semibold sm:text-[28px]">{t("tracker.title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {project.systemKw
              ? t("tracker.projectFor", { kw: project.systemKw, city: cityName })
              : t("tracker.sizeTbd", { city: cityName })}
          </p>
        </div>
        <LiveIndicator topics={[projectTopic(project.id)]} />
      </div>

      <Card className="p-5 sm:p-6">
        <StageStepper stages={stages} currentSlot={<div className="md:hidden">{statusCard}</div>} />
      </Card>

      <div className="hidden md:block">{statusCard}</div>

      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("tracker.recent")}</h2>
          <Link href="/portal/timeline" className="text-gold-ink text-sm font-medium hover:underline">
            {t("tracker.viewTimeline")}
          </Link>
        </div>
        <EventList events={events} locale={locale} emptyText={t("timeline.empty")} />
      </Card>
    </div>
  );
}
