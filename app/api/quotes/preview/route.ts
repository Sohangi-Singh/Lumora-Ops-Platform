import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { renderPreview } from "@/lib/quotes/service";
import { toActionError } from "@/lib/result";

const Query = z.object({
  projectId: z.string().min(1),
  kw: z.coerce.number().positive().max(100).optional(),
  phase: z.enum(["SINGLE", "THREE"]).optional(),
  panels: z.coerce.number().int().positive().max(500).optional(),
});

/** Admin-only live preview of a quote with unsaved overrides (rendered, not stored). */
export async function GET(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const q = Query.parse(Object.fromEntries([...request.nextUrl.searchParams].filter(([, v]) => v !== "")));
    const pdf = await renderPreview(q.projectId, { systemKw: q.kw ?? null, phase: q.phase ?? null, panelCount: q.panels ?? null });
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=preview.pdf", "Cache-Control": "no-store" },
    });
  } catch (err) {
    const e = toActionError(err);
    return NextResponse.json({ error: e.code, message: e.message }, { status: e.code === "UNAUTHENTICATED" ? 401 : e.code === "FORBIDDEN" ? 403 : 400 });
  }
}
