import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { createElement } from "react";
import { assertCanAccessProject, canSeePricing, requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { ReceiptDocument } from "@/lib/pdf/ReceiptDocument";
import { loadLetterhead } from "@/lib/pdf/render";
import { toActionError } from "@/lib/result";
import { getSettings } from "@/lib/settings";
import { MILESTONE_LABELS } from "@/lib/workflow/labels";

/** Receipt PDF for a settled payment, rendered on demand. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await requireUser();
    if (!canSeePricing(user)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const p = await db.payment.findUnique({
      where: { id },
      include: { quote: { select: { refNo: true } }, project: { select: { customer: { include: { user: { select: { name: true } } } } } } },
    });
    if (!p || (p.status !== "PAID" && p.status !== "VERIFIED")) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    await assertCanAccessProject(user, p.projectId);
    const c = p.project.customer;
    const element = createElement(ReceiptDocument, {
      receiptNo: `LS-${p.quote.refNo.split("/")[0]}-${p.milestone === "ADVANCE" ? "A" : "B"}-${p.id.slice(-6).toUpperCase()}`,
      date: p.verifiedAt ?? p.paidAt ?? p.createdAt,
      customer: { salutation: c.salutation, name: c.user.name, address: [c.addressLine1, c.addressLine2, c.city, c.state, c.pincode].filter(Boolean).join(", ") },
      quoteRef: p.quote.refNo,
      milestoneLabel: `${MILESTONE_LABELS[p.milestone].en} payment`,
      amount: p.amount,
      method: p.method === "RAZORPAY" ? "Online (Razorpay)" : p.method === "LOAN" ? "Loan disbursement" : "Bank transfer",
      reference: p.razorpayPaymentId ?? p.utr ?? "—",
      settings: await getSettings(),
      letterhead: await loadLetterhead(),
    });
    const pdf = await renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="Lumora-Receipt-${p.id.slice(-6)}.pdf"`, "Cache-Control": "no-store" },
    });
  } catch (err) {
    const e = toActionError(err);
    return NextResponse.json({ error: e.code }, { status: e.code === "UNAUTHENTICATED" ? 401 : 404 });
  }
}
