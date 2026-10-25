"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { finalizePhotoUploadAction, requestPhotoUploadAction } from "@/lib/actions/field";
import { uploadWithRetry } from "@/lib/client/upload";
import { deleteQueued, listQueued, putQueued, type QueuedPhoto, type QueuedPhotoKind } from "@/lib/client/offline-store";
import type { GeoFix } from "@/lib/client/geo-photo";

export type QueueItem = Omit<QueuedPhoto, "blob"> & { previewUrl: string; progress: number };

/**
 * Persistent, sequential photo upload queue. Photos are written to IndexedDB
 * first, then uploaded one by one; failures stay queued and retry when the
 * device comes back online or on the next tick.
 */
export function usePhotoQueue(projectId: string) {
  const router = useRouter();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [online, setOnline] = useState(true);
  const busy = useRef(false);
  const urls = useRef(new Map<string, string>());

  const refresh = useCallback(async () => {
    const stored = await listQueued(projectId);
    setItems((prev) =>
      stored.map((s) => {
        let url = urls.current.get(s.id);
        if (!url) {
          url = URL.createObjectURL(s.blob);
          urls.current.set(s.id, url);
        }
        const { blob: _blob, ...rest } = s;
        return { ...rest, previewUrl: url, progress: prev.find((p) => p.id === s.id)?.progress ?? 0 };
      }),
    );
  }, [projectId]);

  const setProgress = (id: string, progress: number) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, progress } : x)));

  const process = useCallback(async () => {
    if (busy.current || (typeof navigator !== "undefined" && !navigator.onLine)) return;
    busy.current = true;
    try {
      const pending = (await listQueued(projectId)).filter((i) => i.status !== "done");
      let uploadedAny = false;
      for (const item of pending) {
        await putQueued({ ...item, status: "uploading" });
        await refresh();
        try {
          const reserved = await requestPhotoUploadAction({
            projectId,
            kind: item.kind,
            mimeType: item.mimeType as "image/jpeg",
            size: item.blob.size,
            lat: item.lat,
            lng: item.lng,
            accuracy: item.accuracy,
            takenAt: item.takenAt,
            caption: item.caption,
          });
          if (!reserved.ok) throw new Error(reserved.error.message ?? reserved.error.code);
          await uploadWithRetry({
            bucket: reserved.data.bucket,
            path: reserved.data.path,
            token: reserved.data.token,
            file: item.blob,
            contentType: item.mimeType,
            onProgress: (pct) => setProgress(item.id, pct),
          });
          const done = await finalizePhotoUploadAction(reserved.data.photoId);
          if (!done.ok) throw new Error(done.error.message ?? done.error.code);
          await deleteQueued(item.id);
          uploadedAny = true;
        } catch (err) {
          await putQueued({ ...item, status: "failed", error: err instanceof Error ? err.message : String(err) });
        }
        await refresh();
      }
      if (uploadedAny) router.refresh();
    } finally {
      busy.current = false;
    }
  }, [projectId, refresh, router]);

  useEffect(() => {
    void refresh().then(process);
    const goOnline = () => {
      setOnline(true);
      void process();
    };
    const goOffline = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const timer = setInterval(() => void process(), 30_000);
    const map = urls.current;
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      clearInterval(timer);
      for (const u of map.values()) URL.revokeObjectURL(u);
      map.clear();
    };
  }, [process, refresh]);

  const enqueue = useCallback(
    async (kind: QueuedPhotoKind, blob: Blob, fix: GeoFix | null, caption: string | null) => {
      await putQueued({
        id: crypto.randomUUID(),
        projectId,
        kind,
        blob,
        mimeType: blob.type || "image/jpeg",
        lat: fix?.lat ?? null,
        lng: fix?.lng ?? null,
        accuracy: fix?.accuracy ?? null,
        takenAt: (fix?.at ?? new Date()).toISOString(),
        caption,
        status: "queued",
        createdAt: Date.now(),
      });
      await refresh();
      void process();
    },
    [projectId, process, refresh],
  );

  const discard = useCallback(
    async (id: string) => {
      await deleteQueued(id);
      const url = urls.current.get(id);
      if (url) URL.revokeObjectURL(url);
      urls.current.delete(id);
      await refresh();
    },
    [refresh],
  );

  return { items, enqueue, discard, online, pendingCount: items.length };
}
