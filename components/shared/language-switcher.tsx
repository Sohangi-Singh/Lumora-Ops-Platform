"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocaleAction } from "@/lib/actions/locale";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ tone = "onLight" }: { tone?: "onLight" | "onDark" }) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (next: "en" | "hi") => {
    if (next === locale) return;
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  };

  return (
    <div
      role="group"
      aria-label="Language / भाषा"
      className={cn(
        "inline-flex rounded-full p-0.5 text-xs font-medium",
        tone === "onDark" ? "bg-white/10" : "bg-muted",
        pending && "opacity-60",
      )}
    >
      {(
        [
          ["en", "EN"],
          ["hi", "हिंदी"],
        ] as const
      ).map(([code, label]) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={locale === code}
          onClick={() => choose(code)}
          className={cn(
            "min-h-8 rounded-full px-3 transition-colors focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none",
            locale === code
              ? tone === "onDark"
                ? "bg-gold text-navy"
                : "bg-navy text-white"
              : tone === "onDark"
                ? "text-white/80 hover:text-white"
                : "text-muted-foreground hover:text-navy",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
