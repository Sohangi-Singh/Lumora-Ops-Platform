import { NextResponse, type NextRequest } from "next/server";
import { documentViewUrl } from "@/lib/actions/documents";
import { toActionError } from "@/lib/result";

/** Authorised, audited redirect to a 60-second signed URL. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const url = await documentViewUrl(id, { download: request.nextUrl.searchParams.get("download") === "1" });
    return NextResponse.redirect(url, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const e = toActionError(err);
    const status = e.code === "UNAUTHENTICATED" ? 401 : e.code === "FORBIDDEN" ? 403 : 404;
    return NextResponse.json({ error: e.code }, { status });
  }
}
