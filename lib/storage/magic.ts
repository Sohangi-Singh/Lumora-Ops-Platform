/**
 * File type detection from content ("magic bytes"), never from the name or
 * the browser-reported MIME type, so a renamed .exe can't pass as a PDF.
 */
export type SniffedType = "application/pdf" | "image/jpeg" | "image/png" | "image/heic" | "image/webp";

export const ALLOWED_UPLOAD_TYPES: readonly SniffedType[] = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/webp"];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ascii = (bytes: Uint8Array, start: number, len: number) => String.fromCharCode(...bytes.slice(start, start + len));

export function sniffFileType(bytes: Uint8Array): SniffedType | null {
  if (bytes.length >= 5 && ascii(bytes, 0, 5) === "%PDF-") return "application/pdf";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return "image/png";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "image/webp";
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand)) return "image/heic";
  }
  return null;
}

/** The browser may report image/jpg, image/heif etc. — normalise before comparing. */
export function normalizeMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m === "image/jpg" || m === "image/pjpeg") return "image/jpeg";
  if (m === "image/heif") return "image/heic";
  return m;
}

export function extensionFor(type: SniffedType): string {
  return { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "image/webp": "webp" }[type];
}
