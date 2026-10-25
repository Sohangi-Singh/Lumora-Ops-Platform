import { CheckCircle2, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DocumentCard, type LatestDoc } from "@/components/customer/document-card";
import { LiveIndicator } from "@/components/shared/live-indicator";
import { PageHeader } from "@/components/shared/page-header";
import { requirePageRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { getCustomerProject } from "@/lib/portal/data";
import { projectTopic } from "@/lib/realtime/topics";
import { REQUIRED_DOCUMENTS } from "@/lib/workflow/stateMachine";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("docs"))("title") };
}

const CARDS = [
  { type: "ELECTRICITY_BILL", required: true },
  { type: "CONSUMPTION_HISTORY", required: false },
  { type: "AADHAAR", required: true },
  { type: "PAN", required: true },
  { type: "CANCELLED_CHEQUE", required: true },
  { type: "OTHER", required: false },
] as const;

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requirePageRole("CUSTOMER");
  const { project } = await getCustomerProject(user);
  const t = await getTranslations("docs");
  const { welcome } = await searchParams;

  const docs = await db.document.findMany({
    where: { projectId: project.id, isLatest: true, uploaded: true },
    select: { id: true, type: true, status: true, rejectionReason: true, fileName: true, createdAt: true, version: true, extractionStatus: true },
  });
  const byType = new Map(docs.map((d) => [d.type, d]));
  const locked = project.stage !== "REGISTERED" && project.stage !== "DOCUMENTS";
  const allApproved = REQUIRED_DOCUMENTS.every((d) => byType.get(d)?.status === "APPROVED");

  return (
    <div>
      <PageHeader title={t("title")} description={t("subtitle")} actions={<LiveIndicator topics={[projectTopic(project.id)]} />} />

      {welcome ? <div className="mb-5 rounded-xl border border-gold/40 bg-gold-soft px-4 py-3 text-sm text-navy">{t("welcome")}</div> : null}
      {allApproved ? (
        <div className="mb-5 flex items-center gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm font-medium text-success">
          <CheckCircle2 className="size-4" aria-hidden />
          {locked ? t("locked") : t("allApproved")}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {CARDS.map(({ type, required }) => {
          const d = byType.get(type);
          const latest: LatestDoc | null = d
            ? { ...d, createdAt: d.createdAt.toISOString(), extractionStatus: d.extractionStatus }
            : null;
          return <DocumentCard key={type} projectId={project.id} type={type} required={required} latest={latest} locked={locked && type !== "OTHER"} />;
        })}
      </div>

      <p className="mt-6 flex items-start gap-2 rounded-xl bg-white/70 p-4 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-navy" aria-hidden />
        {t("privacy")}
      </p>
    </div>
  );
}
