"use client";

import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useErrorText } from "@/hooks/use-error-text";
import { acceptQuoteAction, requestRevisionAction } from "@/lib/actions/quotes";

export function AcceptQuote({ quoteId, kw, total, advance }: { quoteId: string; kw: number; total: string; advance: string }) {
  const t = useTranslations("quote");
  const tc = useTranslations("common");
  const router = useRouter();
  const errorText = useErrorText();
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <Button size="lg" className="h-12 w-full text-base sm:w-auto" onClick={() => setOpen(true)}>
        <CheckCircle2 className="size-5" aria-hidden />
        {t("accept")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("acceptTitle")}</DialogTitle>
            <DialogDescription>{t("acceptBody", { kw, total, advance })}</DialogDescription>
          </DialogHeader>
          <label className="flex gap-3 rounded-xl bg-cream p-3 text-sm">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--navy)]" />
            {t("acceptConfirm")}
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              disabled={!agreed || pending}
              onClick={() =>
                start(async () => {
                  const res = await acceptQuoteAction(quoteId);
                  if (!res.ok) {
                    toast.error(res.error.code === "QUOTE_EXPIRED" ? t("expired") : errorText(res.error));
                    setOpen(false);
                    return router.refresh();
                  }
                  toast.success(t("acceptedToast"));
                  setOpen(false);
                  router.push("/portal/payments");
                  router.refresh();
                })
              }
            >
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {t("acceptButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RequestRevision() {
  const t = useTranslations("quote");
  const errorText = useErrorText();
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  return (
    <Button
      size="lg"
      disabled={pending || sent}
      onClick={() =>
        start(async () => {
          const res = await requestRevisionAction();
          if (!res.ok) return void toast.error(errorText(res.error));
          setSent(true);
          toast.success(t("revisionRequested"));
        })
      }
    >
      <RotateCcw className="size-4" aria-hidden />
      {sent ? t("revisionRequested") : t("requestRevision")}
    </Button>
  );
}
