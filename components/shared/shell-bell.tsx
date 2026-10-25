import { db } from "@/lib/db";
import { ADMIN_TOPIC, userTopic } from "@/lib/realtime/topics";
import type { SessionUser } from "@/lib/auth/session";
import { NotificationBell } from "./notification-bell";

/** Server wrapper: loads the user's latest notifications for the header bell. */
export async function ShellBell({ user }: { user: SessionUser }) {
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 15 }),
    db.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  const topics = [userTopic(user.id), ...(user.role === "ADMIN" ? [ADMIN_TOPIC] : [])];
  return (
    <NotificationBell
      unread={unread}
      topics={topics}
      items={items.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))}
    />
  );
}
