"use client";

import { Landmark, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, NativeSelect } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/hooks/use-error-text";
import { requestReceiptUploadAction, submitOfflinePaymentAction } from "@/lib/actions/payments";
import { ACCEPT_ATTR, compressIfImage, effectiveMime, MAX_BYTES, uploadWithRetry } from "@/lib/client/upload";

export function OfflinePaymentForm({ milestone, bank }: { milestone: "ADVANCE" | "BALANCE"; bank: { name: string; bankName: string; account: string; ifsc: string } }) {
  const t = useTranslations("payments");
  const tc = useTranslations("common");
  const router = useRouter();
  const errorText = useErrorText();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<"BANK_TRANSFER" | "LOAN">("BANK_TRANSFER");
  const [utr, setUtr] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, start] = useTransition();
  const [fieldError, setFieldError] = useState<string | undefined>();

  const submit = () =>
    start(async () => {
      setFieldError(undefined);
      let receiptPath: string | null = null;
      if (file) {
        if (file.size > MAX_BYTES) return void toast.error(errorText({ code: "FILE_TOO_LARGE" }));
        const f = await compressIfImage(file);
        const res = await requestReceiptUploadAction({ mimeType: effectiveMime(f), size: f.size });
        if (!res.ok) return void toast.error(errorText(res.error));
        try {
          await uploadWithRetry({ ...res.data, file: f, contentType: effectiveMime(f), onProgress: () => undefined });
          receiptPath = res.data.path;
        } catch {
          return void toast.error(errorText({ code: "UPLOAD_FAILED" }));
        }
      }
      const res = await submitOfflinePaymentAction({ milestone, method, utr, receiptPath });
      if (!res.ok) {
        if (res.error.fieldErrors?.utr) return setFieldError(res.error.fieldErrors.utr[0]);
        return void toast.error(errorText(res.error));
      }
      toast.success(t("offlineSubmitted"));
      setOpen(false);
      router.refresh();
    });

  return (
    <>
      <Button variant="outline" size="lg" className="h-12 w-full" onClick={() => setOpen(true)}>
        <Landmark className="size-4" aria-hidden />
        {t("paidOffline")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("offlineTitle")}</DialogTitle>
          </DialogHeader>
          <div className="rounded-xl bg-cream p-3 text-xs leading-relaxed">
            <div className="mb-1 font-semibold text-navy">{t("bankDetails")}</div>
            {bank.name}
            <br />
            {bank.bankName} · A/c {bank.account}
            <br />
            IFSC {bank.ifsc}
          </div>
          <Field id="method" label={t("method")}>
            <NativeSelect id="method" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
              <option value="BANK_TRANSFER">{t("methodBank")}</option>
              <option value="LOAN">{t("methodLoan")}</option>
            </NativeSelect>
          </Field>
          <Field id="utr" label={t("utr")} hint={t("utrHint")} error={fieldError} required>
            <Input id="utr" value={utr} onChange={(e) => setUtr(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} maxLength={22} autoCapitalize="characters" className="tabular" />
          </Field>
          <Field id="receipt" label={t("receipt")}>
            <Input id="receipt" type="file" accept={ACCEPT_ATTR} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="pt-2.5" />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button disabled={pending || utr.length < 8} onClick={submit}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {t("submitOffline")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
