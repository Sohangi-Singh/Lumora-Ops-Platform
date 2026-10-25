"use client";

import { Loader2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, NativeSelect } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/hooks/use-error-text";
import { createStaffUserAction, setUserActiveAction } from "@/lib/actions/admin";

export function CreateUserForm() {
  const t = useTranslations("admin.users");
  const router = useRouter();
  const errorText = useErrorText();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ role: "WORKER" as "WORKER" | "ADMIN", name: "", email: "", phone: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Card className="gap-4 p-5">
      <h2 className="font-semibold text-navy">{t("add")}</h2>
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await createStaffUserAction(form);
            if (!res.ok) {
              setErrors(res.error.fieldErrors ?? {});
              return void toast.error(errorText(res.error));
            }
            setErrors({});
            toast.success(t("created"));
            setForm({ role: "WORKER", name: "", email: "", phone: "", password: "" });
            router.refresh();
          });
        }}
      >
        <Field id="u-role" label={t("roleLabel")}>
          <NativeSelect id="u-role" value={form.role} onChange={(e) => set("role", e.target.value)}>
            <option value="WORKER">{t("role.WORKER")}</option>
            <option value="ADMIN">{t("role.ADMIN")}</option>
          </NativeSelect>
        </Field>
        <Field id="u-name" label={t("name")} error={errors.name}>
          <Input id="u-name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </Field>
        <Field id="u-email" label={t("email")} error={errors.email}>
          <Input id="u-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
        </Field>
        <Field id="u-phone" label={t("phone")} error={errors.phone}>
          <Input id="u-phone" type="tel" inputMode="numeric" value={form.phone} onChange={(e) => set("phone", e.target.value)} required />
        </Field>
        <Field id="u-pass" label={t("password")} error={errors.password}>
          <Input id="u-pass" type="text" autoComplete="off" value={form.password} onChange={(e) => set("password", e.target.value)} minLength={8} required />
        </Field>
        <div className="flex items-end">
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
            {t("create")}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function ToggleActive({ userId, active }: { userId: string; active: boolean }) {
  const t = useTranslations("admin.users");
  const router = useRouter();
  const errorText = useErrorText();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant={active ? "outline" : "default"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await setUserActiveAction({ userId, active: !active });
          if (!res.ok) return void toast.error(errorText(res.error));
          toast.success(t("updated"));
          router.refresh();
        })
      }
    >
      {active ? t("deactivate") : t("activate")}
    </Button>
  );
}
