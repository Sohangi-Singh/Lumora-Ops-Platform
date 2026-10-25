import { getTranslations } from "next-intl/server";
import { HomeLink, StatusPage } from "@/components/shared/status-page";

export default async function Forbidden() {
  const t = await getTranslations("errors");
  return <StatusPage code="403" title={t("forbiddenTitle")} body={t("forbiddenBody")} action={<HomeLink label={t("goHome")} />} />;
}
