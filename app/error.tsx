"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { StatusPage } from "@/components/shared/status-page";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");
  const tc = useTranslations("common");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <StatusPage
      code={error.digest ? `ERROR · ${error.digest.slice(0, 8)}` : "ERROR"}
      title={t("generic")}
      body={t("dbError")}
      action={<Button onClick={reset}>{tc("retry")}</Button>}
    />
  );
}
