import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoProps = {
  variant?: "full" | "mark" | "lockup";
  /** lockup only: hide the wordmark on narrow screens */
  compact?: boolean;
  tone?: "onLight" | "onDark";
  className?: string;
  priority?: boolean;
};

/**
 * - full: the complete logo artwork (navy text) — use on cream/white.
 * - mark: just the sun + panels symbol.
 * - lockup: symbol + wordmark rendered as text so it works on navy too.
 */
export function Logo({ variant = "lockup", tone = "onLight", compact, className, priority }: LogoProps) {
  if (variant === "full") {
    return (
      <Image
        src="/brand/logo.png"
        alt="Lumora Solar Private Limited"
        width={640}
        height={538}
        priority={priority}
        className={cn("h-auto w-40", className)}
      />
    );
  }
  if (variant === "mark") {
    return (
      <Image
        src="/brand/mark.png"
        alt="Lumora Solar"
        width={640}
        height={479}
        priority={priority}
        className={cn("h-8 w-auto", className)}
      />
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image src="/brand/mark.png" alt="" width={640} height={479} priority={priority} className="h-8 w-auto" />
      <span className={cn("flex flex-col leading-none", compact && "max-[419px]:sr-only")}>
        <span
          className={cn(
            "text-[13px] font-semibold tracking-[0.08em] whitespace-nowrap sm:text-[15px]",
            tone === "onDark" ? "text-white" : "text-navy",
          )}
        >
          LUMORA SOLAR
        </span>
        <span
          className={cn(
            "mt-1 hidden text-[10px] font-medium tracking-[0.18em] sm:block",
            tone === "onDark" ? "text-gold" : "text-gold-ink",
          )}
        >
          SOLAR OPS
        </span>
      </span>
    </span>
  );
}
