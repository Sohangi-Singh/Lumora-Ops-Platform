"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { runAction } from "@/lib/result";
import { parseSettings, SettingsSchema } from "@/lib/settings/schema";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { mobileSchema } from "@/lib/validation/auth";

function diff(before: unknown, after: unknown, path = ""): Record<string, { from: unknown; to: unknown }> {
  if (JSON.stringify(before) === JSON.stringify(after)) return {};
  if (before && after && typeof before === "object" && typeof after === "object" && !Array.isArray(before) && !Array.isArray(after)) {
    const out: Record<string, { from: unknown; to: unknown }> = {};
    for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
      Object.assign(out, diff((before as Record<string, unknown>)[k], (after as Record<string, unknown>)[k], path ? `${path}.${k}` : k));
    }
    return out;
  }
  return { [path || "value"]: { from: before, to: after } };
}

async function audit(actorId: string, entity: string, entityId: string | null, action: string, changes: unknown) {
  await db.auditLog.create({ data: { actorId, entity, entityId, action, diff: JSON.parse(JSON.stringify(changes ?? {})) as Prisma.InputJsonValue } });
}

/* ------------------------------ Settings ------------------------------ */

export async function saveSettingsAction(input: unknown) {
  return runAction(async () => {
    const admin = await requireRole("ADMIN");
    const next = SettingsSchema.parse(input);
    if (next.gst.goodsSharePct + next.gst.servicesSharePct !== 100) throw new AppError("VALIDATION", "GST goods + services share must total 100%");
    if (next.payment.advancePct + next.payment.balancePct !== 100) throw new AppError("VALIDATION", "Advance + balance must total 100%");
    const row = await db.settings.findUnique({ where: { id: 1 } });
    const before = parseSettings(row?.data);
    const changes = diff(before, next);
    await db.settings.upsert({
      where: { id: 1 },
      create: { id: 1, data: next as unknown as Prisma.InputJsonValue, updatedById: admin.id },
      update: { data: next as unknown as Prisma.InputJsonValue, updatedById: admin.id },
    });
    await audit(admin.id, "Settings", "1", "UPDATE", changes);
    revalidatePath("/", "layout");
    return { changed: Object.keys(changes).length };
  });
}

const CatalogSchema = z.array(
  z.object({
    id: z.string().nullable(),
    sortOrder: z.number().int().min(0),
    category: z.string().trim().min(1).max(40),
    description: z.string().trim().min(1).max(500),
    specification: z.string().trim().max(1000),
    make: z.string().trim().max(500),
    warranty: z.string().trim().max(500),
    unit: z.string().trim().max(20),
    qtyRule: z.enum(["PANEL_COUNT", "ONE", "EARTHING", "FIXED", "TEXT"]),
    fixedQty: z.number().int().min(0).nullable(),
    qtyText: z.string().trim().max(100).nullable(),
    isActive: z.boolean(),
  }),
);

export async function saveCatalogAction(input: z.input<typeof CatalogSchema>) {
  return runAction(async () => {
    const admin = await requireRole("ADMIN");
    const items = CatalogSchema.parse(input);
    const before = await db.catalogItem.findMany({ orderBy: { sortOrder: "asc" } });
    await db.$transaction(async (tx) => {
      const keep = items.filter((i) => i.id).map((i) => i.id!);
      // Items are deactivated, never deleted, so old quotes stay explainable.
      await tx.catalogItem.updateMany({ where: { id: { notIn: keep } }, data: { isActive: false } });
      for (const { id, ...data } of items) {
        if (id) await tx.catalogItem.update({ where: { id }, data });
        else await tx.catalogItem.create({ data });
      }
    });
    await audit(admin.id, "CatalogItem", null, "UPDATE", { before, after: items });
    revalidatePath("/admin/settings");
  });
}

const SlabsSchema = z
  .array(
    z.object({
      id: z.string().nullable(),
      minKw: z.number().min(0),
      maxKw: z.number().positive(),
      ratePerKwInclGst: z.number().int().positive(),
      phase: z.enum(["SINGLE", "THREE"]).nullable(),
      isActive: z.boolean(),
    }),
  )
  .refine((slabs) => slabs.every((s) => s.maxKw >= s.minKw), "Max kW must be ≥ min kW");

export async function savePricingAction(input: z.input<typeof SlabsSchema>) {
  return runAction(async () => {
    const admin = await requireRole("ADMIN");
    const slabs = SlabsSchema.parse(input);
    const before = await db.pricingSlab.findMany();
    await db.$transaction(async (tx) => {
      const keep = slabs.filter((s) => s.id).map((s) => s.id!);
      await tx.pricingSlab.updateMany({ where: { id: { notIn: keep } }, data: { isActive: false } });
      for (const { id, ...data } of slabs) {
        if (id) await tx.pricingSlab.update({ where: { id }, data });
        else await tx.pricingSlab.create({ data });
      }
    });
    await audit(admin.id, "PricingSlab", null, "UPDATE", { before, after: slabs });
    revalidatePath("/admin/settings");
  });
}

/* -------------------------------- Users -------------------------------- */

const CreateUserSchema = z.object({
  role: z.enum(["WORKER", "ADMIN"]),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  phone: mobileSchema,
  password: z.string().min(8).max(200),
});

export async function createStaffUserAction(input: z.input<typeof CreateUserSchema>) {
  return runAction(async () => {
    const admin = await requireRole("ADMIN");
    const data = CreateUserSchema.parse(input);
    const exists = await db.user.findFirst({ where: { OR: [{ email: data.email }, { phone: data.phone }] } });
    if (exists) throw new AppError("CONFLICT", "A user with this email or phone already exists");
    const { data: created, error } = await supabaseAdmin().auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name },
    });
    if (error || !created.user) throw new AppError("CONFLICT", error?.message ?? "Could not create user");
    try {
      await db.user.create({ data: { id: created.user.id, role: data.role, name: data.name, email: data.email, phone: data.phone } });
    } catch (err) {
      await supabaseAdmin().auth.admin.deleteUser(created.user.id).catch(() => undefined);
      throw err;
    }
    await audit(admin.id, "User", created.user.id, "CREATE", { role: data.role, email: data.email });
    revalidatePath("/admin/users");
  });
}

export async function setUserActiveAction(input: { userId: string; active: boolean }) {
  return runAction(async () => {
    const admin = await requireRole("ADMIN");
    const { userId, active } = z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(input);
    if (userId === admin.id) throw new AppError("VALIDATION", "You can't deactivate your own account");
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError("NOT_FOUND");
    if (!active && user.role === "ADMIN") {
      const admins = await db.user.count({ where: { role: "ADMIN", isActive: true } });
      if (admins <= 1) throw new AppError("VALIDATION", "At least one admin must remain active");
    }
    await db.user.update({ where: { id: userId }, data: { isActive: active } });
    // Also block sign-in at the identity provider (defence in depth; our session check already rejects inactive users).
    await supabaseAdmin()
      .auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" })
      .catch((e) => console.warn("[users] ban update failed", e));
    await audit(admin.id, "User", userId, active ? "ACTIVATE" : "DEACTIVATE", {});
    revalidatePath("/admin/users");
  });
}
