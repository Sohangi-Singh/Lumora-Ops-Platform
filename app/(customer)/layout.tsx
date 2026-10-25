import { AppShell } from "@/components/shared/app-shell";
import { ShellBell } from "@/components/shared/shell-bell";
import { requirePageRole } from "@/lib/authz";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageRole("CUSTOMER");
  return (
    <AppShell role="CUSTOMER" userName={user.name} userEmail={user.email} headerSlot={<ShellBell user={user} />}>
      {children}
    </AppShell>
  );
}
