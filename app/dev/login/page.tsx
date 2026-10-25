import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { DEV_AUTH_ENABLED, DEV_USER_COOKIE, homePathFor } from "@/lib/auth/session";
import { db } from "@/lib/db";

/** Development-only user switcher (404 everywhere else). */
export default async function DevLogin() {
  if (!DEV_AUTH_ENABLED) notFound();
  const users = await db.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] });

  async function signIn(formData: FormData) {
    "use server";
    if (!DEV_AUTH_ENABLED) notFound();
    const id = String(formData.get("id"));
    const user = await db.user.findUniqueOrThrow({ where: { id } });
    (await cookies()).set(DEV_USER_COOKIE, id, { path: "/", httpOnly: true, sameSite: "lax" });
    redirect(homePathFor(user.role));
  }

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-1 text-xl font-semibold">Dev sign-in</h1>
      <p className="mb-4 text-sm text-muted-foreground">Local only — Supabase is not configured. Pick a seeded user.</p>
      <ul className="space-y-2">
        {users.map((u) => (
          <li key={u.id}>
            <form action={signIn}>
              <input type="hidden" name="id" value={u.id} />
              <button className="w-full rounded-xl bg-white px-4 py-3 text-left ring-1 ring-border hover:ring-navy">
                <span className="font-medium">{u.name}</span> <span className="text-xs text-muted-foreground">· {u.role} · {u.email}</span>
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
