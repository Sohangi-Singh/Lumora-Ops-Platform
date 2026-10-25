import { getTranslations } from "next-intl/server";
import { HomeLink, StatusPage } from "@/components/shared/status-page";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return <StatusPage code="404" title={t("notFoundTitle")} body={t("notFoundBody")} action={<HomeLink label={t("goHome")} />} />;
}
