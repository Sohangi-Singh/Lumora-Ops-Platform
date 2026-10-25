import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import hi from "@/messages/hi.json";
import { canAccessProject, canSeePricing, canViewDocument } from "@/lib/authz/rules";
import { formatDateDMY, formatINR, formatOrdinalDate, maskAadhaar, normalizeIndianMobile } from "@/lib/format";
import { rupeesToPaise, verifyPaymentSignature, verifyWebhookSignature } from "@/lib/payments/signature";
import { fiscalYearOf, formatRefNo, parseRefNo } from "@/lib/solar/refNo";
import { sniffFileType } from "@/lib/storage/magic";
import { createHmac } from "node:crypto";

describe("quote reference numbers", () => {
  it("formats like the sample: 0241/RPR/10/2026-2027", () => {
    expect(formatRefNo(241, "RPR", new Date("2026-10-19T05:00:00Z"))).toBe("0241/RPR/10/2026-2027");
  });

  it("rolls the financial year over on 1 April (IST)", () => {
    expect(fiscalYearOf(new Date("2027-03-31T18:00:00Z"))).toBe("2026-2027"); // 31 Mar 23:30 IST
    expect(fiscalYearOf(new Date("2027-03-31T18:31:00Z"))).toBe("2027-2028"); // 1 Apr 00:01 IST
    expect(formatRefNo(1, "DEL", new Date("2027-04-01T04:00:00Z"))).toBe("0001/DEL/04/2027-2028");
    expect(fiscalYearOf(new Date("2027-01-15T00:00:00Z"))).toBe("2026-2027");
  });

  it("rejects bad input and round-trips", () => {
    expect(() => formatRefNo(0, "RPR", new Date())).toThrow();
    expect(() => formatRefNo(1, "raipur", new Date())).toThrow();
    expect(parseRefNo("0241/RPR/10/2026-2027")).toEqual({ serial: 241, cityCode: "RPR", month: 10, fiscalYear: "2026-2027" });
    expect(parseRefNo("0241/RPR/10/2026-2028")).toBeNull();
  });
});

describe("Razorpay signatures", () => {
  const secret = "test_secret_123";

  it("verifies checkout signatures (order_id|payment_id)", () => {
    const signature = createHmac("sha256", secret).update("order_ABC|pay_XYZ").digest("hex");
    expect(verifyPaymentSignature({ orderId: "order_ABC", paymentId: "pay_XYZ", signature, secret })).toBe(true);
    expect(verifyPaymentSignature({ orderId: "order_ABC", paymentId: "pay_OTHER", signature, secret })).toBe(false);
    expect(verifyPaymentSignature({ orderId: "order_ABC", paymentId: "pay_XYZ", signature: "nothex!", secret })).toBe(false);
    expect(verifyPaymentSignature({ orderId: "order_ABC", paymentId: "pay_XYZ", signature: signature.slice(2), secret })).toBe(false);
  });

  it("verifies webhook signatures over the raw body", () => {
    const body = JSON.stringify({ event: "payment.captured", payload: {} });
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyWebhookSignature(body, sig, secret)).toBe(true);
    expect(verifyWebhookSignature(body + " ", sig, secret)).toBe(false);
    expect(verifyWebhookSignature(body, sig, "wrong")).toBe(false);
  });

  it("converts rupees to paise", () => {
    expect(rupeesToPaise(315900)).toBe(31590000);
  });
});

describe("magic-byte sniffing", () => {
  const bytes = (...b: number[]) => new Uint8Array(b);
  const str = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
  it("detects real types regardless of file name", () => {
    expect(sniffFileType(str("%PDF-1.7\n"))).toBe("application/pdf");
    expect(sniffFileType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffFileType(new Uint8Array([0, 0, 0, 0x18, ...str("ftypheic")]))).toBe("image/heic");
    expect(sniffFileType(str("MZ\x90\x00 executable"))).toBeNull();
    expect(sniffFileType(str("<html>"))).toBeNull();
  });
});

describe("formatting", () => {
  it("Indian currency and dates", () => {
    expect(formatINR(351000)).toBe("₹3,51,000");
    expect(formatDateDMY(new Date("2026-10-19T05:00:00Z"))).toBe("19/10/2026");
    expect(formatOrdinalDate(new Date("2026-10-25T05:00:00Z"))).toBe("25th October 2026");
    expect(formatOrdinalDate(new Date("2026-10-22T05:00:00Z"))).toBe("22nd October 2026");
    expect(formatOrdinalDate(new Date("2026-10-11T05:00:00Z"))).toBe("11th October 2026");
  });

  it("masks Aadhaar and normalises mobiles", () => {
    expect(maskAadhaar("1234 5678 9012")).toBe("XXXX XXXX 9012");
    expect(normalizeIndianMobile("+91 98765-43210")).toBe("9876543210");
  });
});

describe("authorization rules", () => {
  const project = { id: "p1", customerId: "c1", customerUserId: "u-cust", assignedWorkerId: "u-work" };
  it("admins see everything; workers only assigned; customers only own", () => {
    expect(canAccessProject({ id: "u-admin", role: "ADMIN" }, project)).toBe(true);
    expect(canAccessProject({ id: "u-work", role: "WORKER" }, project)).toBe(true);
    expect(canAccessProject({ id: "u-other", role: "WORKER" }, project)).toBe(false);
    expect(canAccessProject({ id: "u-work", role: "WORKER" }, { ...project, assignedWorkerId: null })).toBe(false);
    expect(canAccessProject({ id: "u-cust", role: "CUSTOMER" }, project)).toBe(true);
    expect(canAccessProject({ id: "u-other", role: "CUSTOMER" }, project)).toBe(false);
  });

  it("workers never see KYC documents or pricing", () => {
    expect(canViewDocument({ role: "WORKER" }, "AADHAAR")).toBe(false);
    expect(canViewDocument({ role: "WORKER" }, "PAN")).toBe(false);
    expect(canViewDocument({ role: "CUSTOMER" }, "PAN")).toBe(true);
    expect(canSeePricing({ role: "WORKER" })).toBe(false);
    expect(canSeePricing({ role: "CUSTOMER" })).toBe(true);
  });
});

describe("i18n", () => {
  const keys = (obj: object, prefix = ""): string[] =>
    Object.entries(obj).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
  it("English and Hindi have exactly the same keys", () => {
    expect(keys(hi).sort()).toEqual(keys(en).sort());
  });
});
