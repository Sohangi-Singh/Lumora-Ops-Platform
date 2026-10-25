"use client";

import {
  ClipboardList,
  FileSignature,
  FileText,
  FolderKanban,
  History,
  Home,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { signOutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./logo";

export type ShellRole = "ADMIN" | "WORKER" | "CUSTOMER";

type NavKey = "home" | "documents" | "quote" | "payments" | "timeline" | "support" | "jobs" | "overview" | "projects" | "tickets" | "users" | "settings";

type NavItem = { key: NavKey; href: string; icon: LucideIcon; mobile?: boolean; exact?: boolean };

const NAV: Record<ShellRole, NavItem[]> = {
  CUSTOMER: [
    { key: "home", href: "/portal", icon: Home, mobile: true, exact: true },
    { key: "documents", href: "/portal/documents", icon: FileText, mobile: true },
    { key: "quote", href: "/portal/quote", icon: FileSignature, mobile: true },
    { key: "payments", href: "/portal/payments", icon: Wallet, mobile: true },
    { key: "timeline", href: "/portal/timeline", icon: History },
    { key: "support", href: "/portal/support", icon: LifeBuoy, mobile: true },
  ],
  WORKER: [{ key: "jobs", href: "/worker", icon: ClipboardList, mobile: true, exact: true }],
  ADMIN: [
    { key: "overview", href: "/admin", icon: LayoutDashboard, mobile: true, exact: true },
    { key: "projects", href: "/admin/projects", icon: FolderKanban, mobile: true },
    { key: "tickets", href: "/admin/tickets", icon: LifeBuoy, mobile: true },
    { key: "users", href: "/admin/users", icon: Users },
    { key: "settings", href: "/admin/settings", icon: Settings, mobile: true },
  ],
};

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AppShell({
  role,
  userName,
  userEmail,
  headerSlot,
  children,
}: {
  role: ShellRole;
  userName: string;
  userEmail: string;
  headerSlot?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const items = NAV[role];
  const mobileItems = items.filter((i) => i.mobile);
  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-dvh lg:pl-64">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href={items[0].href} aria-label="Lumora Solar home">
            <Logo tone="onDark" />
          </Link>
        </div>
        <div className="mx-5 h-px bg-gradient-to-r from-gold/60 via-gold/20 to-transparent" />
        <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Main">
          {items.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none",
                  active ? "bg-sidebar-accent text-white" : "text-sidebar-foreground/75 hover:bg-white/5 hover:text-white",
                )}
              >
                {active ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-gold" /> : null}
                <Icon className={cn("size-[18px]", active && "text-gold")} aria-hidden />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-gold/15 text-xs font-semibold text-gold">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">{userName}</div>
              <div className="truncate text-xs text-sidebar-foreground/60">{userEmail}</div>
            </div>
          </div>
          <form action={signOutAction} className="mt-3">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-sidebar-foreground/70 hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
            >
              <LogOut className="size-4" aria-hidden />
              {tc("signOut")}
            </button>
          </form>
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border/70 bg-cream/90 backdrop-blur supports-[backdrop-filter]:bg-cream/75">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:h-16 sm:px-6">
          <Link href={items[0].href} className="lg:hidden" aria-label="Lumora Solar home">
            <Logo />
          </Link>
          <div className="flex-1" />
          <LanguageSwitcher />
          {headerSlot}
          <form action={signOutAction} className="lg:hidden">
            <button
              type="submit"
              aria-label={tc("signOut")}
              className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-navy"
            >
              <LogOut className="size-[18px]" />
            </button>
          </form>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-7xl px-4 pt-5 pb-28 sm:px-6 lg:pt-8 lg:pb-12">
        {children}
      </main>

      {/* Mobile bottom nav */}
      {mobileItems.length > 1 ? (
        <nav
          aria-label="Main"
          className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 backdrop-blur lg:hidden"
        >
          <ul className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${mobileItems.length}, 1fr)` }}>
            {mobileItems.map((item) => {
              const active = isActive(pathname, item);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                      active ? "text-navy" : "text-muted-foreground",
                    )}
                  >
                    {active ? <span className="absolute top-0 h-0.5 w-8 rounded-full bg-gold" /> : null}
                    <Icon className="size-5" aria-hidden />
                    {t(item.key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
