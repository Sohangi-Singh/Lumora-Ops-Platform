import type { DocumentType, Role } from "@prisma/client";

/** Pure authorization rules (unit-tested); the DB lookups live in ./index.ts. */

export type ProjectAccess = {
  id: string;
  customerId: string;
  customerUserId: string;
  assignedWorkerId: string | null;
};

type Subject = { id: string; role: Role };

export function canAccessProject(user: Subject, project: ProjectAccess): boolean {
  switch (user.role) {
    case "ADMIN":
      return true;
    case "WORKER":
      return project.assignedWorkerId !== null && project.assignedWorkerId === user.id;
    case "CUSTOMER":
      return project.customerUserId === user.id;
    default:
      return false;
  }
}

/** Workers never see KYC/bank documents (or any customer document). */
export function canViewDocument(user: Pick<Subject, "role">, _type: DocumentType): boolean {
  return user.role === "ADMIN" || user.role === "CUSTOMER";
}

/** Workers never see prices, quotes or payments. */
export function canSeePricing(user: Pick<Subject, "role">): boolean {
  return user.role !== "WORKER";
}
