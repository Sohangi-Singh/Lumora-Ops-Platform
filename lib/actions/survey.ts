"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { runAction } from "@/lib/result";
import { notifyCustomer, notifyUsers, recordEvent, withWorkflow } from "@/lib/workflow/service";

const AssignSchema = z.object({
  projectId: z.string().min(1),
  workerId: z.string().uuid(),
  scheduledAt: z.coerce.date(),
});

/** Admin assigns a field worker and schedules (or reschedules) the site survey. */
export async function assignSurveyAction(input: z.input<typeof AssignSchema>) {
  return runAction(async () => {
    const admin = await requireRole("ADMIN");
    const data = AssignSchema.parse(input);
    const [project, worker] = await Promise.all([
      db.project.findUnique({ where: { id: data.projectId }, select: { stage: true, survey: { select: { status: true } } } }),
      db.user.findUnique({ where: { id: data.workerId }, select: { id: true, name: true, role: true, isActive: true } }),
    ]);
    if (!project) throw new AppError("NOT_FOUND");
    if (!worker || worker.role !== "WORKER" || !worker.isActive) throw new AppError("VALIDATION", "Choose an active field worker");
    if (!["DOCUMENTS", "SURVEY"].includes(project.stage)) throw new AppError("INVALID_TRANSITION", "Surveys can only be scheduled before the quote stage");
    if (project.survey?.status === "SUBMITTED") throw new AppError("CONFLICT", "The survey has already been submitted");

    await withWorkflow(async (tx, fx) => {
      await tx.project.update({ where: { id: data.projectId }, data: { assignedWorkerId: worker.id } });
      await tx.survey.upsert({
        where: { projectId: data.projectId },
        create: { projectId: data.projectId, workerId: worker.id, scheduledAt: data.scheduledAt },
        update: { workerId: worker.id, scheduledAt: data.scheduledAt },
      });
      const when = formatDateTime(data.scheduledAt, "en");
      const whenHi = formatDateTime(data.scheduledAt, "hi");
      await recordEvent(tx, fx, data.projectId, admin.id, { type: "WORKER_ASSIGNED", worker: worker.name, date: when });
      await notifyUsers(tx, fx, [worker.id], data.projectId, {
        titleEn: "New site survey assigned",
        titleHi: "नया साइट सर्वे मिला",
        bodyEn: `Survey scheduled for ${when}.`,
        bodyHi: `सर्वे ${whenHi} को तय है।`,
        href: `/worker/jobs/${data.projectId}`,
      });
      await notifyCustomer(tx, fx, data.projectId, {
        titleEn: "Site survey scheduled",
        titleHi: "साइट सर्वे तय हुआ",
        bodyEn: `${worker.name} will visit on ${when} to measure your roof.`,
        bodyHi: `${worker.name} ${whenHi} को आपकी छत नापने आएंगे।`,
        href: "/portal",
      });
    });
    revalidatePath(`/admin/projects/${data.projectId}`);
  });
}
