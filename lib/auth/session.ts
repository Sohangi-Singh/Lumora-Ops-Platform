import "server-only";
import type { Role } from "@prisma/client";
import { cache } from "react";
import { db } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  role: Role;
  name: string;
  email: string;
  phone: string | null;
  language: string;
};

/**
 * The signed-in, active user for this request, or null. Supabase verifies the
 * JWT (getUser hits the Auth server); our DB is the source of truth for role
 * and active status, so a deactivated user is signed out everywhere at once.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return devSessionUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const user = await db.user.findUnique({
    where: { id: data.user.id },
    select: { id: true, role: true, name: true, email: true, phone: true, language: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  const { isActive: _active, ...rest } = user;
  return rest;
});

export function homePathFor(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "WORKER":
      return "/worker";
    default:
      return "/portal";
  }
}

/**
 * Local development without a Supabase project: impersonate a seeded user via
 * the /dev/login page. Inert unless NODE_ENV=development AND Supabase is not
 * configured — it can never be active on a deployed build.
 */
export const DEV_AUTH_ENABLED = process.env.NODE_ENV === "development" && !process.env.NEXT_PUBLIC_SUPABASE_URL;
export const DEV_USER_COOKIE = "lumora_dev_user";

async function devSessionUser(): Promise<SessionUser | null> {
  if (!DEV_AUTH_ENABLED) return null;
  const { cookies } = await import("next/headers");
  const id = (await cookies()).get(DEV_USER_COOKIE)?.value;
  if (!id) return null;
  const user = await db.user.findUnique({ where: { id }, select: { id: true, role: true, name: true, email: true, phone: true, language: true, isActive: true } });
  if (!user?.isActive) return null;
  const { isActive: _a, ...rest } = user;
  return rest;
}
