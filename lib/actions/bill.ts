"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { mergeConsumption } from "@/lib/solar/consumption";
import { runAction } from "@/lib/result";
import { MONTH_KEY_RE } from "@/lib/solar/types";
import { advanceIfReady, recordEvent, withWorkflow } from "@/lib/workflow/service";

const optNum = z.number().finite().nonnegative().nullable();
const optStr = z.string().trim().max(300).nullable();

const BillDataSchema = z.object({
  projectId: z.string().min(1),
  confirm: z.boolean(),
  fields: z.object({
    serviceNo: optStr,
    consumerName: optStr,
    billAddress: optStr,
    purpose: optStr,
    tariffCategory: optStr,
    sanctionedLoadW: optNum,
    connectedLoadKw: optNum,
    phase: z.enum(["SINGLE", "THREE"]).nullable(),
    currentReading: optNum,
    previousReading: optNum,
    billedUnits: optNum,
    netBillAmount: optNum,
    existingSolarExport: optNum,
  }),
  months: z
    .array(z.object({ month: z.string().regex(MONTH_KEY_RE), units: z.number().finite().nonnegative(), source: z.enum(["BILL", "HISTORY", "MANUAL"]) }))
    .max(36),
});

/** Admin edits and/or confirms bill data. Only confirmed data feeds sizing. */
export async function saveBillDataAction(input: z.input<typeof BillDataSchema>) {
  return runAction(async () => {
    const admin = await requireRole("ADMIN");
    const data = BillDataSchema.parse(input);
    if (data.confirm && data.months.length < 3) throw new AppError("VALIDATION", "At least 3 months of consumption are needed to confirm");
    const months = mergeConsumption(data.months);

    await withWorkflow(async (tx, fx) => {
      const existing = await tx.billData.findUnique({ where: { projectId: data.projectId } });
      const update = {
        ...data.fields,
        sanctionedLoadW: data.fields.sanctionedLoadW === null ? null : Math.round(data.fields.sanctionedLoadW),
        monthlyConsumption: months as unknown as Prisma.InputJsonValue,
        ...(data.confirm
          ? { confirmedByAdmin: true, confirmedById: admin.id, confirmedAt: new Date(), needsReview: false }
          : { confirmedByAdmin: false }),
      };
      if (existing) await tx.billData.update({ where: { projectId: data.projectId }, data: update });
      else await tx.billData.create({ data: { projectId: data.projectId, source: "MANUAL", ...update } });

      if (data.fields.phase) {
        await tx.project.updateMany({ where: { id: data.projectId, phase: null }, data: { phase: data.fields.phase } });
      }
      if (data.confirm) {
        await recordEvent(tx, fx, data.projectId, admin.id, { type: "BILL_CONFIRMED" });
        await advanceIfReady(tx, fx, data.projectId, admin.id);
      }
    });
    revalidatePath(`/admin/projects/${data.projectId}`);
  });
}

export async function rerunExtractionAction(projectId: string) {
  return runAction(async () => {
    await requireRole("ADMIN");
    const id = z.string().min(1).parse(projectId);
    const n = await db.document.updateMany({
      where: { projectId: id, isLatest: true, uploaded: true, type: { in: ["ELECTRICITY_BILL", "CONSUMPTION_HISTORY"] } },
      data: { extractionStatus: "QUEUED", extractionError: null },
    });
    if (!n.count) throw new AppError("NOT_FOUND", "No bill uploaded yet");
    await withWorkflow(async (_tx, fx) => {
      fx.later(async () => (await import("@/lib/extraction/pipeline")).queueBillExtraction(id));
    });
    revalidatePath(`/admin/projects/${id}`);
  });
}
