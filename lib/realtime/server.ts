import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { REFRESH_EVENT } from "./topics";

export async function broadcastRefresh(topics: Iterable<string>): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const client = supabaseAdmin();
  await Promise.all(
    [...new Set(topics)].map(async (topic) => {
      const channel = client.channel(topic);
      try {
        const res = await channel.httpSend(REFRESH_EVENT, { at: Date.now() }, { timeout: 4000 });
        if (!res.success) console.warn("[realtime] broadcast failed", topic, res.error);
      } catch (err) {
        console.warn("[realtime] broadcast error", topic, err);
      } finally {
        await client.removeChannel(channel);
      }
    }),
  );
}
