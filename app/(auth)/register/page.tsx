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
      <h1 className="text-2xl font-semibold sm:text-3xl">{t("registerTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("registerSubtitle")}</p>
      <RegisterForm cities={settings.cityCodes.map((c) => c.code)} />
    </div>
  );
}
