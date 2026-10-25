import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActionsTab } from "@/components/admin/p360/actions-tab";
import { BillTab } from "@/components/admin/p360/bill-tab";
import { DocumentsTab } from "@/components/admin/p360/documents-tab";
import { OverviewTab } from "@/components/admin/p360/overview-tab";
import { PaymentsTab } from "@/components/admin/p360/payments-tab";
import { QuoteTab } from "@/components/admin/p360/quote-tab";
import { SurveyTab } from "@/components/admin/p360/survey-tab";
import { TimelineTab } from "@/components/admin/p360/timeline-tab";
import { LiveIndicator } from "@/components/shared/live-indicator";
import { StatusChip } from "@/components/shared/status-chip";
import { getProject360 } from "@/lib/admin/data";
import { requirePageRole } from "@/lib/authz";
import { projectTopic } from "@/lib/realtime/topics";
import { cn } from "@/lib/utils";

const TABS = ["overview", "documents", "bill", "survey", "quote", "payments", "timeline", "actions"] as const;
type Tab = (typeof TABS)[number];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getProject360(id);
  return { title: data?.project.customer.user.name ?? "Project" };
}

export default async function Project360Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  await requirePageRole("ADMIN");
  const [{ id }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  const tab: Tab = (TABS as readonly string[]).includes(rawTab ?? "") ? (rawTab as Tab) : "overview";
  const data = await getProject360(id);
  if (!data) notFound();
  const t = await getTranslations();
  const { project } = data;

  return (
    <div>
      <Link href="/admin/projects" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy">
        <ChevronLeft className="size-4" aria-hidden />
        {t("admin.p360.back")}
      </Link>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold sm:text-[28px]">{project.customer.user.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <StatusChip tone={project.completedAt ? "success" : "gold"}>{t(`stages.${project.stage}`)}</StatusChip>
            <span>{project.customer.city}</span>
            {project.systemKw ? <span className="tabular">· {project.systemKw} kW</span> : null}
            {project.billData?.serviceNo ? <span className="tabular">· SN {project.billData.serviceNo}</span> : null}
          </div>
        </div>
        <LiveIndicator topics={[projectTopic(project.id)]} />
      </div>

      <nav aria-label="Project sections" className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1 rounded-2xl bg-white/70 p-1 ring-1 ring-border">
          {TABS.map((k) => (
            <li key={k}>
              <Link
                href={`/admin/projects/${project.id}?tab=${k}`}
                scroll={false}
                aria-current={tab === k ? "page" : undefined}
                className={cn(
                  "block rounded-xl px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                  tab === k ? "bg-navy text-white" : "text-muted-foreground hover:bg-cream hover:text-navy",
                )}
              >
                {t(`admin.p360.tabs.${k}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "overview" ? <OverviewTab data={data} /> : null}
      {tab === "documents" ? <DocumentsTab projectId={project.id} /> : null}
      {tab === "bill" ? <BillTab data={data} /> : null}
      {tab === "survey" ? <SurveyTab data={data} /> : null}
      {tab === "quote" ? <QuoteTab data={data} /> : null}
      {tab === "payments" ? <PaymentsTab data={data} /> : null}
      {tab === "timeline" ? <TimelineTab projectId={project.id} /> : null}
      {tab === "actions" ? <ActionsTab data={data} /> : null}
    </div>
  );
}
