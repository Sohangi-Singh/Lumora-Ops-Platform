import { AppShell } from "@/components/shared/app-shell";
import { ShellBell } from "@/components/shared/shell-bell";
import { requirePageRole } from "@/lib/authz";

export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageRole("WORKER");
  return (
    <AppShell role="WORKER" userName={user.name} userEmail={user.email} headerSlot={<ShellBell user={user} />}>
      {children}
    </AppShell>
  );
}
