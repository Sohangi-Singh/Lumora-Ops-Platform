"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { NativeSelect } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/hooks/use-error-text";
import { updateTicketAction } from "@/lib/actions/tickets";

export function TicketUpdate({ ticketId, status, note }: { ticketId: string; status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"; note: string | null }) {
  const t = useTranslations("admin.tickets");
  const ts = useTranslations("support.status");
  const router = useRouter();
  const errorText = useErrorText();
  const [s, setS] = useState(status);
  const [n, setN] = useState(note ?? "");
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-2 sm:grid-cols-[160px_1fr_auto]">
      <NativeSelect value={s} onChange={(e) => setS(e.target.value as typeof s)} aria-label="Status">
        {(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const).map((x) => (
          <option key={x} value={x}>
            {ts(x)}
          </option>
        ))}
      </NativeSelect>
      <Input value={n} onChange={(e) => setN(e.target.value)} placeholder={t("note")} aria-label={t("note")} />
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await updateTicketAction({ ticketId, status: s, adminNote: n.trim() || null });
            if (!res.ok) return void toast.error(errorText(res.error));
            toast.success(t("updated"));
            router.refresh();
          })
        }
      >
        {t("update")}
      </Button>
    </div>
  );
}
