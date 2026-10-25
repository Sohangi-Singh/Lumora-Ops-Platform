import { Download, ExternalLink } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { DocReview } from "@/components/admin/doc-review";
import { StatusChip, type ChipTone } from "@/components/shared/status-chip";
import { Card } from "@/components/ui/card";
import { db } from "@/lib/db";
import { formatBytes, formatDate } from "@/lib/format";

const TYPES = ["ELECTRICITY_BILL", "CONSUMPTION_HISTORY", "AADHAAR", "PAN", "CANCELLED_CHEQUE", "OTHER"] as const;
const TONE: Record<string, ChipTone> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" };

export async function DocumentsTab({ projectId }: { projectId: string }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const docs = await db.document.findMany({ where: { projectId, uploaded: true }, orderBy: { version: "desc" } });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {TYPES.map((type) => {
        const versions = docs.filter((d) => d.type === type);
        const latest = versions.find((d) => d.isLatest) ?? versions[0];
        const name = t(`docs.types.${type}.name`);
        return (
          <Card key={type} className="gap-3 p-5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-navy">{name}</h3>
              {latest ? <StatusChip tone={TONE[latest.status]}>{t(`docs.status.${latest.status}`)}</StatusChip> : <StatusChip>{t("docs.status.NONE")}</StatusChip>}
            </div>
            {latest ? (
              <>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="truncate">{latest.fileName}</span>
                  <span>{formatBytes(latest.size)}</span>
                  <span>v{latest.version}</span>
                  <span>{formatDate(latest.createdAt, locale)}</span>
                </div>
                {latest.status === "REJECTED" && latest.rejectionReason ? (
                  <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{latest.rejectionReason}</p>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-3 text-sm">
                    <a href={`/api/documents/${latest.id}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-medium text-navy hover:underline">
                      <ExternalLink className="size-3.5" aria-hidden />
                      {t("admin.docs.open")}
                    </a>
                    <a href={`/api/documents/${latest.id}?download=1`} className="inline-flex items-center gap-1 text-muted-foreground hover:underline">
                      <Download className="size-3.5" aria-hidden />
                      {t("admin.docs.download")}
                    </a>
                  </div>
                  <DocReview documentId={latest.id} docName={name} status={latest.status} />
                </div>
                {versions.length > 1 ? (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer">{t("admin.docs.history")} ({versions.length - 1})</summary>
                    <ul className="mt-2 space-y-1">
                      {versions
                        .filter((v) => v.id !== latest.id)
                        .map((v) => (
                          <li key={v.id} className="flex justify-between gap-2">
                            <a href={`/api/documents/${v.id}`} target="_blank" rel="noopener" className="truncate hover:underline">
                              v{v.version} · {v.fileName}
                            </a>
                            <span>
                              {t(`docs.status.${v.status}`)} · {formatDate(v.createdAt, locale)}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </details>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("admin.docs.notUploaded")}</p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
