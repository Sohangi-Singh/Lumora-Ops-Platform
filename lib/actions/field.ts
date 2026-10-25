"use server";

import type { PhotoKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertCanAccessProject, requireRole, requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/ratelimit";
import { runAction } from "@/lib/result";
import { assertUploadAllowed, BUCKETS, createSignedUpload, inspectUploadedObject, newObjectPath, removeObjects } from "@/lib/storage";
import { MAX_UPLOAD_BYTES } from "@/lib/storage/magic";
import { missingSurveyItems, roofAreaSqm, SurveyFieldsSchema } from "@/lib/survey/requirements";
import { advanceIfReady, notifyAdmins, recordEvent, withWorkflow } from "@/lib/workflow/service";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"] as const;
const WORKER_KINDS: PhotoKind[] = ["SURVEY_ROOF", "SURVEY_SHADOW", "INSTALL_BEFORE", "INSTALL_AFTER"];

/** Field work is done by the assigned worker (or an admin on their behalf). */
async function requireFieldAccess(projectId: string) {
  const user = await requireRole("WORKER", "ADMIN");
  await assertCanAccessProject(user, projectId);
  return user;
}

export async function startSurveyAction(projectId: string) {
  return runAction(async () => {
    const user = await requireFieldAccess(projectId);
    const survey = await db.survey.findUnique({ where: { projectId } });
    if (!survey) throw new AppError("NOT_FOUND", "No survey scheduled");
    if (survey.status !== "SCHEDULED") return;
    await withWorkflow(async (tx, fx) => {
      await tx.survey.update({ where: { projectId }, data: { status: "IN_PROGRESS", startedAt: new Date() } });
      await recordEvent(tx, fx, projectId, user.id, { type: "SURVEY_STARTED", worker: user.name });
    });
  });
}

const PhotoRequestSchema = z.object({
  projectId: z.string().min(1),
  kind: z.enum(["SURVEY_ROOF", "SURVEY_SHADOW", "INSTALL_BEFORE", "INSTALL_AFTER", "TICKET"]),
  mimeType: z.enum(IMAGE_TYPES),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  accuracy: z.number().min(0).max(100_000).nullable().optional(),
  takenAt: z.coerce.date().nullable().optional(),
  caption: z.string().max(300).nullable().optional(),
  ticketId: z.string().nullable().optional(),
});

/** Reserve a photo row and return a signed upload URL (survey, installation or ticket photos). */
export async function requestPhotoUploadAction(input: z.input<typeof PhotoRequestSchema>) {
  return runAction(async () => {
    const data = PhotoRequestSchema.parse(input);
    const user = await requireUser();
    await assertCanAccessProject(user, data.projectId);
    if (WORKER_KINDS.includes(data.kind) && user.role === "CUSTOMER") throw new AppError("FORBIDDEN");
    if (data.kind === "TICKET" && user.role === "WORKER") throw new AppError("FORBIDDEN");
    await rateLimit(`photo:${user.id}`, 120, 600);
    assertUploadAllowed(data.mimeType, data.size, IMAGE_TYPES);

    let surveyId: string | null = null;
    if (data.kind === "SURVEY_ROOF" || data.kind === "SURVEY_SHADOW") {
      const survey = await db.survey.findUnique({ where: { projectId: data.projectId }, select: { id: true, status: true } });
      if (!survey) throw new AppError("NOT_FOUND", "No survey scheduled");
      if (survey.status === "SUBMITTED") throw new AppError("CONFLICT", "Survey already submitted");
      surveyId = survey.id;
    }
    if (data.kind === "SURVEY_ROOF" && (data.lat == null || data.lng == null)) {
      throw new AppError("VALIDATION", "Rooftop photos must be geo-tagged");
    }

    const ext = data.mimeType === "image/png" ? "png" : data.mimeType === "image/webp" ? "webp" : data.mimeType === "image/heic" ? "heic" : "jpg";
    const path = newObjectPath(data.projectId, `photos/${data.kind.toLowerCase()}`, ext);
    const photo = await db.photo.create({
      data: {
        projectId: data.projectId,
        surveyId,
        ticketId: data.ticketId ?? null,
        kind: data.kind,
        storagePath: path,
        mimeType: data.mimeType,
        size: data.size,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        accuracy: data.accuracy ?? null,
        takenAt: data.takenAt ?? null,
        caption: data.caption ?? null,
        uploadedById: user.id,
      },
    });
    const signed = await createSignedUpload(BUCKETS.photos, path);
    return { photoId: photo.id, path: signed.path, token: signed.token, bucket: BUCKETS.photos };
  });
}

export async function finalizePhotoUploadAction(photoId: string) {
  return runAction(async () => {
    const user = await requireUser();
    const photo = await db.photo.findUnique({ where: { id: z.string().min(1).parse(photoId) } });
    if (!photo || photo.uploadedById !== user.id) throw new AppError("NOT_FOUND");
    if (photo.uploaded) return { photoId: photo.id };
    const inspected = await inspectUploadedObject(BUCKETS.photos, photo.storagePath);
    if (!inspected.type || inspected.type === "application/pdf") {
      await removeObjects(BUCKETS.photos, [photo.storagePath]);
      await db.photo.delete({ where: { id: photo.id } });
      throw new AppError("FILE_CONTENT_MISMATCH");
    }
    await withWorkflow(async (tx, fx) => {
      await tx.photo.update({ where: { id: photo.id }, data: { uploaded: true, size: inspected.size, mimeType: inspected.type! } });
      if (photo.kind === "INSTALL_BEFORE" || photo.kind === "INSTALL_AFTER") {
        await recordEvent(tx, fx, photo.projectId, user.id, { type: "INSTALL_PHOTOS_UPLOADED", count: 1 });
        await advanceIfReady(tx, fx, photo.projectId, user.id);
      }
    });
    return { photoId: photo.id };
  });
}

export async function deletePhotoAction(photoId: string) {
  return runAction(async () => {
    const user = await requireUser();
    const photo = await db.photo.findUnique({ where: { id: photoId }, include: { survey: { select: { status: true } } } });
    if (!photo) throw new AppError("NOT_FOUND");
    await assertCanAccessProject(user, photo.projectId);
    if (user.role !== "ADMIN" && photo.uploadedById !== user.id) throw new AppError("FORBIDDEN");
    if (photo.survey?.status === "SUBMITTED") throw new AppError("CONFLICT", "Survey already submitted");
    await removeObjects(BUCKETS.photos, [photo.storagePath]);
    await db.photo.delete({ where: { id: photo.id } });
  });
}

const SubmitSchema = z.object({
  projectId: z.string().min(1),
  fields: SurveyFieldsSchema,
  gps: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy: z.number().min(0).nullable(),
    capturedAt: z.coerce.date(),
  }),
});

/** Validate everything server-side (never trust the form), then submit and advance. */
export async function submitSurveyAction(input: z.input<typeof SubmitSchema>) {
  return runAction(async () => {
    const data = SubmitSchema.parse(input);
    const user = await requireFieldAccess(data.projectId);
    const survey = await db.survey.findUnique({ where: { projectId: data.projectId } });
    if (!survey) throw new AppError("NOT_FOUND", "No survey scheduled");
    if (survey.status === "SUBMITTED") throw new AppError("CONFLICT", "Survey already submitted");

    const [roofGeo, shadow] = await Promise.all([
      db.photo.count({ where: { surveyId: survey.id, kind: "SURVEY_ROOF", uploaded: true, lat: { not: null } } }),
      db.photo.count({ where: { surveyId: survey.id, kind: "SURVEY_SHADOW", uploaded: true } }),
    ]);
    const missing = missingSurveyItems(data.fields, { roofGeo, shadow });
    if (missing.length) throw new AppError("VALIDATION", `Survey incomplete: ${missing.join(", ")}`);

    await withWorkflow(async (tx, fx) => {
      await tx.survey.update({
        where: { projectId: data.projectId },
        data: {
          ...data.fields,
          roofAreaSqm: roofAreaSqm(data.fields.roofLengthM, data.fields.roofWidthM),
          lat: data.gps.lat,
          lng: data.gps.lng,
          gpsAccuracy: data.gps.accuracy,
          gpsCapturedAt: data.gps.capturedAt,
          status: "SUBMITTED",
          startedAt: survey.startedAt ?? new Date(),
          submittedAt: new Date(),
        },
      });
      await tx.project.updateMany({ where: { id: data.projectId, phase: null }, data: { phase: data.fields.phaseObserved } });
      await recordEvent(tx, fx, data.projectId, user.id, { type: "SURVEY_SUBMITTED", worker: user.name });
      await notifyAdmins(tx, fx, data.projectId, {
        titleEn: "Site survey submitted",
        titleHi: "साइट सर्वे जमा हुआ",
        bodyEn: `${user.name} submitted the survey (${roofAreaSqm(data.fields.roofLengthM, data.fields.roofWidthM)} m² usable roof).`,
        bodyHi: `${user.name} ने सर्वे जमा किया।`,
        href: `/admin/projects/${data.projectId}?tab=survey`,
      });
      await advanceIfReady(tx, fx, data.projectId, user.id);
    });
    revalidatePath("/worker");
  });
}

const InstallSchema = z.object({
  projectId: z.string().min(1),
  step: z.enum(["MATERIAL_RECEIVED", "INSTALLED"]),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function recordInstallationStepAction(input: z.input<typeof InstallSchema>) {
  return runAction(async () => {
    const data = InstallSchema.parse(input);
    const user = await requireFieldAccess(data.projectId);
    const project = await db.project.findUniqueOrThrow({
      where: { id: data.projectId },
      select: { stage: true, materialDispatchedAt: true, materialReceivedAt: true, installedAt: true },
    });
    if (project.stage !== "INSTALLATION") throw new AppError("INVALID_TRANSITION", "Project is not in the installation stage");
    if (!project.materialDispatchedAt) throw new AppError("INVALID_TRANSITION", "Material has not been dispatched yet");
    if (data.step === "INSTALLED" && !project.materialReceivedAt) throw new AppError("INVALID_TRANSITION", "Mark material received first");

    await withWorkflow(async (tx, fx) => {
      if (data.step === "MATERIAL_RECEIVED") {
        if (project.materialReceivedAt) return;
        await tx.project.update({ where: { id: data.projectId }, data: { materialReceivedAt: new Date() } });
        await recordEvent(tx, fx, data.projectId, user.id, { type: "MATERIAL_RECEIVED" });
      } else {
        if (project.installedAt) return;
        await tx.project.update({
          where: { id: data.projectId },
          data: { installedAt: new Date(), installationNotes: data.notes ?? null },
        });
        await recordEvent(tx, fx, data.projectId, user.id, { type: "INSTALLED" });
        await notifyAdmins(tx, fx, data.projectId, {
          titleEn: "Installation complete",
          titleHi: "इंस्टॉलेशन पूरा हुआ",
          bodyEn: `${user.name} marked the plant as installed.`,
          bodyHi: `${user.name} ने प्लांट लगाने का काम पूरा किया।`,
          href: `/admin/projects/${data.projectId}`,
        });
      }
      await advanceIfReady(tx, fx, data.projectId, user.id);
    });
    revalidatePath(`/worker/jobs/${data.projectId}`);
  });
}
