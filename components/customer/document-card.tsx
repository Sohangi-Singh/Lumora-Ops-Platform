"use client";

import { Camera, CheckCircle2, CircleAlert, Clock, Eye, FileUp, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { StatusChip, type ChipTone } from "@/components/shared/status-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useErrorText } from "@/hooks/use-error-text";
import { cancelDocumentUploadAction, finalizeDocumentUploadAction, requestDocumentUploadAction } from "@/lib/actions/documents";
import { ACCEPT_ATTR, ACCEPTED_MIME, compressIfImage, effectiveMime, MAX_BYTES, uploadWithRetry } from "@/lib/client/upload";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type DocType = "ELECTRICITY_BILL" | "CONSUMPTION_HISTORY" | "AADHAAR" | "PAN" | "CANCELLED_CHEQUE" | "OTHER";

export type LatestDoc = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  fileName: string;
  createdAt: string;
  version: number;
  extractionStatus: string;
};

const TONE: Record<string, ChipTone> = { NONE: "neutral", PENDING: "warning", APPROVED: "success", REJECTED: "danger" };
const ICON = { NONE: FileUp, PENDING: Clock, APPROVED: CheckCircle2, REJECTED: CircleAlert };

type Phase = { kind: "idle" } | { kind: "uploading"; pct: number; retrying: boolean } | { kind: "verifying" };

export function DocumentCard({
  projectId,
  type,
  required,
  latest,
  locked,
}: {
  projectId: string;
  type: DocType;
  required: boolean;
  latest: LatestDoc | null;
  locked: boolean;
}) {
  const t = useTranslations("docs");
  const locale = useLocale();
  const router = useRouter();
  const errorText = useErrorText();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const status = latest?.status ?? "NONE";
  const Icon = ICON[status];
  const canUpload = !locked && status !== "APPROVED" && phase.kind === "idle";
  const name = t(`types.${type}.name`);

  async function handleFile(original: File | undefined) {
    if (!original) return;
    const mime = effectiveMime(original);
    if (!ACCEPTED_MIME.includes(mime)) return void toast.error(errorText({ code: "FILE_TYPE" }));
    if (original.size > MAX_BYTES) return void toast.error(errorText({ code: "FILE_TOO_LARGE" }));

    setPhase({ kind: "uploading", pct: 0, retrying: false });
    const file = await compressIfImage(original);
    const contentType = effectiveMime(file);
    const reserved = await requestDocumentUploadAction({ projectId, type, fileName: file.name, mimeType: contentType, size: file.size });
    if (!reserved.ok) {
      setPhase({ kind: "idle" });
      return void toast.error(errorText(reserved.error));
    }
    try {
      await uploadWithRetry({
        bucket: reserved.data.bucket,
        path: reserved.data.path,
        token: reserved.data.token,
        file,
        contentType,
        onProgress: (pct) => setPhase({ kind: "uploading", pct, retrying: false }),
        onRetry: () => setPhase((p) => (p.kind === "uploading" ? { ...p, retrying: true } : p)),
      });
    } catch {
      await cancelDocumentUploadAction(reserved.data.documentId);
      setPhase({ kind: "idle" });
      return void toast.error(errorText({ code: "UPLOAD_FAILED" }));
    }
    setPhase({ kind: "verifying" });
    const done = await finalizeDocumentUploadAction(reserved.data.documentId);
    setPhase({ kind: "idle" });
    if (!done.ok) return void toast.error(errorText(done.error));
    toast.success(t("uploaded", { doc: name }));
    router.refresh();
  }

  return (
    <Card className={cn("gap-0 p-5", status === "REJECTED" && "ring-danger/40")}>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            status === "APPROVED" ? "bg-success-soft text-success" : status === "REJECTED" ? "bg-danger-soft text-danger" : "bg-cream text-navy",
          )}
        >
          <Icon className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-navy">{name}</h3>
            <StatusChip tone={TONE[status]}>{t(`status.${status}`)}</StatusChip>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {required ? null : <span className="font-medium">{t("optional")} · </span>}
            {t(`types.${type}.why`)}
          </p>
        </div>
      </div>

      {status === "REJECTED" && latest?.rejectionReason ? (
        <div role="alert" className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {t("rejectedReason", { reason: latest.rejectionReason })}
        </div>
      ) : null}

      {latest ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-cream/60 px-3 py-2 text-xs text-muted-foreground">
          <span className="truncate">
            {t("lastUploaded", { file: latest.fileName, date: formatDate(latest.createdAt, locale) })}
            {latest.version > 1 ? ` · ${t("version", { n: latest.version })}` : ""}
          </span>
          <a href={`/api/documents/${latest.id}`} target="_blank" rel="noopener" className="inline-flex shrink-0 items-center gap-1 font-medium text-navy hover:underline">
            <Eye className="size-3.5" aria-hidden />
            {t("view")}
          </a>
        </div>
      ) : null}

      {type === "ELECTRICITY_BILL" && latest && ["QUEUED", "RUNNING"].includes(latest.extractionStatus) ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {t("readingBill")}
        </p>
      ) : null}

      {phase.kind !== "idle" ? (
        <div className="mt-4 space-y-1.5" aria-live="polite">
          <Progress value={phase.kind === "verifying" ? 100 : phase.pct} />
          <p className="text-xs text-muted-foreground">
            {phase.kind === "verifying" ? t("verifying") : phase.retrying ? t("retrying") : t("uploading", { pct: phase.pct })}
          </p>
        </div>
      ) : canUpload ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT_ATTR}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button size="lg" className="flex-1 sm:flex-none" onClick={() => fileRef.current?.click()}>
            <FileUp className="size-4" aria-hidden />
            {latest ? t("replace") : t("chooseFile")}
          </Button>
          <Button size="lg" variant="outline" className="flex-1 sm:hidden" onClick={() => cameraRef.current?.click()}>
            <Camera className="size-4" aria-hidden />
            {t("takePhoto")}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
