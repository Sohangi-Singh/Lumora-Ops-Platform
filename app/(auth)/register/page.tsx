import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RegisterForm } from "@/components/auth/register-form";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("createAccount") };
}

export default async function RegisterPage() {
  const t = await getTranslations("auth");
  const settings = await getSettings();
  return (
    <div>
      <h1 className="text-center text-2xl font-semibold sm:text-[1.75rem]">{t("registerTitle")}</h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">{t("registerSubtitle")}</p>
      <p className="mt-3 rounded-xl bg-gold-soft px-3 py-2 text-xs text-navy">{t("staffNote")}</p>
      <RegisterForm cities={settings.cityCodes.map((c) => c.code)} />
    </div>
  );
}
