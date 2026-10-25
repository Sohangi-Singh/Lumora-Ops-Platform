"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { REFRESH_EVENT } from "./topics";

/**
 * One Realtime channel per topic, shared by every component that listens to
 * it and ref-counted. supabase-js reuses channel objects by topic, so letting
 * each component create/remove its own made a page that re-subscribes during
 * navigation race the previous page's teardown and never join.
 */
type Entry = {
  channel: RealtimeChannel;
  listeners: Set<() => void>;
  statusListeners: Set<(live: boolean) => void>;
  live: boolean;
  releaseTimer?: ReturnType<typeof setTimeout>;
};

const registry = new Map<string, Entry>();

export function subscribeTopic(topic: string, onPing: () => void, onStatus: (live: boolean) => void): () => void {
  const client = supabaseBrowser();
  if (!client) return () => undefined;

  let entry = registry.get(topic);
  if (entry?.releaseTimer) {
    clearTimeout(entry.releaseTimer);
    entry.releaseTimer = undefined;
  }
  if (!entry) {
    const created: Entry = { channel: client.channel(topic), listeners: new Set(), statusListeners: new Set(), live: false };
    created.channel
      .on("broadcast", { event: REFRESH_EVENT }, () => {
        if (process.env.NODE_ENV === "development") console.debug("[realtime] ping", topic);
        for (const l of created.listeners) l();
      })
      .subscribe((status, err) => {
        if (process.env.NODE_ENV === "development") console.debug("[realtime]", topic, status, err?.message ?? "");
        created.live = status === "SUBSCRIBED";
        for (const s of created.statusListeners) s(created.live);
      });
    registry.set(topic, created);
    entry = created;
  }

  const e = entry;
  e.listeners.add(onPing);
  e.statusListeners.add(onStatus);
  onStatus(e.live);

  return () => {
    e.listeners.delete(onPing);
    e.statusListeners.delete(onStatus);
    if (e.listeners.size === 0) {
      // Grace period: the next page usually re-subscribes to the same topic immediately.
      e.releaseTimer = setTimeout(() => {
        if (e.listeners.size === 0 && registry.get(topic) === e) {
          registry.delete(topic);
          void client.removeChannel(e.channel);
        }
      }, 5_000);
    }
  };
}
