import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoProps = {
  variant?: "full" | "mark" | "lockup";
  tone?: "onLight" | "onDark";
  className?: string;
  priority?: boolean;
};

/**
 * - full: the complete logo artwork (navy text) — use on cream/white.
 * - mark: just the sun + panels symbol.
 * - lockup: symbol + wordmark rendered as text so it works on navy too.
 */
export function Logo({ variant = "lockup", tone = "onLight", className, priority }: LogoProps) {
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
        width={512}
        height={448}
        priority={priority}
        className={cn("h-8 w-auto", className)}
      />
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image src="/brand/mark.png" alt="" width={512} height={448} priority={priority} className="h-8 w-auto" />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "text-[15px] font-semibold tracking-[0.08em]",
            tone === "onDark" ? "text-white" : "text-navy",
          )}
        >
          LUMORA SOLAR
        </span>
        <span
          className={cn(
            "mt-1 text-[10px] font-medium tracking-[0.18em]",
            tone === "onDark" ? "text-gold" : "text-gold-ink",
          )}
        >
          SOLAR OPS
        </span>
      </span>
    </span>
  );
}
