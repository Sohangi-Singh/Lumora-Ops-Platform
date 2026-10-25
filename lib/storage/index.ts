import "server-only";
import { createId } from "@paralleldrive/cuid2";
import { AppError } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, normalizeMime, sniffFileType, type SniffedType } from "./magic";

/**
 * All files live in PRIVATE buckets. Browsers upload directly with a one-time
 * signed upload URL (bypasses the 4.5 MB serverless body limit) and read via
 * 60-second signed URLs issued only after an authz check.
 */
export const BUCKETS = {
  documents: "project-documents",
  photos: "project-photos",
  quotes: "quotes",
} as const;
export type Bucket = (typeof BUCKETS)[keyof typeof BUCKETS];

export const SIGNED_URL_TTL_SECONDS = 60;

export function newObjectPath(projectId: string, folder: string, ext: string): string {
  return `projects/${projectId}/${folder}/${createId()}.${ext}`;
}

export function assertUploadAllowed(mimeType: string, size: number, allowed: readonly SniffedType[] = ALLOWED_UPLOAD_TYPES) {
  if (size <= 0 || size > MAX_UPLOAD_BYTES) throw new AppError("FILE_TOO_LARGE");
  if (!allowed.includes(normalizeMime(mimeType) as SniffedType)) throw new AppError("FILE_TYPE");
}

export async function createSignedUpload(bucket: Bucket, path: string): Promise<{ path: string; token: string; signedUrl: string }> {
  const { data, error } = await supabaseAdmin().storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) throw new AppError("UPLOAD_FAILED", error?.message);
  return { path, token: data.token, signedUrl: data.signedUrl };
}

export async function signedReadUrl(bucket: Bucket, path: string, opts: { download?: string | boolean; ttl?: number } = {}): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .storage.from(bucket)
    .createSignedUrl(path, opts.ttl ?? SIGNED_URL_TTL_SECONDS, opts.download ? { download: opts.download } : undefined);
  if (error || !data) throw new AppError("NOT_FOUND", error?.message);
  return data.signedUrl;
}

/**
 * Verify an uploaded object by its content: fetch the first bytes with a
 * Range request, sniff the real type and read the true size.
 */
export async function inspectUploadedObject(bucket: Bucket, path: string): Promise<{ type: SniffedType | null; size: number }> {
  const url = await signedReadUrl(bucket, path, { ttl: 30 });
  const res = await fetch(url, { headers: { Range: "bytes=0-63" }, cache: "no-store" });
  if (!res.ok && res.status !== 206) throw new AppError("UPLOAD_FAILED", `Uploaded file not found (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer()).slice(0, 64);
  const range = res.headers.get("content-range");
  const size = range ? Number(range.split("/")[1]) : Number(res.headers.get("content-length") ?? bytes.length);
  return { type: sniffFileType(bytes), size };
}

export async function removeObjects(bucket: Bucket, paths: string[]): Promise<void> {
  if (!paths.length) return;
  const { error } = await supabaseAdmin().storage.from(bucket).remove(paths);
  if (error) console.warn("[storage] remove failed", error.message);
}

export async function uploadBuffer(bucket: Bucket, path: string, body: Buffer | Uint8Array, contentType: string): Promise<void> {
  const { error } = await supabaseAdmin().storage.from(bucket).upload(path, body, { contentType, upsert: true });
  if (error) throw new AppError("UPLOAD_FAILED", error.message);
}

export async function downloadObject(bucket: Bucket, path: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin().storage.from(bucket).download(path);
  if (error || !data) throw new AppError("NOT_FOUND", error?.message);
  return Buffer.from(await data.arrayBuffer());
}

/** Idempotently create the private buckets (run by the seed / setup script). */
export async function ensureBuckets(): Promise<void> {
  const client = supabaseAdmin();
  const { data } = await client.storage.listBuckets();
  const existing = new Set((data ?? []).map((b) => b.name));
  for (const name of Object.values(BUCKETS)) {
    if (existing.has(name)) {
      await client.storage.updateBucket(name, { public: false, fileSizeLimit: MAX_UPLOAD_BYTES });
    } else {
      const { error } = await client.storage.createBucket(name, { public: false, fileSizeLimit: MAX_UPLOAD_BYTES });
      if (error) throw new Error(`Could not create bucket ${name}: ${error.message}`);
    }
  }
}
