import { createHmac, timingSafeEqual } from "node:crypto";

function safeEqualHex(expected: string, received: string): boolean {
  if (!/^[0-9a-f]+$/i.test(received) || expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}

/** Checkout success handler: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyPaymentSignature(args: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret: string;
}): boolean {
  const expected = createHmac("sha256", args.secret).update(`${args.orderId}|${args.paymentId}`).digest("hex");
  return safeEqualHex(expected, args.signature);
}

/** Webhooks: HMAC_SHA256(raw request body, webhook_secret) in X-Razorpay-Signature. */
export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
