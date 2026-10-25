import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { JobCard } from "@/components/worker/job-card";
import { EmptyState } from "@/components/shared/empty-state";
import { LiveIndicator } from "@/components/shared/live-indicator";
import { PageHeader } from "@/components/shared/page-header";
import { requirePageRole } from "@/lib/authz";
import { userTopic } from "@/lib/realtime/topics";
import { listJobs } from "@/lib/worker/data";
import { cn } from "@/lib/utils";
import Link from "next/link";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("worker"))("title") };
}

const BUCKETS = ["today", "upcoming", "done"] as const;

export default async function WorkerHome({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const user = await requirePageRole("WORKER");
  const t = await getTranslations("worker");
  const { show } = await searchParams;
  const active = (BUCKETS as readonly string[]).includes(show ?? "") ? (show as (typeof BUCKETS)[number]) : "today";
  const jobs = await listJobs(user);
  const visible = jobs.filter((j) => j.bucket === active);
  if (active === "done") visible.reverse();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("title")} description={t("subtitle")} actions={<LiveIndicator topics={[userTopic(user.id)]} />} />
      <nav className="mb-4 grid grid-cols-3 gap-1 rounded-2xl bg-white/70 p-1 ring-1 ring-border" aria-label={t("title")}>
        {BUCKETS.map((b) => {
          const n = jobs.filter((j) => j.bucket === b).length;
          return (
            <Link
              key={b}
              href={`/worker?show=${b}`}
              aria-current={active === b ? "page" : undefined}
              className={cn(
                "flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-medium",
                active === b ? "bg-navy text-white" : "text-muted-foreground hover:text-navy",
              )}
            >
              {t(b)}
              <span className={cn("rounded-full px-1.5 text-xs tabular", active === b ? "bg-gold text-navy" : "bg-muted")}>{n}</span>
            </Link>
          );
        })}
      </nav>
      {visible.length === 0 ? (
        <EmptyState title={t(`empty.${active}`)} />
      ) : (
        <div className="space-y-3">
          {visible.map((j) => (
            <JobCard key={`${j.projectId}-${j.type}`} job={j} />
          ))}
        </div>
      )}
    </div>
  );
}
