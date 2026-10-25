"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Field, FormError, NativeSelect, SubmitButton } from "@/components/shared/form";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/hooks/use-error-text";
import { registerAction } from "@/lib/actions/auth";

export function RegisterForm({ cities }: { cities: string[] }) {
  const t = useTranslations("auth");
  const errorText = useErrorText();
  const [state, action] = useActionState(registerAction, null);
  const error = state && !state.ok ? state.error : null;
  const fe = error?.fieldErrors ?? {};

  return (
    <form action={action} className="mt-8 space-y-4">
      <FormError message={error ? errorText(error) : undefined} />
      <div className="grid grid-cols-[96px_1fr] gap-3">
        <Field id="salutation" label={t("salutation")}>
          <NativeSelect id="salutation" name="salutation" defaultValue="Mr.">
            <option value="Mr.">{t("mr")}</option>
            <option value="Ms.">{t("ms")}</option>
          </NativeSelect>
        </Field>
        <Field id="name" label={t("name")} error={fe.name} required>
          <Input id="name" name="name" autoComplete="name" required aria-invalid={Boolean(fe.name)} />
        </Field>
      </div>
      <Field id="phone" label={t("mobile")} hint={t("mobileHint")} error={fe.phone} required>
        <Input id="phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={14} required aria-invalid={Boolean(fe.phone)} />
      </Field>
      <Field id="email" label={t("email")} error={fe.email} required>
        <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" required aria-invalid={Boolean(fe.email)} />
      </Field>
      <Field id="password" label={t("password")} hint={t("passwordHint")} error={fe.password} required>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required aria-invalid={Boolean(fe.password)} />
      </Field>
      <Field id="addressLine1" label={t("addressLine1")} error={fe.addressLine1} required>
        <Input id="addressLine1" name="addressLine1" autoComplete="address-line1" required aria-invalid={Boolean(fe.addressLine1)} />
      </Field>
      <Field id="addressLine2" label={t("addressLine2")}>
        <Input id="addressLine2" name="addressLine2" autoComplete="address-line2" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="cityCode" label={t("city")}>
          <NativeSelect id="cityCode" name="cityCode" defaultValue={cities[0]}>
            {cities.map((c) => (
              <option key={c} value={c}>
                {t.has(`cities.${c}` as "cities.RPR") ? t(`cities.${c}` as "cities.RPR") : c}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="pincode" label={t("pincode")} error={fe.pincode} required>
          <Input id="pincode" name="pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} required aria-invalid={Boolean(fe.pincode)} />
        </Field>
      </div>
      <label className="flex gap-3 rounded-xl border border-border bg-white p-3.5 text-xs leading-relaxed text-muted-foreground">
        <input type="checkbox" name="consent" required className="mt-0.5 size-5 shrink-0 accent-[var(--navy)]" />
        <span>{t("consent")}</span>
      </label>
      {fe.consent ? <p className="text-xs text-danger">{t("consentRequired")}</p> : null}
      <SubmitButton pendingLabel={t("creating")}>{t("createAccount")}</SubmitButton>
      <p className="pt-2 text-center text-sm text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-medium text-navy underline decoration-gold underline-offset-4">
          {t("loginLink")}
        </Link>
      </p>
    </form>
  );
}
