import "server-only";
import type { Payment, PaymentMilestone, Prisma } from "@prisma/client";
import Razorpay from "razorpay";
import { db, type Tx } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { formatINR } from "@/lib/format";
import type { PricingResult } from "@/lib/solar/pricing";
import type { Effects } from "@/lib/workflow/effects";
import { MILESTONE_LABELS } from "@/lib/workflow/labels";
import { advanceIfReady, notifyAdmins, notifyCustomer, recordEvent, withWorkflow } from "@/lib/workflow/service";
import { rupeesToPaise } from "./signature";

/**
 * Payments: two milestones (90% advance, 10% balance) per accepted quote.
 * Invariants enforced here, not in the UI:
 *  - a milestone is payable only at the right stage;
 *  - at most one settled (PAID/VERIFIED) or pending payment per milestone;
 *  - capture is idempotent whether it arrives via Checkout handler or webhook.
 */

const SETTLED = ["PAID", "VERIFIED"] as const;

let client: Razorpay | undefined;
export function razorpay(): Razorpay {
  if (!env.razorpay.enabled) throw new AppError("NOT_CONFIGURED", "Razorpay keys are not set");
  client ??= new Razorpay({ key_id: env.razorpay.keyId!, key_secret: env.razorpay.keySecret! });
  return client;
}

export type MilestoneState = {
  milestone: PaymentMilestone;
  amount: number;
  payable: boolean;
  settled: Payment | null;
  pending: Payment | null;
  open: Payment | null;
};

/** Amounts come from the accepted quote's snapshot, never from the client. */
export async function getMilestones(projectId: string): Promise<{ quote: { id: string; refNo: string; total: number } | null; milestones: MilestoneState[] }> {
  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    select: {
      stage: true,
      netMeteringFiledAt: true,
      quotes: { where: { status: "ACCEPTED" }, take: 1, select: { id: true, refNo: true, totalInclGst: true, computed: true } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
  const quote = project.quotes[0];
  if (!quote) return { quote: null, milestones: [] };
  const pricing = (quote.computed as unknown as { pricing: PricingResult }).pricing;
  const stageOk: Record<PaymentMilestone, boolean> = {
    ADVANCE: project.stage === "ADVANCE_PAYMENT",
    BALANCE: project.stage === "NET_METERING" && Boolean(project.netMeteringFiledAt),
  };
  const milestones = (["ADVANCE", "BALANCE"] as const).map((m) => {
    const mine = project.payments.filter((p) => p.milestone === m && p.quoteId === quote.id);
    const settled = mine.find((p) => (SETTLED as readonly string[]).includes(p.status)) ?? null;
    const pending = mine.find((p) => p.status === "PENDING_VERIFICATION") ?? null;
    const open = mine.find((p) => p.status === "CREATED" && p.method === "RAZORPAY") ?? null;
    return {
      milestone: m,
      amount: m === "ADVANCE" ? pricing.advanceAmount : pricing.balanceAmount,
      payable: stageOk[m] && !settled && !pending,
      settled,
      pending,
      open,
    };
  });
  return { quote: { id: quote.id, refNo: quote.refNo, total: quote.totalInclGst }, milestones };
}

/** Create (or reuse) a Razorpay order for a milestone. Reuse prevents duplicate orders from double clicks/tabs. */
export async function createOrder(projectId: string, milestone: PaymentMilestone, userId: string) {
  const { quote, milestones } = await getMilestones(projectId);
  const m = milestones.find((x) => x.milestone === milestone);
  if (!quote || !m) throw new AppError("INVALID_TRANSITION", "No accepted quotation");
  if (m.settled) throw new AppError("ALREADY_PAID");
  if (m.pending) throw new AppError("CONFLICT", "A payment for this milestone is already being verified");
  if (!m.payable) throw new AppError("INVALID_TRANSITION", "This payment is not due yet");
  if (m.open && m.open.amount === m.amount && m.open.razorpayOrderId) {
    return { orderId: m.open.razorpayOrderId, amount: m.amount, paymentId: m.open.id };
  }
  const order = await razorpay().orders.create({
    amount: rupeesToPaise(m.amount),
    currency: "INR",
    receipt: `${quote.refNo}-${milestone}`.slice(0, 40),
    notes: { projectId, milestone, quoteId: quote.id },
  });
  const payment = await db.payment.create({
    data: { projectId, quoteId: quote.id, milestone, amount: m.amount, method: "RAZORPAY", status: "CREATED", razorpayOrderId: order.id, createdById: userId },
  });
  return { orderId: order.id, amount: m.amount, paymentId: payment.id };
}

async function settle(tx: Tx, fx: Effects, payment: Payment, actorId: string | null, method: string) {
  await recordEvent(tx, fx, payment.projectId, actorId, { type: "PAYMENT_RECEIVED", milestone: payment.milestone, amount: payment.amount, method });
  const label = MILESTONE_LABELS[payment.milestone];
  await notifyCustomer(tx, fx, payment.projectId, {
    titleEn: "Payment received",
    titleHi: "भुगतान मिल गया",
    bodyEn: `${label.en} of ${formatINR(payment.amount)} received. Thank you!`,
    bodyHi: `${label.hi} ${formatINR(payment.amount)} मिल गया। धन्यवाद!`,
    href: "/portal/payments",
  });
  await notifyAdmins(tx, fx, payment.projectId, {
    titleEn: `${label.en} received`,
    titleHi: `${label.hi} प्राप्त`,
    bodyEn: `${formatINR(payment.amount)} via ${method}.`,
    bodyHi: `${formatINR(payment.amount)} (${method})`,
    href: `/admin/projects/${payment.projectId}?tab=payments`,
  });
  await advanceIfReady(tx, fx, payment.projectId, actorId);
}

/**
 * Mark a Razorpay order paid. Safe to call twice (Checkout handler + webhook):
 * the conditional update only succeeds once.
 */
export async function markRazorpayPaid(orderId: string, razorpayPaymentId: string, actorId: string | null): Promise<"paid" | "already" | "unknown"> {
  return withWorkflow(async (tx, fx) => {
    const payment = await tx.payment.findUnique({ where: { razorpayOrderId: orderId } });
    if (!payment) return "unknown";
    if (payment.status === "PAID") return "already";
    const other = await tx.payment.findFirst({
      where: { projectId: payment.projectId, milestone: payment.milestone, quoteId: payment.quoteId, status: { in: [...SETTLED] }, id: { not: payment.id } },
    });
    const r = await tx.payment.updateMany({
      where: { id: payment.id, status: { in: ["CREATED", "FAILED"] } },
      data: { status: "PAID", razorpayPaymentId, paidAt: new Date(), failureReason: other ? "Duplicate payment for an already settled milestone — refund required" : null },
    });
    if (r.count !== 1) return "already";
    if (other) {
      // Money arrived twice for one milestone: don't advance again, flag for a refund.
      await notifyAdmins(tx, fx, payment.projectId, {
        titleEn: "Duplicate payment received",
        titleHi: "दोहरा भुगतान मिला",
        bodyEn: `Razorpay payment ${razorpayPaymentId} duplicates a settled ${payment.milestone.toLowerCase()} payment. Please refund.`,
        bodyHi: `भुगतान ${razorpayPaymentId} दोहरा है। कृपया रिफ़ंड करें।`,
        href: `/admin/projects/${payment.projectId}?tab=payments`,
      });
      return "paid";
    }
    await settle(tx, fx, { ...payment, status: "PAID" }, actorId, "Razorpay");
    return "paid";
  });
}

export async function markRazorpayFailed(orderId: string, reason: string): Promise<void> {
  await withWorkflow(async (tx, fx) => {
    const payment = await tx.payment.findUnique({ where: { razorpayOrderId: orderId } });
    if (!payment) return;
    const r = await tx.payment.updateMany({ where: { id: payment.id, status: "CREATED" }, data: { status: "FAILED", failureReason: reason.slice(0, 300) } });
    if (r.count) await recordEvent(tx, fx, payment.projectId, null, { type: "PAYMENT_FAILED", milestone: payment.milestone, reason: reason.slice(0, 120) });
  });
}

/** Idempotency key store for webhooks: returns false if this event was already processed. */
export async function claimWebhookEvent(id: string, type: string): Promise<boolean> {
  try {
    await db.webhookEvent.create({ data: { id, type } });
    return true;
  } catch (err) {
    if ((err as Prisma.PrismaClientKnownRequestError).code === "P2002") return false;
    throw err;
  }
}

export async function submitOfflinePayment(args: {
  projectId: string;
  milestone: PaymentMilestone;
  method: "BANK_TRANSFER" | "LOAN";
  utr: string;
  receiptPath: string | null;
  userId: string;
}) {
  const { quote, milestones } = await getMilestones(args.projectId);
  const m = milestones.find((x) => x.milestone === args.milestone);
  if (!quote || !m) throw new AppError("INVALID_TRANSITION", "No accepted quotation");
  if (m.settled) throw new AppError("ALREADY_PAID");
  if (m.pending) throw new AppError("CONFLICT", "A payment for this milestone is already being verified");
  if (!m.payable) throw new AppError("INVALID_TRANSITION", "This payment is not due yet");
  const dupUtr = await db.payment.findFirst({ where: { utr: args.utr, status: { in: ["PENDING_VERIFICATION", "VERIFIED"] } } });
  if (dupUtr) throw new AppError("CONFLICT", "This UTR has already been submitted");

  await withWorkflow(async (tx, fx) => {
    await tx.payment.create({
      data: {
        projectId: args.projectId,
        quoteId: quote.id,
        milestone: args.milestone,
        amount: m.amount,
        method: args.method,
        status: "PENDING_VERIFICATION",
        utr: args.utr,
        receiptPath: args.receiptPath,
        createdById: args.userId,
      },
    });
    await recordEvent(tx, fx, args.projectId, args.userId, { type: "PAYMENT_SUBMITTED", milestone: args.milestone, amount: m.amount, utr: args.utr });
    await notifyAdmins(tx, fx, args.projectId, {
      titleEn: "Payment to verify",
      titleHi: "भुगतान की जाँच करें",
      bodyEn: `${MILESTONE_LABELS[args.milestone].en} ${formatINR(m.amount)} · UTR ${args.utr}`,
      bodyHi: `${MILESTONE_LABELS[args.milestone].hi} ${formatINR(m.amount)} · UTR ${args.utr}`,
      href: `/admin/projects/${args.projectId}?tab=payments`,
    });
  });
}

export async function reviewOfflinePayment(paymentId: string, adminId: string, decision: "VERIFY" | "REJECT", reason?: string) {
  await withWorkflow(async (tx, fx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new AppError("NOT_FOUND");
    if (payment.status !== "PENDING_VERIFICATION") throw new AppError("CONFLICT", "Payment is not awaiting verification");
    if (decision === "VERIFY") {
      await tx.payment.update({ where: { id: paymentId }, data: { status: "VERIFIED", verifiedById: adminId, verifiedAt: new Date() } });
      await recordEvent(tx, fx, payment.projectId, adminId, { type: "PAYMENT_VERIFIED", milestone: payment.milestone, amount: payment.amount });
      await settle(tx, fx, { ...payment, status: "VERIFIED" }, adminId, payment.method === "LOAN" ? "loan" : "bank transfer");
    } else {
      const why = (reason ?? "").trim() || "Could not match the transfer";
      await tx.payment.update({ where: { id: paymentId }, data: { status: "REJECTED", failureReason: why, verifiedById: adminId, verifiedAt: new Date() } });
      await recordEvent(tx, fx, payment.projectId, adminId, { type: "PAYMENT_REJECTED", milestone: payment.milestone, reason: why });
      await notifyCustomer(tx, fx, payment.projectId, {
        titleEn: "Payment could not be verified",
        titleHi: "भुगतान की पुष्टि नहीं हो सकी",
        bodyEn: why,
        bodyHi: why,
        href: "/portal/payments",
      });
    }
  });
}
