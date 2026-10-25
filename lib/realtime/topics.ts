/**
 * Realtime design: Supabase Broadcast is used purely as an invalidation
 * signal. Payloads never contain data — subscribers re-fetch through the
 * server (which runs the authz checks). Topic names use unguessable cuids/uuids.
 */
export const projectTopic = (projectId: string) => `project:${projectId}`;
export const userTopic = (userId: string) => `user:${userId}`;
export const ADMIN_TOPIC = "admins";
export const REFRESH_EVENT = "refresh";
