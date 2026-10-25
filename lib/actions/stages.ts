"use server";

import type { Stage } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { db, type Tx } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { runAction } from "@/lib/result";
import type { Effects } from "@/lib/workflow/effects";
import { advanceIfReady, notifyCustomer, notifyUsers, recordEvent, withWorkflow } from "@/lib/workflow/service";

/**
 * Admin actions for the post-payment stages. Each records the fact that
 * satisfies a stage guard; the state machine then decides whether the
 * project moves on — the UI never sets `stage` directly.
 */

async function inStage(projectId: string, stage: Stage) {
  const p = await db.project.findUnique({ where: { id: projectId }, select: { stage: true } });
  if (!p) throw new AppError("NOT_FOUND");
  if (p.stage !== stage) throw new AppError("INVALID_TRANSITION", `Project is in ${p.stage.toLowerCase().replace("_", " ")}, not ${stage.toLowerCase().replace("_", " ")}`);
}

async function act(projectId: string, adminId: string, fn: (tx: Tx, fx: Effects) => Promise<void>) {
  await withWorkflow(async (tx, fx) => {
    await fn(tx, fx);
    await advanceIfReady(tx, fx, projectId, adminId);
  });
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin");
}

const Id = z.string().min(1);

export async function recordSubsidyApplicationAction(input: { projectId: string; applicationNo: string }) {
  return runAction(async () => {
    const admin = await requireRole("ADMIN");
    const projectId = Id.parse(input.projectId);
    const applicationNo = z.string().trim().min(3).max(60).parse(input.applicationNo);
    await inStage(projectId, "SUBSIDY_APPLICATION");
    await act(projectId, admin.id, async (tx, fx) => {
      await tx.project.update({ where: { id: projectId }, data: { subsidyApplicationNo: applicationNo, subsidyAppliedAt: new Date() } });
      await recordEvent(tx, fx, projectId, admin.id, { type: "SUBSIDY_APPLIED", applicationNo });
    });
  });
}

export async function dispatchMaterialAction(input: { projectId: string; installerId: string }) {
  return runAction(async () => {
    const admin = await requireRole("ADMIN");
    const projectId = Id.parse(input.projectId);
    const installerId = z.string().uuid().parse(input.installerId);
    await inStage(projectId, "INSTALLATION");
    const installer = await db.user.findUnique({ where: { id: installerId } });
    if (!installer || installer.role !== "WORKER" || !installer.isActive) throw new AppError("VALIDATION", "Choose an active field worker");
    await act(projectId, admin.id, async (tx, fx) => {
      await tx.project.update({ where: { id: projectId }, data: { materialDispatchedAt: new Date(), assignedWorkerId: installerId } });
      await recordEvent(tx, fx, projectId, admin.id, { type: "MATERIAL_DISPATCHED" });
      await notifyUsers(tx, fx, [installerId], projectId, {
        titleEn: "New installation job",
        titleHi: "नया इंस्टॉलेशन काम",
        bodyEn: "Material has been dispatched. Open the job to log receipt, photos and completion.",
        bodyHi: "सामान भेज दिया गया है। काम खोलकर सामान मिलना, फ़ोटो और पूरा होना दर्ज करें।",
        href: `/worker/jobs/${projectId}/installation`,
      });
      await notifyCustomer(tx, fx, projectId, {
        titleEn: "Material dispatched",
        titleHi: "सामान भेज दिया गया",
        bodyEn: `Your panels and inverter are on the way. ${installer.name} will install your plant.`,
        bodyHi: `आपके पैनल और इन्वर्टर रास्ते में हैं। ${installer.name} आपका प्लांट लगाएंगे।`,
        href: "/portal",
      });
    });
  });
}

export async function fileNetMeteringAction(input: { projectId: string; refNo: string }) {
  return runAction(async () => {
    const admin = await requireRole("ADMIN");
    const projectId = Id.parse(input.projectId);
    const refNo = z.string().trim().min(2).max(60).parse(input.refNo);
    await inStage(projectId, "NET_METERING");
    await act(projectId, admin.id, async (tx, fx) => {
      await tx.project.update({ where: { id: projectId }, data: { netMeteringFiledAt: new Date(), netMeteringRefNo: refNo } });
      await recordEvent(tx, fx, projectId, admin.id, { type: "NET_METERING_FILED", refNo });
      await notifyCustomer(tx, fx, projectId, {
        titleEn: "Net-metering file submitted — 10% balance due",
        titleHi: "नेट मीटरिंग फ़ाइल जमा — 10% बाकी भुगतान करें",
        bodyEn: "We've submitted your synchronisation file to CSPDCL. Please pay the 10% balance.",
        bodyHi: "हमने CSPDCL में आपकी फ़ाइल जमा कर दी है। कृपया 10% बाकी राशि का भुगतान करें।",
        href: "/portal/payments",
      });
    });
  });
}

export async function markNetMeterInstalledAction(input: { projectId: string }) {
  return runAction(async () => {
    const admin = await requireRole("ADMIN");
    const projectId = Id.parse(input.projectId);
    await inStage(projectId, "COMMISSIONED");
    await act(projectId, admin.id, async (tx, fx) => {
      const now = new Date();
      await tx.project.update({ where: { id: projectId }, data: { netMeterInstalledAt: now, commissionedAt: now } });
      await recordEvent(tx, fx, projectId, admin.id, { type: "NET_METER_INSTALLED" });
    });
  });
}

export async function markSubsidyCreditedAction(input: { projectId: string }) {
  return runAction(async () => {
    const admin = await requireRole("ADMIN");
    const projectId = Id.parse(input.projectId);
    await inStage(projectId, "SUBSIDY_CREDITED");
    await act(projectId, admin.id, async (tx, fx) => {
      const now = new Date();
      const amcEnd = new Date(now);
      amcEnd.setFullYear(amcEnd.getFullYear() + 5);
      await tx.project.update({ where: { id: projectId }, data: { subsidyCreditedAt: now, amcStartDate: now, amcEndDate: amcEnd, completedAt: now } });
      await recordEvent(tx, fx, projectId, admin.id, { type: "SUBSIDY_CREDITED" });
      await recordEvent(tx, fx, projectId, admin.id, { type: "PROJECT_COMPLETED" });
      await notifyCustomer(tx, fx, projectId, {
        titleEn: "Subsidy credited — your project is complete!",
        titleHi: "सब्सिडी आ गई — आपका प्रोजेक्ट पूरा हुआ!",
        bodyEn: "Your 5-year AMC has started. Raise a service request anytime from Support.",
        bodyHi: "आपका 5 साल का AMC शुरू हो गया है। ज़रूरत हो तो सहायता में सर्विस अनुरोध दर्ज करें।",
        href: "/portal/support",
      });
    });
  });
}
