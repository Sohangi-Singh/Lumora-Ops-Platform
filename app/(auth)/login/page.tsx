import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signIn") };
}

export default async function LoginPage() {
  const t = await getTranslations("auth");
  return (
    <div>
      <h1 className="text-2xl font-semibold sm:text-3xl">{t("loginTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("loginSubtitle")}</p>
      <LoginForm />
    </div>
  );
}
