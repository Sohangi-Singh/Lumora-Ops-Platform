import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { claimWebhookEvent, markRazorpayFailed, markRazorpayPaid } from "@/lib/payments/service";
import { verifyWebhookSignature } from "@/lib/payments/signature";

const EventSchema = z.object({
  event: z.string(),
  payload: z.object({
    payment: z.object({
      entity: z.object({
        id: z.string(),
        order_id: z.string().nullable().optional(),
        error_description: z.string().nullable().optional(),
      }),
    }),
  }),
});

/**
 * Razorpay webhook: signature over the raw body, idempotent per
 * (event, payment id), handles payment.captured and payment.failed.
 * Always 2xx once the signature is valid so Razorpay stops retrying.
 */
export async function POST(request: Request) {
  const secret = env.razorpay.webhookSecret;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!verifyWebhookSignature(raw, signature, secret)) return NextResponse.json({ error: "invalid signature" }, { status: 400 });

  const parsed = EventSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) return NextResponse.json({ ignored: true });
  const { event, payload } = parsed.data;
  const p = payload.payment.entity;
  if (!p.order_id) return NextResponse.json({ ignored: true });

  const key = `${event}:${p.id}`;
  if (!(await claimWebhookEvent(key, event))) return NextResponse.json({ duplicate: true });
  try {
    if (event === "payment.captured") await markRazorpayPaid(p.order_id, p.id, null);
    else if (event === "payment.failed") await markRazorpayFailed(p.order_id, p.error_description ?? "Payment failed");
  } catch (err) {
    // Release the claim so Razorpay's retry gets processed.
    await db.webhookEvent.delete({ where: { id: key } }).catch(() => undefined);
    console.error("[razorpay webhook]", err);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
