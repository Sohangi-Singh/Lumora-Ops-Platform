import "server-only";
import type { Role } from "@prisma/client";
import { forbidden, redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AuthzError } from "@/lib/errors";
import { canAccessProject, type ProjectAccess } from "./rules";

export { canAccessProject, canSeePricing, canViewDocument, type ProjectAccess } from "./rules";

/**
 * Central authorization layer. Every server action, route handler and page
 * that touches project data goes through one of these functions — the client
 * is never trusted with role or ownership decisions.
 */

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthzError("UNAUTHENTICATED");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new AuthzError("FORBIDDEN");
  return user;
}

/** For pages/layouts: redirect to login or render the 403 page. */
export async function requirePageRole(...roles: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!roles.includes(user.role)) forbidden();
  return user;
}

export async function assertCanAccessProject(user: SessionUser, projectId: string): Promise<ProjectAccess> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, customerId: true, assignedWorkerId: true, customer: { select: { userId: true } } },
  });
  // Non-admins get NOT_FOUND rather than FORBIDDEN so IDs can't be probed.
  if (!project) throw new AuthzError("NOT_FOUND");
  const access: ProjectAccess = {
    id: project.id,
    customerId: project.customerId,
    customerUserId: project.customer.userId,
    assignedWorkerId: project.assignedWorkerId,
  };
  if (!canAccessProject(user, access)) {
    throw new AuthzError(user.role === "ADMIN" ? "FORBIDDEN" : "NOT_FOUND");
  }
  return access;
}

/** The customer's single active project (one project per customer account). */
export async function requireCustomerProject(user: SessionUser): Promise<string> {
  if (user.role !== "CUSTOMER") throw new AuthzError("FORBIDDEN");
  const project = await db.project.findFirst({
    where: { customer: { userId: user.id } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!project) throw new AuthzError("NOT_FOUND");
  return project.id;
}
