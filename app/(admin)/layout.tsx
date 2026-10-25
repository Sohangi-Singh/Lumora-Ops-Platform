import { AppShell } from "@/components/shared/app-shell";
import { ShellBell } from "@/components/shared/shell-bell";
import { requirePageRole } from "@/lib/authz";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageRole("ADMIN");
  return (
    <AppShell role="ADMIN" userName={user.name} userEmail={user.email} headerSlot={<ShellBell user={user} />}>
      {children}
    </AppShell>
  );
}
