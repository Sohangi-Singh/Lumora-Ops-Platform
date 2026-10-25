"use client";

import { Camera, CheckCircle2, CloudOff, Loader2, MapPin, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getBestPosition, stampPhoto, type GeoFix, type GeoError } from "@/lib/client/geo-photo";
import type { QueuedPhotoKind } from "@/lib/client/offline-store";
import type { QueueItem } from "@/hooks/use-photo-queue";
import { cn } from "@/lib/utils";

export type ServerPhoto = { id: string; kind: string; lat: number | null; lng: number | null };

/**
 * Camera capture → (optional) GPS fix → caption burned into the image →
 * persistent upload queue. Shows uploaded photos and queued ones side by side.
 */
export function PhotoCapture({
  kind,
  label,
  geo,
  stampLabel,
  serverPhotos,
  queue,
  onEnqueue,
  onDiscardQueued,
  onDeleteServer,
  onFix,
  disabled,
}: {
  kind: QueuedPhotoKind;
  label: string;
  geo: boolean;
  stampLabel: string;
  serverPhotos: ServerPhoto[];
  queue: QueueItem[];
  onEnqueue: (kind: QueuedPhotoKind, blob: Blob, fix: GeoFix | null, caption: string | null) => Promise<void>;
  onDiscardQueued: (id: string) => Promise<void>;
  onDeleteServer?: (photoId: string) => Promise<void>;
  onFix?: (fix: GeoFix) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("survey");
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "locating" | "processing">("idle");
  const [geoError, setGeoError] = useState<GeoError | null>(null);
  const mine = queue.filter((q) => q.kind === kind);
  const uploaded = serverPhotos.filter((p) => p.kind === kind);

  async function handle(file: File | undefined) {
    if (!file) return;
    let fix: GeoFix | null = null;
    if (geo) {
      setState("locating");
      try {
        fix = await getBestPosition();
        setGeoError(null);
        onFix?.(fix);
      } catch (e) {
        setGeoError(e === "denied" ? "denied" : "unavailable");
        setState("idle");
        return;
      }
    }
    setState("processing");
    try {
      const blob = await stampPhoto(file, fix, stampLabel);
      const caption = fix ? `${fix.lat.toFixed(6)},${fix.lng.toFixed(6)} ±${Math.round(fix.accuracy)}m` : null;
      await onEnqueue(kind, blob, fix, caption);
    } catch {
      toast.error(t("uploadState.failed"));
    } finally {
      setState("idle");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-navy">{label}</span>
        <span className="text-xs text-muted-foreground">{t("photos", { n: uploaded.length + mine.length })}</span>
      </div>

      {uploaded.length + mine.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {uploaded.map((p) => (
            <figure key={p.id} className="group relative aspect-square overflow-hidden rounded-xl bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/photos/${p.id}`} alt={label} className="size-full object-cover" loading="lazy" />
              <span className="absolute top-1.5 left-1.5 rounded-full bg-success p-0.5 text-white">
                <CheckCircle2 className="size-3.5" aria-label={t("uploadState.done")} />
              </span>
              {onDeleteServer && !disabled ? (
                <button
                  type="button"
                  onClick={() => void onDeleteServer(p.id)}
                  aria-label={t("remove")}
                  className="absolute top-1.5 right-1.5 rounded-full bg-black/55 p-1.5 text-white"
                >
                  <Trash2 className="size-3.5" />
                </button>
              ) : null}
            </figure>
          ))}
          {mine.map((q) => (
            <figure key={q.id} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={q.previewUrl} alt={label} className={cn("size-full object-cover", q.status !== "done" && "opacity-70")} />
              <figcaption className="absolute inset-x-0 bottom-0 bg-navy/80 px-1.5 py-1 text-[10px] text-white">
                {q.status === "uploading" ? (
                  t("uploadState.uploading", { pct: q.progress })
                ) : q.status === "failed" ? (
                  <span className="flex items-center gap-1">
                    <CloudOff className="size-3" aria-hidden />
                    {t("uploadState.failed")}
                  </span>
                ) : (
                  t("uploadState.queued")
                )}
              </figcaption>
              {q.status !== "uploading" ? (
                <button
                  type="button"
                  onClick={() => void onDiscardQueued(q.id)}
                  aria-label={t("remove")}
                  className="absolute top-1.5 right-1.5 rounded-full bg-black/55 p-1.5 text-white"
                >
                  <Trash2 className="size-3.5" />
                </button>
              ) : null}
            </figure>
          ))}
        </div>
      ) : null}

      {geoError ? (
        <div role="alert" className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">
          {t(`gps.${geoError}`)}
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void handle(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        size="lg"
        variant={uploaded.length + mine.length ? "outline" : "default"}
        className="h-14 w-full text-base"
        disabled={disabled || state !== "idle"}
        onClick={() => inputRef.current?.click()}
      >
        {state === "locating" ? (
          <>
            <MapPin className="size-5 animate-pulse" aria-hidden />
            {t("gps.locating")}
          </>
        ) : state === "processing" ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <>
            <Camera className="size-5" aria-hidden />
            {uploaded.length + mine.length ? t("addAnother") : t("takePhoto")}
          </>
        )}
      </Button>
    </div>
  );
}
