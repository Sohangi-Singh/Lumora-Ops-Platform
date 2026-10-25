import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { DEV_AUTH_ENABLED } from "@/lib/auth/session";

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
      {DEV_AUTH_ENABLED ? (
        <Link href="/dev/login" className="mt-6 block rounded-xl border border-dashed border-gold px-4 py-3 text-center text-sm text-gold-ink">
          Local dev: sign in as a seeded user →
        </Link>
      ) : null}
    </div>
  );
}
