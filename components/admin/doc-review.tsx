"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useErrorText } from "@/hooks/use-error-text";
import { reviewDocumentAction } from "@/lib/actions/documents";

export function DocReview({ documentId, docName, status }: { documentId: string; docName: string; status: string }) {
  const t = useTranslations("admin.docs");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const run = (input: Parameters<typeof reviewDocumentAction>[0], success: string) =>
    start(async () => {
      const res = await reviewDocumentAction(input);
      if (!res.ok) return void toast.error(errorText(res.error));
      toast.success(success);
      setOpen(false);
      setReason("");
      router.refresh();
    });

  return (
    <div className="flex gap-2">
      {status !== "APPROVED" ? (
        <Button size="sm" disabled={pending} onClick={() => run({ documentId, decision: "APPROVE" }, t("approved"))}>
          <Check className="size-3.5" aria-hidden />
          {t("approve")}
        </Button>
      ) : null}
      {status !== "REJECTED" ? (
        <Button size="sm" variant="destructive" disabled={pending} onClick={() => setOpen(true)}>
          <X className="size-3.5" aria-hidden />
          {t("reject")}
        </Button>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("rejectTitle", { doc: docName })}</DialogTitle>
            <DialogDescription>{t("rejectReason")}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("rejectPlaceholder")}
            rows={3}
            maxLength={300}
            aria-label={t("rejectReason")}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={pending || reason.trim().length < 3}
              onClick={() => run({ documentId, decision: "REJECT", reason }, t("rejected"))}
            >
              {t("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
