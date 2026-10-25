import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CreateUserForm, ToggleActive } from "@/components/admin/user-controls";
import { PageHeader } from "@/components/shared/page-header";
import { StatusChip } from "@/components/shared/status-chip";
import { Card } from "@/components/ui/card";
import { requirePageRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatMobile } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("admin.users"))("title") };
}

export default async function UsersPage() {
  const me = await requirePageRole("ADMIN");
  const t = await getTranslations("admin.users");
  const users = await db.user.findMany({
    where: { role: { in: ["ADMIN", "WORKER"] } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    include: { _count: { select: { assignedProjects: { where: { completedAt: null } } } } },
  });
  return (
    <div className="space-y-5">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <CreateUserForm />
      <Card className="gap-0 p-0">
        <ul>
          {users.map((u) => (
            <li key={u.id} className="flex flex-col gap-2 border-b border-border/60 px-5 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-navy">{u.name}</span>
                  <StatusChip tone={u.role === "ADMIN" ? "gold" : "info"}>{t(`role.${u.role}`)}</StatusChip>
                  {!u.isActive ? <StatusChip tone="danger">{t("inactive")}</StatusChip> : null}
                  {u.id === me.id ? <StatusChip>{t("you")}</StatusChip> : null}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {u.email} · {formatMobile(u.phone)}
                  {u.role === "WORKER" ? ` · ${t("jobs", { n: u._count.assignedProjects })}` : ""}
                </div>
              </div>
              {u.id !== me.id ? <ToggleActive userId={u.id} active={u.isActive} /> : null}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
