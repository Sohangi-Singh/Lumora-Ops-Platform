import { NextResponse } from "next/server";
import { assertCanAccessProject, requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { toActionError } from "@/lib/result";
import { BUCKETS, signedReadUrl } from "@/lib/storage";

/** Authorised redirect to a short-lived signed URL for a project photo. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await requireUser();
    const photo = await db.photo.findUnique({ where: { id }, select: { projectId: true, storagePath: true, uploaded: true } });
    if (!photo?.uploaded) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    await assertCanAccessProject(user, photo.projectId);
    return NextResponse.redirect(await signedReadUrl(BUCKETS.photos, photo.storagePath, { ttl: 300 }), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const e = toActionError(err);
    return NextResponse.json({ error: e.code }, { status: e.code === "UNAUTHENTICATED" ? 401 : e.code === "FORBIDDEN" ? 403 : 404 });
  }
}
