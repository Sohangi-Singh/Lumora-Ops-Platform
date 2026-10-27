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
      <aside className="hero-navy relative hidden overflow-hidden lg:m-3 lg:flex lg:flex-col lg:justify-between lg:rounded-[2.5rem] lg:p-12">
        {/* Slowly turning sun halo behind the floating mark. */}
        <div aria-hidden className="animate-spin-slow pointer-events-none absolute top-[18%] left-1/2 size-[34rem] -translate-x-1/2 rounded-full bg-[repeating-conic-gradient(from_0deg,rgb(247_183_51/0.07)_0deg_6deg,transparent_6deg_18deg)]" />
        <div aria-hidden className="pointer-events-none absolute top-[24%] left-1/2 size-80 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(247_167_51/0.35),transparent_65%)]" />
        <svg aria-hidden viewBox="0 0 600 200" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-48 w-full">
          <path d="M0 90 C 120 30, 240 150, 380 80 S 560 40, 600 70 L600 200 L0 200 Z" fill="rgb(255 255 255 / 0.04)" />
          <path d="M0 130 C 140 80, 260 190, 420 120 S 560 100, 600 115 L600 200 L0 200 Z" fill="rgb(255 255 255 / 0.05)" />
          <path d="M0 165 C 160 130, 300 210, 460 160 S 570 150, 600 158 L600 200 L0 200 Z" fill="rgb(198 167 94 / 0.10)" />
        </svg>

        <Logo tone="onDark" />
        <div className="relative flex justify-center">
          <Image
            src="/brand/mark.png"
            alt=""
            width={640}
            height={479}
            priority
            className="animate-float w-64 drop-shadow-[0_24px_40px_rgb(247_167_51/0.35)] xl:w-72"
          />
        </div>
        <div className="relative max-w-md">
          <p className="text-sun text-4xl leading-tight font-bold">{t("tagline")}</p>
          <p className="mt-4 text-sm leading-relaxed text-white/75">
            PM Surya Ghar · Rooftop solar for homes in Raipur &amp; Delhi NCR
          </p>
          <p className="mt-8 text-xs text-white/50">{t("legalName")}</p>
        </div>
      </aside>
      <main className="relative flex flex-col overflow-hidden px-4 py-6 sm:px-8">
        <div aria-hidden className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-[radial-gradient(circle,rgb(247_183_51/0.18),transparent_65%)]" />
        <div className="relative flex items-center justify-between">
          <span className="lg:hidden">
            <Logo variant="full" className="w-28" priority />
          </span>
          <span className="hidden lg:block" />
          <LanguageSwitcher />
        </div>
        <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
          <div className="rounded-[2rem] border border-white/80 bg-white/70 p-6 shadow-lift backdrop-blur-xl sm:p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
