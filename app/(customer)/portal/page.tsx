import { ArrowRight, CircleAlert, Clock, Sparkles } from "lucide-react";
import Image from "next/image";
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
    <Card className="relative p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="icon-bubble size-10 shrink-0"><Sparkles className="size-5" aria-hidden /></span>
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
    <Card className="relative p-5 sm:p-6">
      <span aria-hidden className={`absolute inset-y-5 left-0 w-1.5 rounded-r-full ${mine.length ? "bg-sun" : "bg-gradient-to-b from-navy to-gold"}`} />
      <div className="text-gold-ink text-xs font-medium tracking-wide uppercase">
        {t("tracker.stepOf", { current: current + 1, total: STAGES.length })} · {t(`stages.${project.stage}`)}
      </div>
      {mine.length ? (
        <>
          <h2 className="mt-2 flex items-center gap-2 text-lg font-semibold">
            <span className="icon-bubble size-9"><CircleAlert className="size-5" aria-hidden /></span>
            {t("tracker.actionNeeded")}
          </h2>
          <ul className="mt-3 space-y-2.5">
            {mine.map((b, i) => {
              const href = customerActionHref(b.code);
              return (
                <li
                  key={i}
                  className="bg-cream/60 lift flex flex-col gap-2 rounded-2xl p-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span
                    className={`text-sm ${b.severity === "critical" ? "text-danger font-medium" : "text-foreground"}`}
                  >
                    {describeBlocker(b, tr)}
                  </span>
                  {href ? (
                    <Link
                      href={href}
                      className="group/cta inline-flex min-h-10 shrink-0 py-2 text-center leading-tight items-center justify-center gap-1.5 rounded-full bg-gradient-to-br from-navy to-navy-soft px-5 text-sm font-medium text-white shadow-[0_6px_16px_-6px_rgb(27_38_59/0.55)] transition-transform hover:-translate-y-px"
                    >
                      {href.includes("documents")
                        ? b.code === "DOC_REJECTED"
                          ? t("actions.reuploadDocument")
                          : t("actions.uploadDocuments")
                        : href.includes("quote")
                          ? t("actions.viewQuote")
                          : t("actions.payNow")}
                      <ArrowRight className="size-4 transition-transform group-hover/cta:translate-x-0.5" aria-hidden />
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
            <span className="icon-bubble size-9"><Clock className="size-5" aria-hidden /></span>
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

  const pct = complete ? 100 : Math.round((current / (STAGES.length - 1)) * 100);

  return (
    <div className="stagger space-y-6">
      <section className="hero-navy relative overflow-hidden rounded-[2rem] p-6 shadow-lift sm:p-8">
        <svg aria-hidden viewBox="0 0 400 60" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-14 w-full text-white/[0.05]">
          <path d="M0 30 C 80 0, 160 60, 260 25 S 360 10, 400 28 L400 60 L0 60 Z" fill="currentColor" />
        </svg>
        <Image
          src="/brand/mark.png"
          alt=""
          width={640}
          height={479}
          className="animate-float pointer-events-none absolute -top-2 -right-6 w-40 opacity-60 sm:opacity-95 drop-shadow-[0_12px_30px_rgb(247_167_51/0.35)] sm:right-4 sm:w-52"
        />
        <div className="relative max-w-[70%] sm:max-w-[60%]">
          <p className="text-sm text-white/70">{t("tracker.greeting", { name: user.name.split(" ")[0] })}</p>
          <h1 className="mt-1 text-2xl font-semibold text-white sm:text-[32px]">{t("tracker.title")}</h1>
          <p className="mt-1.5 text-sm text-white/75">
            {project.systemKw
              ? t("tracker.projectFor", { kw: project.systemKw, city: cityName })
              : t("tracker.sizeTbd", { city: cityName })}
          </p>
        </div>
        <div className="relative mt-6 flex flex-wrap items-center gap-4">
          <div className="min-w-48 flex-1">
            <div className="mb-1.5 flex items-baseline justify-between text-xs text-white/70">
              <span>{t(`stages.${project.stage}`)}</span>
              <span className="text-sun text-lg font-bold tabular">{pct}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
              <div className="bg-sun h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(pct, 4)}%` }} />
            </div>
          </div>
          <div className="rounded-full bg-white/90 px-3 py-1">
            <LiveIndicator topics={[projectTopic(project.id)]} />
          </div>
        </div>
      </section>

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
