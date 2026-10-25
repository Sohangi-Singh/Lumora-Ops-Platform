import "server-only";
import { notFound } from "next/navigation";
import type { SessionUser } from "@/lib/auth/session";
import { assertCanAccessProject } from "@/lib/authz";
import { db } from "@/lib/db";
import { istDateParts } from "@/lib/format";

export type Job = {
  projectId: string;
  type: "SURVEY" | "INSTALLATION";
  customerName: string;
  phone: string | null;
  address: string;
  area: string;
  city: string;
  when: Date | null;
  bucket: "today" | "upcoming" | "done";
  overdue: boolean;
};

const sameIstDay = (a: Date, b: Date) => {
  const x = istDateParts(a);
  const y = istDateParts(b);
  return x.day === y.day && x.month === y.month && x.year === y.year;
};

/**
 * Jobs for a field worker. Deliberately selects only what a worker may see:
 * name, phone, address — never documents, pricing or payments.
 */
export async function listJobs(user: SessionUser): Promise<Job[]> {
  const now = new Date();
  const projects = await db.project.findMany({
    where: { OR: [{ assignedWorkerId: user.id }, { survey: { workerId: user.id } }] },
    select: {
      id: true,
      stage: true,
      assignedWorkerId: true,
      installedAt: true,
      materialDispatchedAt: true,
      stageEnteredAt: true,
      customer: { select: { addressLine1: true, addressLine2: true, city: true, pincode: true, user: { select: { name: true, phone: true } } } },
      survey: { select: { workerId: true, status: true, scheduledAt: true, submittedAt: true } },
    },
  });

  const jobs: Job[] = [];
  for (const p of projects) {
    const base = {
      projectId: p.id,
      customerName: p.customer.user.name,
      phone: p.customer.user.phone,
      address: [p.customer.addressLine1, p.customer.addressLine2, p.customer.city, p.customer.pincode].filter(Boolean).join(", "),
      area: p.customer.addressLine2 ?? p.customer.city,
      city: p.customer.city,
    };
    if (p.survey && p.survey.workerId === user.id) {
      const done = p.survey.status === "SUBMITTED";
      const when = done ? (p.survey.submittedAt ?? p.survey.scheduledAt) : p.survey.scheduledAt;
      const overdue = !done && when < now && !sameIstDay(when, now);
      jobs.push({ ...base, type: "SURVEY", when, overdue, bucket: done ? "done" : overdue || sameIstDay(when, now) ? "today" : when < now ? "today" : "upcoming" });
    }
    if (p.assignedWorkerId === user.id && (p.stage === "INSTALLATION" || p.installedAt)) {
      const done = Boolean(p.installedAt);
      jobs.push({ ...base, type: "INSTALLATION", when: p.installedAt ?? p.materialDispatchedAt ?? p.stageEnteredAt, overdue: false, bucket: done ? "done" : "today" });
    }
  }
  return jobs.sort((a, b) => (a.when?.getTime() ?? 0) - (b.when?.getTime() ?? 0));
}

export async function getWorkerJob(user: SessionUser, projectId: string) {
  await assertCanAccessProject(user, projectId).catch(() => notFound());
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      stage: true,
      materialDispatchedAt: true,
      materialReceivedAt: true,
      installedAt: true,
      installationNotes: true,
      customer: { select: { salutation: true, addressLine1: true, addressLine2: true, city: true, state: true, pincode: true, user: { select: { name: true, phone: true } } } },
      survey: true,
      photos: { where: { uploaded: true, kind: { not: "TICKET" } }, select: { id: true, kind: true, lat: true, lng: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!project) notFound();
  return project;
}
