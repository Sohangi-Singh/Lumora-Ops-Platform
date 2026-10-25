"use client";

import { formatDateTime } from "@/lib/format";

export type GeoFix = { lat: number; lng: number; accuracy: number; at: Date };

export type GeoError = "denied" | "unavailable";

/** Best-effort high-accuracy fix: watches for up to `ms` and keeps the most accurate reading. */
export function getBestPosition(ms = 12_000): Promise<GeoFix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return reject("unavailable" satisfies GeoError);
    let best: GeolocationPosition | null = null;
    const finish = () => {
      navigator.geolocation.clearWatch(id);
      clearTimeout(timer);
      if (best) resolve({ lat: best.coords.latitude, lng: best.coords.longitude, accuracy: best.coords.accuracy, at: new Date(best.timestamp) });
      else reject("unavailable" satisfies GeoError);
    };
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos;
        if (pos.coords.accuracy <= 15) finish();
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          navigator.geolocation.clearWatch(id);
          clearTimeout(timer);
          reject("denied" satisfies GeoError);
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: ms },
    );
    const timer = setTimeout(finish, ms);
  });
}

/**
 * Re-encode the photo (honouring EXIF orientation), downscale it, and burn a
 * visible caption with coordinates, accuracy and IST time into the pixels —
 * the stamp survives even if EXIF metadata is stripped later.
 */
export async function stampPhoto(file: File, fix: GeoFix | null, label: string): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const maxSide = 2000;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const lines = fix
    ? [
        `Lat ${fix.lat.toFixed(6)}, Lng ${fix.lng.toFixed(6)}  ±${Math.round(fix.accuracy)} m`,
        `${formatDateTime(fix.at, "en")} IST · ${label}`,
      ]
    : [`${formatDateTime(new Date(), "en")} IST · ${label}`];
  const font = Math.max(16, Math.round(w / 45));
  const pad = Math.round(font * 0.6);
  const barH = lines.length * (font + pad) + pad;
  ctx.fillStyle = "rgba(27, 38, 59, 0.78)";
  ctx.fillRect(0, h - barH, w, barH);
  ctx.fillStyle = "#C6A75E";
  ctx.fillRect(0, h - barH, w, Math.max(2, Math.round(font / 8)));
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${font}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = "top";
  lines.forEach((line, i) => ctx.fillText(line, pad, h - barH + pad + i * (font + pad)));

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.85));
}
