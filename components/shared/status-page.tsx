import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function StatusPage({ code, title, body, action }: { code: string; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-4 text-center">
      <Image src="/brand/mark.png" alt="" width={120} height={105} className="mb-6 h-16 w-auto opacity-30 grayscale" />
      <div className="text-sm font-semibold tracking-[0.2em] text-gold-ink">{code}</div>
      <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
      <div className="mt-6">{action}</div>
    </div>
  );
}

export function HomeLink({ label }: { label: string }) {
  return (
    <Link href="/" className="inline-flex h-10 items-center rounded-xl bg-navy px-4 text-sm font-medium text-white hover:bg-navy-soft">
      {label}
    </Link>
  );
}
