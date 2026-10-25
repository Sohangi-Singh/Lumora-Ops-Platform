"use client";

/**
 * Browser → Supabase Storage upload through a one-time signed URL, with a real
 * progress callback (XHR) and retry-with-backoff that waits for the network to
 * come back — field workers often lose signal on rooftops.
 */

export const ACCEPTED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const ACCEPT_ATTR = "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
export const MAX_BYTES = 10 * 1024 * 1024;

export function effectiveMime(file: File): string {
  if (file.type) return file.type === "image/heif" ? "image/heic" : file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "heic" || ext === "heif") return "image/heic";
  if (ext === "pdf") return "application/pdf";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  return "application/octet-stream";
}

/** Shrink large photos before upload; PDFs and HEIC pass through untouched. */
export async function compressIfImage(file: File): Promise<File> {
  const mime = effectiveMime(file);
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime) || file.size < 1.2 * 1024 * 1024) return file;
  try {
    const { default: imageCompression } = await import("browser-image-compression");
    const out = await imageCompression(file, { maxSizeMB: 1.2, maxWidthOrHeight: 2400, useWebWorker: true, initialQuality: 0.85 });
    return new File([out], file.name.replace(/\.(png|webp)$/i, ".jpg"), { type: out.type || "image/jpeg" });
  } catch {
    return file;
  }
}

function signedUploadUrl(bucket: string, path: string, token: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error("Supabase is not configured");
  return `${base}/storage/v1/object/upload/sign/${bucket}/${path}?token=${encodeURIComponent(token)}`;
}

function putOnce(url: string, file: Blob, contentType: string, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", contentType);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anon) xhr.setRequestHeader("apikey", anon);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new UploadHttpError(xhr.status, xhr.responseText)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.timeout = 120_000;
    xhr.send(file);
  });
}

export class UploadHttpError extends Error {
  constructor(
    readonly status: number,
    body: string,
  ) {
    super(`Upload failed (${status}): ${body.slice(0, 200)}`);
  }
}

function waitForOnline(): Promise<void> {
  if (typeof navigator === "undefined" || navigator.onLine) return Promise.resolve();
  return new Promise((resolve) => window.addEventListener("online", () => resolve(), { once: true }));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function uploadWithRetry(args: {
  bucket: string;
  path: string;
  token: string;
  file: Blob;
  contentType: string;
  onProgress: (pct: number) => void;
  onRetry?: (attempt: number) => void;
  attempts?: number;
}): Promise<void> {
  const url = signedUploadUrl(args.bucket, args.path, args.token);
  const attempts = args.attempts ?? 4;
  for (let i = 0; i < attempts; i++) {
    try {
      await waitForOnline();
      await putOnce(url, args.file, args.contentType, args.onProgress);
      return;
    } catch (err) {
      // 4xx other than 408/429 won't get better by retrying (e.g. expired token, duplicate path).
      if (err instanceof UploadHttpError && err.status >= 400 && err.status < 500 && ![408, 429].includes(err.status)) {
        if (err.status === 409) return; // already uploaded on a previous attempt
        throw err;
      }
      if (i === attempts - 1) throw err;
      args.onRetry?.(i + 1);
      await sleep(1000 * 2 ** i);
    }
  }
}
