import Image from "next/image";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { getSessionUser, homePathFor } from "@/lib/auth/session";

const STEPS = ["bill", "survey", "pay", "install"] as const;

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (user) redirect(homePathFor(user.role));
  const t = await getTranslations("auth");
  const tb = await getTranslations("brand");

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Desktop: a calm navy panel that explains the customer journey. Stays in view while long forms scroll. */}
      <aside className="relative hidden overflow-hidden bg-navy text-white lg:sticky lg:top-3 lg:m-3 lg:flex lg:h-[calc(100dvh-1.5rem)] lg:flex-col lg:self-start lg:rounded-[2rem] lg:p-12 xl:p-16">
        <svg aria-hidden viewBox="0 0 400 400" fill="none" className="pointer-events-none absolute -right-60 -bottom-60 size-[36rem] text-gold">
          {[70, 120, 170, 220].map((r, i) => (
            <circle key={r} cx="200" cy="200" r={r} stroke="currentColor" strokeOpacity={0.16 - i * 0.035} />
          ))}
        </svg>

        <div aria-hidden className="pointer-events-none absolute -right-24 -bottom-24 size-72 rounded-full bg-[radial-gradient(circle,rgb(247_167_51/0.22),transparent_65%)]" />

        <p className="relative text-xs font-semibold tracking-[0.2em] text-gold uppercase">{t("sideEyebrow")}</p>

        <div className="relative my-auto max-w-lg py-8">
          <h2 className="text-4xl text-white leading-[1.15] font-semibold tracking-tight xl:text-[2.75rem]">{t("sideTitle")}</h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/65 [@media(max-height:760px)]:hidden">{t("sideBody")}</p>

          <ol className="mt-10 [@media(max-height:760px)]:mt-7">
            {STEPS.map((step, i) => (
              <li key={step} className="relative flex gap-4 pb-6 last:pb-0 [@media(max-height:760px)]:pb-4">
                {i < STEPS.length - 1 ? <span aria-hidden className="absolute top-9 bottom-0 left-[17px] w-px bg-white/15" /> : null}
                <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/50 text-sm font-semibold text-gold">
                  {i + 1}
                </span>
                <div className="pt-1.5">
                  <p className="font-medium">{t(`steps.${step}Title`)}</p>
                  <p className="mt-0.5 text-sm text-white/55 [@media(max-height:760px)]:hidden">{t(`steps.${step}Body`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="relative flex items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-white/50">
          <span>{tb("legalName")}</span>
          <span>{t("sideFooter")}</span>
        </div>
      </aside>

      <main className="flex flex-col px-5 py-5 sm:px-10">
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>
        <div className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center py-8">
          <Image
            src="/brand/logo.png"
            alt={tb("legalName")}
            width={639}
            height={536}
            priority
            className="mx-auto h-auto w-32 sm:w-36"
          />
          <div className="mt-8 rounded-[1.75rem] bg-white p-6 shadow-soft ring-1 ring-border/60 sm:p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
