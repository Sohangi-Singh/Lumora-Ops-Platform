"use client";

import { Eye, Loader2, RefreshCw, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, NativeSelect } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/hooks/use-error-text";
import { approveQuoteAction, regenerateQuoteAction } from "@/lib/actions/quotes";

export function ApproveQuoteButton({ quoteId }: { quoteId: string }) {
  const t = useTranslations("admin.quote");
  const router = useRouter();
  const errorText = useErrorText();
  const [pending, start] = useTransition();
  return (
    <Button
      size="lg"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await approveQuoteAction(quoteId);
          if (!res.ok) return void toast.error(errorText(res.error));
          toast.success(t("approved"));
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
      {pending ? t("approving") : t("approve")}
    </Button>
  );
}

/**
 * Override kW / phase / panel count with a mandatory reason. "Preview" renders
 * the PDF live without saving; "Save as new version" supersedes the current one.
 */
export function QuoteOverrides({
  projectId,
  pdfUrl,
  defaults,
  editable,
}: {
  projectId: string;
  pdfUrl: string | null;
  defaults: { systemKw: number | null; phase: "SINGLE" | "THREE" | null; panelCount: number | null };
  editable: boolean;
}) {
  const t = useTranslations("admin.quote");
  const tp = useTranslations("admin.bill.phase");
  const router = useRouter();
  const errorText = useErrorText();
  const [pending, start] = useTransition();
  const [kw, setKw] = useState(defaults.systemKw?.toString() ?? "");
  const [phase, setPhase] = useState<string>(defaults.phase ?? "");
  const [panels, setPanels] = useState(defaults.panelCount?.toString() ?? "");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const changed = kw !== (defaults.systemKw?.toString() ?? "") || phase !== (defaults.phase ?? "") || panels !== (defaults.panelCount?.toString() ?? "");
  const params = new URLSearchParams({ projectId, kw, phase, panels });

  const save = () =>
    start(async () => {
      const res = await regenerateQuoteAction({
        projectId,
        systemKw: kw ? Number(kw) : null,
        phase: phase === "SINGLE" || phase === "THREE" ? phase : null,
        panelCount: panels ? Number(panels) : null,
        reason: reason.trim() || null,
      });
      if (!res.ok) return void toast.error(errorText(res.error));
      toast.success(t("generated"));
      setPreview(null);
      setReason("");
      router.refresh();
    });

  const src = preview ?? pdfUrl;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      {editable ? (
        <Card className="gap-4 self-start p-5">
          <h3 className="font-semibold text-navy">{t("overrides")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field id="kw" label={t("overrideKw")}>
              <Input id="kw" inputMode="decimal" className="tabular" value={kw} onChange={(e) => setKw(e.target.value.replace(/[^\d.]/g, ""))} />
            </Field>
            <Field id="panels" label={t("overridePanels")}>
              <Input id="panels" inputMode="numeric" className="tabular" value={panels} onChange={(e) => setPanels(e.target.value.replace(/\D/g, ""))} placeholder={t("auto")} />
            </Field>
            <Field id="phase" label={t("overridePhase")} className="col-span-2">
              <NativeSelect id="phase" value={phase} onChange={(e) => setPhase(e.target.value)}>
                <option value="">{t("auto")}</option>
                <option value="SINGLE">{tp("SINGLE")}</option>
                <option value="THREE">{tp("THREE")}</option>
              </NativeSelect>
            </Field>
            <Field id="reason" label={t("overrideReason")} className="col-span-2" hint={changed ? t("reasonRequired") : undefined}>
              <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPreview(`/api/quotes/preview?${params.toString()}&t=${Date.now()}`)}>
              <Eye className="size-4" aria-hidden />
              {t("preview")}
            </Button>
            <Button disabled={pending || (changed && reason.trim().length < 3)} onClick={save}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
              {t("regenerate")}
            </Button>
          </div>
        </Card>
      ) : null}
      <Card className={`gap-2 p-3 ${editable ? "" : "xl:col-span-2"}`}>
        {src ? (
          <iframe key={src} src={src} title={t("pdf")} className="h-[78vh] w-full rounded-xl border border-border bg-white" />
        ) : (
          <p className="py-16 text-center text-sm text-muted-foreground">{t("noPdf")}</p>
        )}
      </Card>
    </div>
  );
}

export function GenerateQuoteButton({ projectId }: { projectId: string }) {
  const t = useTranslations("admin.quote");
  const router = useRouter();
  const errorText = useErrorText();
  const [pending, start] = useTransition();
  return (
    <Button
      size="lg"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await regenerateQuoteAction({ projectId, systemKw: null, phase: null, panelCount: null, reason: null });
          if (!res.ok) return void toast.error(errorText(res.error));
          toast.success(t("generated"));
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
      {pending ? t("generating") : t("generate")}
    </Button>
  );
}
