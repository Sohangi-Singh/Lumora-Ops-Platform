"use client";

import { CheckCircle2, Loader2, PackageCheck, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useErrorText } from "@/hooks/use-error-text";
import { usePhotoQueue } from "@/hooks/use-photo-queue";
import { deletePhotoAction, recordInstallationStepAction } from "@/lib/actions/field";
import { formatDateTime } from "@/lib/format";
import { PhotoCapture, type ServerPhoto } from "./photo-capture";

export function InstallationPanel({
  projectId,
  dispatchedAt,
  receivedAt,
  installedAt,
  notes: initialNotes,
  serverPhotos,
  customerLabel,
}: {
  projectId: string;
  dispatchedAt: string | null;
  receivedAt: string | null;
  installedAt: string | null;
  notes: string | null;
  serverPhotos: ServerPhoto[];
  customerLabel: string;
}) {
  const t = useTranslations("worker.install");
  const locale = useLocale();
  const router = useRouter();
  const errorText = useErrorText();
  const queue = usePhotoQueue(projectId);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [pending, start] = useTransition();
  const photoCount = serverPhotos.length;

  const step = (s: "MATERIAL_RECEIVED" | "INSTALLED") =>
    start(async () => {
      const res = await recordInstallationStepAction({ projectId, step: s, notes: notes || null });
      if (!res.ok) return void toast.error(errorText(res.error));
      toast.success(t("doneToast"));
      router.refresh();
    });

  const capture = (kind: "INSTALL_BEFORE" | "INSTALL_AFTER", label: string) => (
    <PhotoCapture
      kind={kind}
      label={label}
      geo={false}
      stampLabel={`Lumora Solar installation · ${customerLabel}`}
      serverPhotos={serverPhotos}
      queue={queue.items}
      onEnqueue={queue.enqueue}
      onDiscardQueued={queue.discard}
      onDeleteServer={async (id) => {
        const r = await deletePhotoAction(id);
        if (!r.ok) toast.error(errorText(r.error));
        router.refresh();
      }}
    />
  );

  if (!dispatchedAt) {
    return <Card className="p-5 text-sm text-muted-foreground">{t("waitingDispatch")}</Card>;
  }

  return (
    <div className="space-y-4">
      <Card className="gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-semibold text-navy">
            <PackageCheck className="size-5" aria-hidden />
            {t("materialReceived")}
          </span>
          {receivedAt ? (
            <span className="flex items-center gap-1 text-sm text-success">
              <CheckCircle2 className="size-4" aria-hidden />
              {t("receivedAt", { date: formatDateTime(receivedAt, locale) })}
            </span>
          ) : (
            <Button size="lg" disabled={pending} onClick={() => step("MATERIAL_RECEIVED")}>
              {t("markReceived")}
            </Button>
          )}
        </div>
      </Card>

      <Card className="gap-5 p-5">
        {capture("INSTALL_BEFORE", t("before"))}
        {capture("INSTALL_AFTER", t("after"))}
      </Card>

      <Card className="gap-3 p-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy">{t("notes")}</span>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={Boolean(installedAt)} />
        </label>
        {installedAt ? (
          <p className="flex items-center gap-2 text-sm font-medium text-success">
            <CheckCircle2 className="size-4" aria-hidden />
            {t("installedAt", { date: formatDateTime(installedAt, locale) })}
          </p>
        ) : (
          <>
            {photoCount === 0 ? <p className="text-xs text-muted-foreground">{t("needPhoto")}</p> : null}
            <Button size="lg" className="h-14 text-base" disabled={pending || !receivedAt || queue.pendingCount > 0} onClick={() => step("INSTALLED")}>
              {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Wrench className="size-5" aria-hidden />}
              {t("markInstalled")}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
