import Image from "next/image";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { Logo } from "@/components/shared/logo";
import { getSessionUser, homePathFor } from "@/lib/auth/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (user) redirect(homePathFor(user.role));
  const t = await getTranslations("brand");

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-navy text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -right-24 -bottom-24 opacity-[0.07]">
          <Image src="/brand/mark.png" alt="" width={520} height={455} />
        </div>
        <Logo tone="onDark" />
        <div className="relative max-w-md">
          <div className="mb-6 h-px w-16 bg-gold" />
          <p className="text-3xl leading-tight font-semibold">{t("tagline")}</p>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            PM Surya Ghar · Rooftop solar for homes in Raipur &amp; Delhi NCR
          </p>
        </div>
        <p className="relative text-xs text-white/50">{t("legalName")}</p>
      </aside>
      <main className="flex flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          <span className="lg:hidden">
            <Logo variant="full" className="w-28" priority />
          </span>
          <span className="hidden lg:block" />
          <LanguageSwitcher />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">{children}</div>
      </main>
    </div>
  );
}
