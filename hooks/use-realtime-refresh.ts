"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { subscribeTopic } from "@/lib/realtime/client";

/**
 * Subscribe to broadcast "refresh" pings and re-render the current server
 * components. Pings carry no data: the refetch goes through our authz'd
 * server, so a leaked topic name reveals nothing. Debounced to batch bursts.
 */
export function useRealtimeRefresh(topics: string[], onPing?: () => void): { live: boolean; lastPing: number | null } {
  const router = useRouter();
  const [live, setLive] = useState(false);
  const [lastPing, setLastPing] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPingRef = useRef(onPing);
  onPingRef.current = onPing;
  const key = topics.join("|");

  useEffect(() => {
    if (!key) return;
    const statuses = new Map<string, boolean>();
    const ping = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setLastPing(Date.now());
        onPingRef.current?.();
        router.refresh();
      }, 250);
    };
    const unsubs = key.split("|").map((topic) =>
      subscribeTopic(topic, ping, (isLive) => {
        statuses.set(topic, isLive);
        setLive([...statuses.values()].every(Boolean));
      }),
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
      for (const u of unsubs) u();
    };
  }, [key, router]);

  return { live, lastPing };
}
