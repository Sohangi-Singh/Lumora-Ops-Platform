import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { toActionError } from "@/lib/result";
import { BUCKETS, signedReadUrl } from "@/lib/storage";

/** Admin view of the customer's uploaded transfer receipt. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireRole("ADMIN");
    const p = await db.payment.findUnique({ where: { id }, select: { receiptPath: true } });
    if (!p?.receiptPath) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.redirect(await signedReadUrl(BUCKETS.documents, p.receiptPath), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const e = toActionError(err);
    return NextResponse.json({ error: e.code }, { status: e.code === "UNAUTHENTICATED" ? 401 : 403 });
  }
}
