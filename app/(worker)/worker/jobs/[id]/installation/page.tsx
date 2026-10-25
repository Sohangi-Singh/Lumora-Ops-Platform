import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { InstallationPanel } from "@/components/worker/installation-panel";
import { LiveIndicator } from "@/components/shared/live-indicator";
import { requirePageRole } from "@/lib/authz";
import { projectTopic } from "@/lib/realtime/topics";
import { getWorkerJob } from "@/lib/worker/data";

export default async function InstallationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole("WORKER", "ADMIN");
  const { id } = await params;
  const job = await getWorkerJob(user, id);
  const t = await getTranslations("worker.install");
  return (
    <div className="mx-auto max-w-xl">
      <Link href={`/worker/jobs/${id}`} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy">
        <ChevronLeft className="size-4" aria-hidden />
        {job.customer.user.name}
      </Link>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <LiveIndicator topics={[projectTopic(id)]} />
      </div>
      <InstallationPanel
        projectId={id}
        dispatchedAt={job.materialDispatchedAt?.toISOString() ?? null}
        receivedAt={job.materialReceivedAt?.toISOString() ?? null}
        installedAt={job.installedAt?.toISOString() ?? null}
        notes={job.installationNotes}
        serverPhotos={job.photos.filter((p) => p.kind === "INSTALL_BEFORE" || p.kind === "INSTALL_AFTER")}
        customerLabel={job.customer.user.name}
      />
    </div>
  );
}
