import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { EventList } from "@/components/customer/event-list";
import { LiveIndicator } from "@/components/shared/live-indicator";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { requirePageRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { getCustomerProject } from "@/lib/portal/data";
import { projectTopic } from "@/lib/realtime/topics";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("timeline"))("title") };
}

export default async function TimelinePage() {
  const user = await requirePageRole("CUSTOMER");
  const { project } = await getCustomerProject(user);
  const [t, locale] = [await getTranslations("timeline"), await getLocale()];
  const events = await db.projectEvent.findMany({
    where: { projectId: project.id, internal: false },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, messageEn: true, messageHi: true, createdAt: true },
  });
  return (
    <div>
      <PageHeader title={t("title")} description={t("subtitle")} actions={<LiveIndicator topics={[projectTopic(project.id)]} />} />
      <Card className="p-5 sm:p-6">
        <EventList events={events} locale={locale} emptyText={t("empty")} />
      </Card>
    </div>
  );
}
