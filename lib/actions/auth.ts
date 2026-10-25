"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { homePathFor } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { fail, toActionError, type ActionResult } from "@/lib/result";
import { getSettings } from "@/lib/settings";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LoginSchema, RegisterSchema } from "@/lib/validation/auth";
import { advanceIfReady, recordEvent, withWorkflow } from "@/lib/workflow/service";

export type AuthFormState = ActionResult<null> | null;

async function persistLocale(language: string) {
  if (!isLocale(language)) return;
  (await cookies()).set(LOCALE_COOKIE, language, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  let destination = "/";
  try {
    const input = LoginSchema.parse(Object.fromEntries(formData));
    await rateLimit(`login:${await clientIp()}`, 10, 60);
    await rateLimit(`login:${input.email}`, 10, 300);

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword(input);
    if (error || !data.user) return fail("UNAUTHENTICATED", "invalidCredentials");

    const user = await db.user.findUnique({ where: { id: data.user.id }, select: { role: true, isActive: true, language: true } });
    if (!user || !user.isActive) {
      await supabase.auth.signOut();
      return fail("FORBIDDEN", "accountDisabled");
    }
    await persistLocale(user.language);
    destination = homePathFor(user.role);
  } catch (err) {
    return { ok: false, error: toActionError(err) };
  }
  redirect(destination);
}

export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  try {
    const input = RegisterSchema.parse(Object.fromEntries(formData));
    await rateLimit(`register:${await clientIp()}`, 5, 600);

    const settings = await getSettings();
    const city = settings.cityCodes.find((c) => c.code === input.cityCode);
    if (!city) throw new AppError("VALIDATION", "Unknown city");

    const existing = await db.user.findFirst({
      where: { OR: [{ email: input.email }, { phone: input.phone }] },
      select: { email: true },
    });
    if (existing) return fail("CONFLICT", existing.email === input.email ? "emailTaken" : "phoneTaken");

    // 1. Auth identity (auto-confirmed: the DPDP consent + mobile are captured here).
    const admin = supabaseAdmin();
    const created = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { name: input.name },
    });
    if (created.error || !created.data.user) {
      if (created.error?.message?.toLowerCase().includes("already")) return fail("CONFLICT", "emailTaken");
      throw new AppError("GENERIC", created.error?.message);
    }
    const authUserId = created.data.user.id;
    const language = await getLocale();

    // 2. Profile + project in one transaction; roll back the auth user if it fails.
    try {
      await withWorkflow(async (tx, fx) => {
        await tx.user.create({
          data: { id: authUserId, role: "CUSTOMER", name: input.name, email: input.email, phone: input.phone, language },
        });
        const customer = await tx.customer.create({
          data: {
            userId: authUserId,
            salutation: input.salutation,
            addressLine1: input.addressLine1,
            addressLine2: input.addressLine2 || null,
            city: city.name,
            state: city.state,
            pincode: input.pincode,
            consentAt: new Date(),
          },
        });
        const project = await tx.project.create({
          data: { customerId: customer.id, cityCode: city.code, stageTimestamps: { REGISTERED: new Date().toISOString() } },
        });
        await recordEvent(tx, fx, project.id, authUserId, { type: "PROJECT_CREATED" });
        await advanceIfReady(tx, fx, project.id, authUserId); // REGISTERED → DOCUMENTS
      });
    } catch (err) {
      await admin.auth.admin.deleteUser(authUserId).catch(() => undefined);
      throw err;
    }

    // 3. Sign in (sets the session cookies).
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
    if (error) throw new AppError("GENERIC", error.message);
    await persistLocale(language);
  } catch (err) {
    return { ok: false, error: toActionError(err) };
  }
  redirect("/portal/documents?welcome=1");
}

export async function signOutAction(): Promise<void> {
  (await cookies()).delete("lumora_dev_user");
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
