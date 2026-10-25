"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, NativeSelect } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/hooks/use-error-text";
import {
  dispatchMaterialAction,
  fileNetMeteringAction,
  markNetMeterInstalledAction,
  markSubsidyCreditedAction,
  recordSubsidyApplicationAction,
} from "@/lib/actions/stages";
import type { ActionResult } from "@/lib/result";
import { formatDate } from "@/lib/format";

type Props = {
  projectId: string;
  stage: string;
  materialDispatchedAt: string | null;
  installedAt: string | null;
  netMeteringFiledAt: string | null;
  amcEndDate: string | null;
  completed: boolean;
  workers: { id: string; name: string }[];
  defaultWorkerId: string | null;
};

export function StageActions(p: Props) {
  const t = useTranslations("admin.stage");
  const locale = useLocale();
  const router = useRouter();
  const errorText = useErrorText();
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [worker, setWorker] = useState(p.defaultWorkerId ?? p.workers[0]?.id ?? "");

  const run = (fn: () => Promise<ActionResult<unknown>>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(errorText(res.error));
      toast.success(t("done"));
      setText("");
      router.refresh();
    });

  const Go = ({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) => (
    <Button size="lg" disabled={pending || disabled} onClick={onClick}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ArrowRight className="size-4" aria-hidden />}
      {label}
    </Button>
  );

  if (p.completed) return <p className="text-sm text-success">{t("complete", { date: p.amcEndDate ? formatDate(p.amcEndDate, locale) : "—" })}</p>;

  switch (p.stage) {
    case "SUBSIDY_APPLICATION":
      return (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field id="subsidyNo" label={t("subsidyNo")}>
            <Input id="subsidyNo" value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <Go label={t("fileSubsidy")} disabled={text.trim().length < 3} onClick={() => run(() => recordSubsidyApplicationAction({ projectId: p.projectId, applicationNo: text }))} />
        </div>
      );
    case "INSTALLATION":
      if (p.materialDispatchedAt) {
        return (
          <p className="text-sm text-muted-foreground">
            {p.installedAt ? t("installed", { date: formatDate(p.installedAt, locale) }) : t("dispatched", { date: formatDate(p.materialDispatchedAt, locale) })}
          </p>
        );
      }
      return (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field id="installer" label={t("installer")}>
            <NativeSelect id="installer" value={worker} onChange={(e) => setWorker(e.target.value)}>
              {p.workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Go label={t("dispatch")} disabled={!worker} onClick={() => run(() => dispatchMaterialAction({ projectId: p.projectId, installerId: worker }))} />
        </div>
      );
    case "NET_METERING":
      if (p.netMeteringFiledAt) return <p className="text-sm text-muted-foreground">{t("filedWaiting", { date: formatDate(p.netMeteringFiledAt, locale) })}</p>;
      return (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field id="nmRef" label={t("netMeterRef")}>
            <Input id="nmRef" value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <Go label={t("fileNetMetering")} disabled={text.trim().length < 2} onClick={() => run(() => fileNetMeteringAction({ projectId: p.projectId, refNo: text }))} />
        </div>
      );
    case "COMMISSIONED":
      return <Go label={t("netMeterInstalled")} onClick={() => run(() => markNetMeterInstalledAction({ projectId: p.projectId }))} />;
    case "SUBSIDY_CREDITED":
      return <Go label={t("subsidyCredited")} onClick={() => run(() => markSubsidyCreditedAction({ projectId: p.projectId }))} />;
    default:
      return null;
  }
}
