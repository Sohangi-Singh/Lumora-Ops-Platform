"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/shared/form";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/hooks/use-error-text";
import { loginAction } from "@/lib/actions/auth";

export function LoginForm() {
  const t = useTranslations("auth");
  const errorText = useErrorText();
  const [state, action] = useActionState(loginAction, null);
  const error = state && !state.ok ? state.error : null;

  return (
    <form action={action} className="mt-8 space-y-4" noValidate>
      <FormError message={error ? errorText(error) : undefined} />
      <Field id="email" label={t("email")} error={error?.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Field id="password" label={t("password")} error={error?.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton pendingLabel={t("signingIn")}>{t("signIn")}</SubmitButton>
      <p className="pt-2 text-center text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link href="/register" className="font-medium text-navy underline decoration-gold underline-offset-4">
          {t("registerLink")}
        </Link>
      </p>
    </form>
  );
}
