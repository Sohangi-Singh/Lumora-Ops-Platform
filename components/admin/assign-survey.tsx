"use client";

import { CalendarClock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, NativeSelect } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/hooks/use-error-text";
import { assignSurveyAction } from "@/lib/actions/survey";

/** Converts the browser's local datetime-local value (IST for our users) to ISO. */
function localToIso(v: string) {
  return new Date(v).toISOString();
}

export function AssignSurvey({
  projectId,
  workers,
  current,
}: {
  projectId: string;
  workers: { id: string; name: string; openJobs: number }[];
  current: { workerId: string; scheduledAtLocal: string } | null;
}) {
  const t = useTranslations("admin.assign");
  const errorText = useErrorText();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [workerId, setWorkerId] = useState(current?.workerId ?? workers[0]?.id ?? "");
  const [when, setWhen] = useState(current?.scheduledAtLocal ?? "");

  if (!workers.length) return <p className="text-sm text-muted-foreground">{t("noWorkers")}</p>;

  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await assignSurveyAction({ projectId, workerId, scheduledAt: localToIso(when) });
          if (!res.ok) return void toast.error(errorText(res.error));
          toast.success(t("done"));
          router.refresh();
        });
      }}
    >
      <Field id="worker" label={t("worker")}>
        <NativeSelect id="worker" value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} ({w.openJobs})
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field id="when" label={t("date")}>
        <Input id="when" type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} />
      </Field>
      <Button type="submit" size="lg" disabled={pending || !when || !workerId}>
        <CalendarClock className="size-4" aria-hidden />
        {current ? t("reschedule") : t("submit")}
      </Button>
    </form>
  );
}
