"use server";

import type { DocumentType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertCanAccessProject, canViewDocument, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { queueBillExtraction } from "@/lib/extraction/pipeline";
import { rateLimit } from "@/lib/ratelimit";
import { runAction } from "@/lib/result";
import { assertUploadAllowed, BUCKETS, createSignedUpload, inspectUploadedObject, newObjectPath, removeObjects } from "@/lib/storage";
import { extensionFor, MAX_UPLOAD_BYTES, normalizeMime } from "@/lib/storage/magic";
import { DOC_LABELS } from "@/lib/workflow/labels";
import { advanceIfReady, notifyAdmins, recordEvent, withWorkflow } from "@/lib/workflow/service";

const DOC_TYPES = ["ELECTRICITY_BILL", "CONSUMPTION_HISTORY", "AADHAAR", "PAN", "CANCELLED_CHEQUE", "OTHER"] as const;
const EXTRACTABLE: DocumentType[] = ["ELECTRICITY_BILL", "CONSUMPTION_HISTORY"];

const RequestUploadSchema = z.object({
  projectId: z.string().min(1),
  type: z.enum(DOC_TYPES),
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.string().min(1).max(100),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

/**
 * Step 1 of an upload: authorize, validate the declared type/size, reserve a
 * Document row and hand back a one-time signed upload URL for the browser.
 */
export async function requestDocumentUploadAction(input: z.input<typeof RequestUploadSchema>) {
  return runAction(async () => {
    const user = await requireRole("CUSTOMER", "ADMIN");
    const data = RequestUploadSchema.parse(input);
    await assertCanAccessProject(user, data.projectId);
    await rateLimit(`upload:${user.id}`, 40, 600);
    assertUploadAllowed(data.mimeType, data.size);

    const project = await db.project.findUniqueOrThrow({ where: { id: data.projectId }, select: { stage: true } });
    if (user.role === "CUSTOMER") {
      if (data.type !== "OTHER" && project.stage !== "REGISTERED" && project.stage !== "DOCUMENTS") {
        throw new AppError("INVALID_TRANSITION", "Documents are already verified for this project");
      }
      const latest = await db.document.findFirst({
        where: { projectId: data.projectId, type: data.type, isLatest: true, uploaded: true },
        select: { status: true },
      });
      if (latest?.status === "APPROVED" && data.type !== "OTHER") {
        throw new AppError("CONFLICT", "This document is already approved");
      }
    }

    const mime = normalizeMime(data.mimeType);
    const ext = mime === "application/pdf" ? "pdf" : extensionFor(mime as Parameters<typeof extensionFor>[0]);
    const path = newObjectPath(data.projectId, `documents/${data.type.toLowerCase()}`, ext);
    const last = await db.document.aggregate({ where: { projectId: data.projectId, type: data.type }, _max: { version: true } });

    const doc = await db.document.create({
      data: {
        projectId: data.projectId,
        type: data.type,
        storagePath: path,
        fileName: data.fileName,
        mimeType: mime,
        size: data.size,
        uploaded: false,
        isLatest: false,
        uploadedById: user.id,
        version: (last._max.version ?? 0) + 1,
      },
    });
    const signed = await createSignedUpload(BUCKETS.documents, path);
    return { documentId: doc.id, path: signed.path, token: signed.token, bucket: BUCKETS.documents };
  });
}

/**
 * Step 2: the browser finished uploading. Verify the object by its magic
 * bytes and real size, then make it the latest version and kick off
 * extraction for bills — without making the customer wait for it.
 */
export async function finalizeDocumentUploadAction(documentId: string) {
  return runAction(async () => {
    const user = await requireRole("CUSTOMER", "ADMIN");
    const doc = await db.document.findUnique({ where: { id: z.string().min(1).parse(documentId) } });
    if (!doc || doc.uploadedById !== user.id) throw new AppError("NOT_FOUND");
    await assertCanAccessProject(user, doc.projectId);
    if (doc.uploaded) return { documentId: doc.id };

    const inspected = await inspectUploadedObject(BUCKETS.documents, doc.storagePath);
    const reject = async (code: "FILE_CONTENT_MISMATCH" | "FILE_TOO_LARGE") => {
      await removeObjects(BUCKETS.documents, [doc.storagePath]);
      await db.document.delete({ where: { id: doc.id } });
      throw new AppError(code);
    };
    if (!inspected.type) await reject("FILE_CONTENT_MISMATCH");
    if (inspected.size > MAX_UPLOAD_BYTES) await reject("FILE_TOO_LARGE");

    const extract = EXTRACTABLE.includes(doc.type);
    await withWorkflow(async (tx, fx) => {
      await tx.document.updateMany({
        where: { projectId: doc.projectId, type: doc.type, isLatest: true, id: { not: doc.id } },
        data: { isLatest: false },
      });
      await tx.document.update({
        where: { id: doc.id },
        data: {
          uploaded: true,
          isLatest: true,
          status: "PENDING",
          mimeType: inspected.type!,
          size: inspected.size,
          extractionStatus: extract ? "QUEUED" : "NOT_APPLICABLE",
        },
      });
      // A new bill invalidates previously confirmed bill data.
      if (extract) await tx.billData.updateMany({ where: { projectId: doc.projectId }, data: { confirmedByAdmin: false } });
      await recordEvent(tx, fx, doc.projectId, user.id, { type: "DOCUMENT_UPLOADED", doc: doc.type, version: doc.version });
      if (user.role === "CUSTOMER") {
        const label = DOC_LABELS[doc.type];
        await notifyAdmins(tx, fx, doc.projectId, {
          titleEn: `${label.en} uploaded`,
          titleHi: `${label.hi} अपलोड हुआ`,
          bodyEn: `${user.name} uploaded a ${label.en.toLowerCase()} for review.`,
          bodyHi: `${user.name} ने जाँच के लिए ${label.hi} अपलोड किया।`,
          href: `/admin/projects/${doc.projectId}?tab=documents`,
        });
      }
      if (extract) fx.later(() => queueBillExtraction(doc.projectId));
    });
    revalidatePath("/portal", "layout");
    return { documentId: doc.id };
  });
}

/** Abandon a reserved upload that the browser could not complete. */
export async function cancelDocumentUploadAction(documentId: string) {
  return runAction(async () => {
    const user = await requireRole("CUSTOMER", "ADMIN");
    const doc = await db.document.findUnique({ where: { id: documentId } });
    if (!doc || doc.uploadedById !== user.id || doc.uploaded) return;
    await removeObjects(BUCKETS.documents, [doc.storagePath]);
    await db.document.delete({ where: { id: doc.id } });
  });
}

const ReviewSchema = z.discriminatedUnion("decision", [
  z.object({ documentId: z.string().min(1), decision: z.literal("APPROVE") }),
  z.object({ documentId: z.string().min(1), decision: z.literal("REJECT"), reason: z.string().trim().min(3).max(300) }),
]);

export async function reviewDocumentAction(input: z.input<typeof ReviewSchema>) {
  return runAction(async () => {
    const admin = await requireRole("ADMIN");
    const data = ReviewSchema.parse(input);
    const doc = await db.document.findUnique({ where: { id: data.documentId } });
    if (!doc || !doc.uploaded) throw new AppError("NOT_FOUND");
    if (!doc.isLatest) throw new AppError("CONFLICT", "A newer version of this document exists");

    await withWorkflow(async (tx, fx) => {
      const label = DOC_LABELS[doc.type];
      if (data.decision === "APPROVE") {
        await tx.document.update({
          where: { id: doc.id },
          data: { status: "APPROVED", rejectionReason: null, reviewedById: admin.id, reviewedAt: new Date() },
        });
        await recordEvent(tx, fx, doc.projectId, admin.id, { type: "DOCUMENT_APPROVED", doc: doc.type });
      } else {
        await tx.document.update({
          where: { id: doc.id },
          data: { status: "REJECTED", rejectionReason: data.reason, reviewedById: admin.id, reviewedAt: new Date() },
        });
        await recordEvent(tx, fx, doc.projectId, admin.id, { type: "DOCUMENT_REJECTED", doc: doc.type, reason: data.reason });
        const { notifyCustomer } = await import("@/lib/workflow/service");
        await notifyCustomer(tx, fx, doc.projectId, {
          titleEn: `${label.en} needs to be re-uploaded`,
          titleHi: `${label.hi} दोबारा अपलोड करें`,
          bodyEn: `Reason: ${data.reason}`,
          bodyHi: `कारण: ${data.reason}`,
          href: "/portal/documents",
        });
      }
      await advanceIfReady(tx, fx, doc.projectId, admin.id);
    });
    revalidatePath(`/admin/projects/${doc.projectId}`);
  });
}

/** Signed, short-lived read URL. Every view is written to the audit log. */
export async function documentViewUrl(documentId: string, opts: { download?: boolean } = {}): Promise<string> {
  const user = await requireRole("CUSTOMER", "ADMIN", "WORKER");
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc || !doc.uploaded) throw new AppError("NOT_FOUND");
  await assertCanAccessProject(user, doc.projectId);
  if (!canViewDocument(user, doc.type)) throw new AppError("FORBIDDEN");
  const { signedReadUrl } = await import("@/lib/storage");
  await withWorkflow((tx, fx) =>
    recordEvent(tx, fx, doc.projectId, user.id, { type: "DOCUMENT_VIEWED", doc: doc.type, viewer: `${user.name} (${user.role.toLowerCase()})` }),
  );
  return signedReadUrl(BUCKETS.documents, doc.storagePath, { download: opts.download ? doc.fileName : undefined });
}
