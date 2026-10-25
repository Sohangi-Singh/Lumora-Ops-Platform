"use client";

import { CheckCircle2, CircleAlert, Plus, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { NativeSelect } from "@/components/shared/form";
import { StatusChip } from "@/components/shared/status-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/hooks/use-error-text";
import { rerunExtractionAction, saveBillDataAction } from "@/lib/actions/bill";
import { formatMonthKey } from "@/lib/format";

const TEXT_FIELDS = ["serviceNo", "consumerName", "billAddress", "purpose", "tariffCategory"] as const;
const NUM_FIELDS = ["sanctionedLoadW", "connectedLoadKw", "currentReading", "previousReading", "billedUnits", "netBillAmount", "existingSolarExport"] as const;
type TextField = (typeof TEXT_FIELDS)[number];
type NumField = (typeof NUM_FIELDS)[number];

export type BillEditorProps = {
  projectId: string;
  fields: Record<TextField, string | null> & Record<NumField, number | null> & { phase: "SINGLE" | "THREE" | null };
  months: { month: string; units: number; source?: "BILL" | "HISTORY" | "MANUAL" }[];
  checks: { code: string; ok: boolean; critical: boolean; detail: string }[];
  confidence: number | null;
  source: "AI" | "PARSER" | "MANUAL" | null;
  needsReview: boolean;
  confirmed: boolean;
  extraction: { status: string; error: string | null } | null;
  preview: { id: string; mimeType: string } | null;
};

type Row = { key: number; month: string; units: string; source: "BILL" | "HISTORY" | "MANUAL" };

export function BillEditor(props: BillEditorProps) {
  const t = useTranslations("admin.bill");
  const locale = useLocale();
  const router = useRouter();
  const errorText = useErrorText();
  const [pending, start] = useTransition();

  const [text, setText] = useState<Record<TextField, string>>(() =>
    Object.fromEntries(TEXT_FIELDS.map((k) => [k, props.fields[k] ?? ""])) as Record<TextField, string>,
  );
  const [nums, setNums] = useState<Record<NumField, string>>(() =>
    Object.fromEntries(NUM_FIELDS.map((k) => [k, props.fields[k]?.toString() ?? ""])) as Record<NumField, string>,
  );
  const [phase, setPhase] = useState<string>(props.fields.phase ?? "");
  const [rows, setRows] = useState<Row[]>(() =>
    props.months.map((m, i) => ({ key: i, month: m.month, units: String(m.units), source: m.source ?? "BILL" })),
  );
  const [nextKey, setNextKey] = useState(props.months.length);

  const valid = rows.filter((r) => /^\d{4}-(0[1-9]|1[0-2])$/.test(r.month) && r.units !== "" && Number(r.units) >= 0);
  const avg = useMemo(() => (valid.length ? Math.round(valid.reduce((s, r) => s + Number(r.units), 0) / valid.length) : 0), [valid]);

  const save = (confirm: boolean) =>
    start(async () => {
      const toNum = (v: string) => (v.trim() === "" ? null : Number(v));
      const toStr = (v: string) => (v.trim() === "" ? null : v.trim());
      const res = await saveBillDataAction({
        projectId: props.projectId,
        confirm,
        fields: {
          ...(Object.fromEntries(TEXT_FIELDS.map((k) => [k, toStr(text[k])])) as Record<TextField, string | null>),
          ...(Object.fromEntries(NUM_FIELDS.map((k) => [k, toNum(nums[k])])) as Record<NumField, number | null>),
          phase: phase === "SINGLE" || phase === "THREE" ? phase : null,
        },
        months: valid.map((r) => ({ month: r.month, units: Number(r.units), source: r.source })),
      });
      if (!res.ok) return void toast.error(errorText(res.error));
      toast.success(confirm ? t("confirmedToast") : t("saved"));
      router.refresh();
    });

  const rerun = () =>
    start(async () => {
      const res = await rerunExtractionAction(props.projectId);
      if (!res.ok) return void toast.error(errorText(res.error));
      toast.success(t("rerunQueued"));
      router.refresh();
    });

  const running = props.extraction && ["QUEUED", "RUNNING"].includes(props.extraction.status);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Card className="gap-3 p-4 xl:sticky xl:top-20 xl:self-start">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-navy">{t("documentPreview")}</h3>
          {props.preview ? (
            <a href={`/api/documents/${props.preview.id}`} target="_blank" rel="noopener" className="text-xs font-medium text-gold-ink hover:underline">
              ↗
            </a>
          ) : null}
        </div>
        {props.preview ? (
          props.preview.mimeType === "application/pdf" ? (
            <iframe src={`/api/documents/${props.preview.id}`} title={t("documentPreview")} className="h-[70vh] w-full rounded-xl border border-border bg-white" />
          ) : props.preview.mimeType.startsWith("image/") && props.preview.mimeType !== "image/heic" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/documents/${props.preview.id}`} alt={t("documentPreview")} className="max-h-[70vh] w-full rounded-xl border border-border object-contain" />
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("noData")}</p>
        )}
      </Card>

      <div className="space-y-5">
        <Card className="gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            {props.source ? <StatusChip tone="info">{t(`source.${props.source}`)}</StatusChip> : null}
            {props.confidence !== null ? (
              <StatusChip tone={props.confidence >= 0.75 ? "success" : "warning"}>{t("confidence", { pct: Math.round(props.confidence * 100) })}</StatusChip>
            ) : null}
            {props.needsReview && !props.confirmed ? <StatusChip tone="warning">{t("needsReview")}</StatusChip> : null}
            <StatusChip tone={props.confirmed ? "success" : "neutral"}>{props.confirmed ? t("confirmed") : t("notConfirmed")}</StatusChip>
            <Button size="sm" variant="ghost" className="ml-auto" disabled={pending || Boolean(running)} onClick={rerun}>
              <RefreshCw className="size-3.5" aria-hidden />
              {t("rerun")}
            </Button>
          </div>
          {running ? <p className="rounded-lg bg-cream px-3 py-2 text-sm text-navy">{t("extracting")}</p> : null}
          {props.extraction?.error && !running ? (
            <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">{t("failed", { error: props.extraction.error })}</p>
          ) : null}

          {props.checks.length ? (
            <div>
              <h4 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("checks")}</h4>
              <ul className="space-y-1.5">
                {props.checks.map((c) => (
                  <li key={c.code} className="flex items-start gap-2 text-sm">
                    {c.ok ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label="OK" />
                    ) : c.critical ? (
                      <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-label="Failed" />
                    ) : (
                      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-label="Warning" />
                    )}
                    <span>
                      <span className="font-medium">{c.code.replaceAll("_", " ").toLowerCase()}</span>
                      <span className="text-muted-foreground"> — {c.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        <Card className="gap-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {TEXT_FIELDS.map((k) => (
              <label key={k} className={k === "billAddress" || k === "consumerName" ? "sm:col-span-2" : ""}>
                <span className="mb-1 block text-xs font-medium text-muted-foreground">{t(`fields.${k}`)}</span>
                <Input value={text[k]} onChange={(e) => setText((s) => ({ ...s, [k]: e.target.value }))} />
              </label>
            ))}
            <label>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">{t("fields.phase")}</span>
              <NativeSelect value={phase} onChange={(e) => setPhase(e.target.value)}>
                <option value="">{t("phase.UNKNOWN")}</option>
                <option value="SINGLE">{t("phase.SINGLE")}</option>
                <option value="THREE">{t("phase.THREE")}</option>
              </NativeSelect>
            </label>
            {NUM_FIELDS.map((k) => (
              <label key={k}>
                <span className="mb-1 block text-xs font-medium text-muted-foreground">{t(`fields.${k}`)}</span>
                <Input
                  inputMode="decimal"
                  className="tabular"
                  value={nums[k]}
                  onChange={(e) => setNums((s) => ({ ...s, [k]: e.target.value.replace(/[^\d.]/g, "") }))}
                />
              </label>
            ))}
          </div>
        </Card>

        <Card className="gap-3 p-5">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-navy">{t("months")}</h4>
            <span className="text-xs text-muted-foreground tabular">{valid.length ? t("avg", { avg, n: valid.length }) : null}</span>
          </div>
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.key} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                <Input
                  type="month"
                  value={r.month}
                  aria-label={t("month")}
                  onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, month: e.target.value, source: "MANUAL" } : x)))}
                />
                <Input
                  inputMode="numeric"
                  className="tabular"
                  value={r.units}
                  aria-label={t("units")}
                  onChange={(e) =>
                    setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, units: e.target.value.replace(/[^\d.]/g, ""), source: "MANUAL" } : x)))
                  }
                />
                <Button variant="ghost" size="icon" aria-label={t("remove")} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{rows.length ? rows.map((r) => (r.month ? formatMonthKey(r.month, locale) : "")).filter(Boolean).slice(0, 3).join(", ") + (rows.length > 3 ? "…" : "") : null}</p>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => {
              setRows((rs) => [...rs, { key: nextKey, month: "", units: "", source: "MANUAL" }]);
              setNextKey((k) => k + 1);
            }}
          >
            <Plus className="size-3.5" aria-hidden />
            {t("addMonth")}
          </Button>
        </Card>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" size="lg" disabled={pending} onClick={() => save(false)}>
            {t("save")}
          </Button>
          <Button size="lg" disabled={pending || valid.length < 3} onClick={() => save(true)}>
            <CheckCircle2 className="size-4" aria-hidden />
            {t("saveConfirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}
