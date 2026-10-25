"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCustomerProject, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/ratelimit";
import { runAction } from "@/lib/result";
import { notifyAdmins, notifyCustomer, recordEvent, withWorkflow } from "@/lib/workflow/service";

export const TICKET_CATEGORIES = ["NO_GENERATION", "INVERTER", "CLEANING", "DAMAGE", "NET_METER", "OTHER"] as const;

const CreateSchema = z.object({ category: z.enum(TICKET_CATEGORIES), description: z.string().trim().min(5).max(2000) });

/** AMC service request — only once the plant is commissioned. */
export async function createTicketAction(input: z.input<typeof CreateSchema>) {
  return runAction(async () => {
    const user = await requireRole("CUSTOMER");
    const projectId = await requireCustomerProject(user);
    const data = CreateSchema.parse(input);
    await rateLimit(`ticket:${user.id}`, 5, 3600);
    const project = await db.project.findUniqueOrThrow({ where: { id: projectId }, select: { commissionedAt: true, completedAt: true } });
    if (!project.commissionedAt && !project.completedAt) throw new AppError("INVALID_TRANSITION", "Service requests open after commissioning");
    const ticket = await withWorkflow(async (tx, fx) => {
      const t = await tx.serviceTicket.create({ data: { projectId, category: data.category, description: data.description, createdById: user.id } });
      await recordEvent(tx, fx, projectId, user.id, { type: "TICKET_RAISED", category: data.category.replace("_", " ").toLowerCase() });
      await notifyAdmins(tx, fx, projectId, {
        titleEn: "New service request",
        titleHi: "नया सर्विस अनुरोध",
        bodyEn: `${user.name}: ${data.description.slice(0, 120)}`,
        bodyHi: `${user.name}: ${data.description.slice(0, 120)}`,
        href: "/admin/tickets",
      });
      return t;
    });
    revalidatePath("/portal/support");
    return { ticketId: ticket.id, projectId };
  });
}

const UpdateSchema = z.object({ ticketId: z.string().min(1), status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]), adminNote: z.string().trim().max(1000).nullable() });

export async function updateTicketAction(input: z.input<typeof UpdateSchema>) {
  return runAction(async () => {
    const admin = await requireRole("ADMIN");
    const data = UpdateSchema.parse(input);
    const ticket = await db.serviceTicket.findUnique({ where: { id: data.ticketId } });
    if (!ticket) throw new AppError("NOT_FOUND");
    await withWorkflow(async (tx, fx) => {
      await tx.serviceTicket.update({
        where: { id: ticket.id },
        data: { status: data.status, adminNote: data.adminNote, resolvedAt: data.status === "RESOLVED" || data.status === "CLOSED" ? new Date() : null },
      });
      await recordEvent(tx, fx, ticket.projectId, admin.id, { type: "TICKET_UPDATED", status: data.status });
      await notifyCustomer(tx, fx, ticket.projectId, {
        titleEn: "Service request updated",
        titleHi: "सर्विस अनुरोध अपडेट",
        bodyEn: data.adminNote ?? `Status: ${data.status.replace("_", " ").toLowerCase()}`,
        bodyHi: data.adminNote ?? `स्थिति: ${data.status}`,
        href: "/portal/support",
      });
    });
    revalidatePath("/admin/tickets");
  });
}
