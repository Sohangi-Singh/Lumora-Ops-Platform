"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertCanAccessProject, requireCustomerProject, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { createOrder, markRazorpayFailed, markRazorpayPaid, reviewOfflinePayment, submitOfflinePayment } from "@/lib/payments/service";
import { verifyPaymentSignature } from "@/lib/payments/signature";
import { rateLimit } from "@/lib/ratelimit";
import { runAction } from "@/lib/result";
import { assertUploadAllowed, BUCKETS, createSignedUpload, inspectUploadedObject, newObjectPath, removeObjects } from "@/lib/storage";
import { extensionFor, MAX_UPLOAD_BYTES, normalizeMime, type SniffedType } from "@/lib/storage/magic";

const Milestone = z.enum(["ADVANCE", "BALANCE"]);

export async function createOrderAction(milestone: z.input<typeof Milestone>) {
  return runAction(async () => {
    const user = await requireRole("CUSTOMER");
    const projectId = await requireCustomerProject(user);
    await rateLimit(`order:${user.id}`, 10, 60);
    const order = await createOrder(projectId, Milestone.parse(milestone), user.id);
    return {
      ...order,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? env.razorpay.keyId ?? "",
      prefill: { name: user.name, email: user.email, contact: user.phone ?? "" },
    };
  });
}

const VerifySchema = z.object({ orderId: z.string().min(1), paymentId: z.string().min(1), signature: z.string().min(1) });

/** Checkout success handler: signature verified server-side before anything is marked paid. */
export async function verifyCheckoutAction(input: z.input<typeof VerifySchema>) {
  return runAction(async () => {
    const user = await requireRole("CUSTOMER");
    const data = VerifySchema.parse(input);
    const payment = await db.payment.findUnique({ where: { razorpayOrderId: data.orderId }, select: { projectId: true } });
    if (!payment) throw new AppError("NOT_FOUND");
    await assertCanAccessProject(user, payment.projectId);
    const secret = env.razorpay.keySecret;
    if (!secret) throw new AppError("NOT_CONFIGURED");
    if (!verifyPaymentSignature({ orderId: data.orderId, paymentId: data.paymentId, signature: data.signature, secret })) {
      throw new AppError("PAYMENT_FAILED", "Payment signature mismatch");
    }
    const result = await markRazorpayPaid(data.orderId, data.paymentId, user.id);
    revalidatePath("/portal", "layout");
    return { result };
  });
}

export async function reportCheckoutFailureAction(input: { orderId: string; reason: string }) {
  return runAction(async () => {
    const user = await requireRole("CUSTOMER");
    const payment = await db.payment.findUnique({ where: { razorpayOrderId: z.string().min(1).parse(input.orderId) }, select: { projectId: true } });
    if (!payment) return;
    await assertCanAccessProject(user, payment.projectId);
    await markRazorpayFailed(input.orderId, z.string().max(300).parse(input.reason));
  });
}

const RECEIPT_TYPES: SniffedType[] = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];

export async function requestReceiptUploadAction(input: { mimeType: string; size: number }) {
  return runAction(async () => {
    const user = await requireRole("CUSTOMER");
    const projectId = await requireCustomerProject(user);
    await rateLimit(`upload:${user.id}`, 40, 600);
    const size = z.number().int().positive().max(MAX_UPLOAD_BYTES).parse(input.size);
    assertUploadAllowed(input.mimeType, size, RECEIPT_TYPES);
    const mime = normalizeMime(input.mimeType) as SniffedType;
    const path = newObjectPath(projectId, "payments", extensionFor(mime));
    const signed = await createSignedUpload(BUCKETS.documents, path);
    return { path, token: signed.token, bucket: BUCKETS.documents };
  });
}

const OfflineSchema = z.object({
  milestone: Milestone,
  method: z.enum(["BANK_TRANSFER", "LOAN"]),
  utr: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{8,22}$/, "Enter a valid UTR / reference number"),
  receiptPath: z.string().max(300).nullable(),
});

export async function submitOfflinePaymentAction(input: z.input<typeof OfflineSchema>) {
  return runAction(async () => {
    const user = await requireRole("CUSTOMER");
    const projectId = await requireCustomerProject(user);
    const data = OfflineSchema.parse(input);
    await rateLimit(`offline:${user.id}`, 5, 600);
    if (data.receiptPath) {
      if (!data.receiptPath.startsWith(`projects/${projectId}/payments/`)) throw new AppError("FORBIDDEN");
      const inspected = await inspectUploadedObject(BUCKETS.documents, data.receiptPath);
      if (!inspected.type || inspected.size > MAX_UPLOAD_BYTES) {
        await removeObjects(BUCKETS.documents, [data.receiptPath]);
        throw new AppError("FILE_CONTENT_MISMATCH");
      }
    }
    await submitOfflinePayment({ projectId, ...data, userId: user.id });
    revalidatePath("/portal/payments");
  });
}

const ReviewSchema = z.object({ paymentId: z.string().min(1), decision: z.enum(["VERIFY", "REJECT"]), reason: z.string().trim().max(300).optional() });

export async function reviewOfflinePaymentAction(input: z.input<typeof ReviewSchema>) {
  return runAction(async () => {
    const admin = await requireRole("ADMIN");
    const data = ReviewSchema.parse(input);
    await reviewOfflinePayment(data.paymentId, admin.id, data.decision, data.reason);
    revalidatePath("/admin", "layout");
  });
}

const RecordSchema = z.object({ projectId: z.string().min(1), milestone: Milestone, method: z.enum(["BANK_TRANSFER", "LOAN"]), utr: OfflineSchema.shape.utr });

/** Admin records a payment received outside the portal (immediately verified). */
export async function recordOfflinePaymentAction(input: z.input<typeof RecordSchema>) {
  return runAction(async () => {
    const admin = await requireRole("ADMIN");
    const data = RecordSchema.parse(input);
    await submitOfflinePayment({ ...data, receiptPath: null, userId: admin.id });
    const created = await db.payment.findFirstOrThrow({ where: { projectId: data.projectId, utr: data.utr, status: "PENDING_VERIFICATION" } });
    await reviewOfflinePayment(created.id, admin.id, "VERIFY");
    revalidatePath(`/admin/projects/${data.projectId}`);
  });
}
