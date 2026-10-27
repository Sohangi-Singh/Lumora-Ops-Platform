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
import { LayoutGroup, MotionConfig, motion } from "framer-motion";
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
    <MotionConfig reducedMotion="user">
      <div className="min-h-dvh lg:pl-[18rem]">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2"
        >
          Skip to content
        </a>

        {/* Desktop sidebar: a floating, rounded navy panel with a sunrise glow at the foot. */}
        <aside className="fixed inset-y-3 left-3 z-30 hidden w-64 flex-col overflow-hidden rounded-[2rem] bg-sidebar text-sidebar-foreground shadow-[0_20px_50px_-20px_rgb(27_38_59/0.6)] lg:flex">
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 size-72 rounded-full bg-[radial-gradient(circle,rgb(247_167_51/0.32),transparent_65%)]" />
          <svg aria-hidden viewBox="0 0 256 80" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full text-white/[0.04]">
            <path d="M0 40 C 60 10, 120 70, 256 30 L256 80 L0 80 Z" fill="currentColor" />
            <path d="M0 58 C 80 30, 150 85, 256 52 L256 80 L0 80 Z" fill="currentColor" />
          </svg>
          <div className="relative flex h-20 items-center px-5">
            <Link href={items[0].href} aria-label="Lumora Solar home" className="transition-transform hover:scale-[1.03]">
              <Logo tone="onDark" />
            </Link>
          </div>
          <div className="relative mx-5 h-px bg-gradient-to-r from-gold/70 via-gold/25 to-transparent" />
          <LayoutGroup id="sidebar">
            <nav className="relative flex-1 space-y-1 px-3 py-5" aria-label="Main">
              {items.map((item) => {
                const active = isActive(pathname, item);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none",
                      active ? "text-navy" : "text-sidebar-foreground/75 hover:bg-white/[0.06] hover:text-white",
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="sidebar-pill"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        className="bg-sun absolute inset-0 rounded-full shadow-[var(--shadow-glow)]"
                      />
                    ) : null}
                    <Icon
                      className={cn("relative size-[18px] transition-transform duration-200 group-hover:scale-110", active && "text-navy")}
                      aria-hidden
                    />
                    <span className="relative">{t(item.key)}</span>
                  </Link>
                );
              })}
            </nav>
          </LayoutGroup>
          <div className="relative m-3 rounded-[1.4rem] bg-white/[0.06] p-3 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="bg-sun flex size-10 items-center justify-center rounded-full text-xs font-bold text-navy shadow-[var(--shadow-glow)]">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-white">{userName}</div>
                <div className="truncate text-xs text-sidebar-foreground/60">{userEmail}</div>
              </div>
            </div>
            <form action={signOutAction} className="mt-2">
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-full px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
              >
                <LogOut className="size-4" aria-hidden />
                {tc("signOut")}
              </button>
            </form>
          </div>
        </aside>

        {/* Top bar */}
        <header className="sticky top-0 z-20 px-3 pt-3 sm:px-4">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 rounded-full border border-white/70 bg-white/70 px-4 shadow-soft backdrop-blur-xl supports-[backdrop-filter]:bg-white/55 sm:h-16 sm:px-5">
            <Link href={items[0].href} className="lg:hidden" aria-label="Lumora Solar home">
              <Logo compact />
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

        <motion.main
          key={pathname}
          id="main"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          className="mx-auto max-w-7xl px-4 pt-5 pb-32 sm:px-6 lg:pt-8 lg:pb-12"
        >
          {children}
        </motion.main>

        {/* Mobile bottom nav: a floating pill with a sliding sun bubble. */}
        {mobileItems.length > 1 ? (
          <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-30 px-3 pb-3 lg:hidden">
            <LayoutGroup id="bottom-nav">
              <ul
                className="mx-auto grid max-w-md rounded-full border border-white/70 bg-white/85 p-1.5 shadow-[0_12px_32px_-10px_rgb(27_38_59/0.35)] backdrop-blur-xl"
                style={{ gridTemplateColumns: `repeat(${mobileItems.length}, 1fr)` }}
              >
                {mobileItems.map((item) => {
                  const active = isActive(pathname, item);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium transition-colors",
                          active ? "text-white" : "text-muted-foreground",
                        )}
                      >
                        {active ? (
                          <motion.span
                            layoutId="bottom-pill"
                            transition={{ type: "spring", stiffness: 420, damping: 34 }}
                            className="absolute inset-0 rounded-full bg-gradient-to-br from-navy to-navy-soft shadow-[0_6px_16px_-6px_rgb(27_38_59/0.6)]"
                          />
                        ) : null}
                        <Icon className={cn("relative size-5", active && "text-gold")} aria-hidden />
                        <span className="relative">{t(item.key)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </LayoutGroup>
          </nav>
        ) : null}
      </div>
    </MotionConfig>
  );
}
