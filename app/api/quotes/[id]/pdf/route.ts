import { NextResponse, type NextRequest } from "next/server";
import { assertCanAccessProject, canSeePricing, requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { renderStoredQuote } from "@/lib/quotes/service";
import { toActionError } from "@/lib/result";
import { BUCKETS, signedReadUrl } from "@/lib/storage";

const CUSTOMER_VISIBLE = ["SENT", "APPROVED", "ACCEPTED", "EXPIRED"];

/** Signed-URL redirect to a quote PDF. Customers only ever see approved quotes. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await requireUser();
    if (!canSeePricing(user)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const quote = await db.quote.findUnique({ where: { id } });
    if (!quote) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    await assertCanAccessProject(user, quote.projectId);
    if (user.role === "CUSTOMER" && !CUSTOMER_VISIBLE.includes(quote.status)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    const download = request.nextUrl.searchParams.get("download") === "1" ? `Lumora-Quotation-${quote.refNo.replaceAll("/", "-")}.pdf` : undefined;
    if (quote.pdfPath) {
      try {
        return NextResponse.redirect(await signedReadUrl(BUCKETS.quotes, quote.pdfPath, { download }), { headers: { "Cache-Control": "no-store" } });
      } catch (err) {
        console.warn("[quote pdf] storage unavailable, rendering from snapshot", err instanceof Error ? err.message : err);
      }
    }
    // Fallback: re-render from the quote's stored snapshot (identical output).
    const pdf = await renderStoredQuote(quote, { draft: !CUSTOMER_VISIBLE.includes(quote.status) });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${download ?? "quotation.pdf"}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const e = toActionError(err);
    return NextResponse.json({ error: e.code }, { status: e.code === "UNAUTHENTICATED" ? 401 : e.code === "FORBIDDEN" ? 403 : 404 });
  }
}
