"use client";

import { Check, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, NativeSelect } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/hooks/use-error-text";
import { recordOfflinePaymentAction, reviewOfflinePaymentAction } from "@/lib/actions/payments";

export function VerifyPayment({ paymentId }: { paymentId: string }) {
  const t = useTranslations("admin.pay");
  const tc = useTranslations("common");
  const router = useRouter();
  const errorText = useErrorText();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const run = (decision: "VERIFY" | "REJECT") =>
    start(async () => {
      const res = await reviewOfflinePaymentAction({ paymentId, decision, reason: reason || undefined });
      if (!res.ok) return void toast.error(errorText(res.error));
      toast.success(decision === "VERIFY" ? t("verified") : t("rejected"));
      setOpen(false);
      router.refresh();
    });
  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={() => run("VERIFY")}>
        <Check className="size-3.5" aria-hidden />
        {t("verify")}
      </Button>
      <Button size="sm" variant="destructive" disabled={pending} onClick={() => setOpen(true)}>
        <X className="size-3.5" aria-hidden />
        {t("reject")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectReason")}</DialogTitle>
          </DialogHeader>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} aria-label={t("rejectReason")} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" disabled={pending || reason.trim().length < 3} onClick={() => run("REJECT")}>
              {t("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function RecordPayment({ projectId, milestones }: { projectId: string; milestones: { milestone: "ADVANCE" | "BALANCE"; label: string }[] }) {
  const t = useTranslations("admin.pay");
  const tp = useTranslations("payments");
  const tc = useTranslations("common");
  const router = useRouter();
  const errorText = useErrorText();
  const [open, setOpen] = useState(false);
  const [milestone, setMilestone] = useState(milestones[0]?.milestone ?? "ADVANCE");
  const [method, setMethod] = useState<"BANK_TRANSFER" | "LOAN">("BANK_TRANSFER");
  const [utr, setUtr] = useState("");
  const [pending, start] = useTransition();
  if (!milestones.length) return null;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        {t("record")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("recordTitle")}</DialogTitle>
          </DialogHeader>
          <Field id="ms" label={t("title")}>
            <NativeSelect id="ms" value={milestone} onChange={(e) => setMilestone(e.target.value as typeof milestone)}>
              {milestones.map((m) => (
                <option key={m.milestone} value={m.milestone}>
                  {m.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="pm" label={tp("method")}>
            <NativeSelect id="pm" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
              <option value="BANK_TRANSFER">{tp("methodBank")}</option>
              <option value="LOAN">{tp("methodLoan")}</option>
            </NativeSelect>
          </Field>
          <Field id="ru" label={tp("utr")}>
            <Input id="ru" value={utr} onChange={(e) => setUtr(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} maxLength={22} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              disabled={pending || utr.length < 8}
              onClick={() =>
                start(async () => {
                  const res = await recordOfflinePaymentAction({ projectId, milestone, method, utr });
                  if (!res.ok) return void toast.error(errorText(res.error));
                  toast.success(t("recorded"));
                  setOpen(false);
                  router.refresh();
                })
              }
            >
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {t("record")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
