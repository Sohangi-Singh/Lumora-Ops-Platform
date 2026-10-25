"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { REFRESH_EVENT } from "@/lib/realtime/topics";
import { supabaseBrowser } from "@/lib/supabase/browser";

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
    const client = supabaseBrowser();
    if (!client || !key) return;
    const channels = key.split("|").map((topic) =>
      client
        .channel(topic)
        .on("broadcast", { event: REFRESH_EVENT }, () => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            setLastPing(Date.now());
            onPingRef.current?.();
            router.refresh();
          }, 250);
        })
        .subscribe((status) => setLive(status === "SUBSCRIBED")),
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
      for (const c of channels) void client.removeChannel(c);
    };
  }, [key, router]);

  return { live, lastPing };
}
