import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { blockersFor, loadSnapshot } from "@/lib/workflow/service";

/** The signed-in customer's project with everything the portal pages need. */
export const getCustomerProject = cache(async (user: SessionUser) => {
  if (user.role !== "CUSTOMER") notFound();
  const project = await db.project.findFirst({
    where: { customer: { userId: user.id } },
    orderBy: { createdAt: "desc" },
    include: { customer: true, assignedWorker: { select: { name: true, phone: true } } },
  });
  if (!project) notFound();
  const snapshot = await loadSnapshot(db, project.id);
  const blockers = await blockersFor(snapshot);
  return { project, snapshot, blockers };
});
