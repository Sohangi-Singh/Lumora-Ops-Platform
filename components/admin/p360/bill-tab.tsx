import { getTranslations } from "next-intl/server";
import { BillEditor, type BillEditorProps } from "@/components/admin/bill-editor";
import type { Project360 } from "@/lib/admin/data";
import { db } from "@/lib/db";

export async function BillTab({ data }: { data: Project360 }) {
  const t = await getTranslations("admin.bill");
  const b = data.project.billData;
  const billDoc = await db.document.findFirst({
    where: { projectId: data.project.id, type: "ELECTRICITY_BILL", isLatest: true, uploaded: true },
    select: { id: true, mimeType: true, extractionStatus: true, extractionError: true },
  });

  const props: BillEditorProps = {
    projectId: data.project.id,
    fields: {
      serviceNo: b?.serviceNo ?? null,
      consumerName: b?.consumerName ?? null,
      billAddress: b?.billAddress ?? null,
      purpose: b?.purpose ?? null,
      tariffCategory: b?.tariffCategory ?? null,
      sanctionedLoadW: b?.sanctionedLoadW ?? null,
      connectedLoadKw: b?.connectedLoadKw ?? null,
      phase: b?.phase ?? null,
      currentReading: b?.currentReading ?? null,
      previousReading: b?.previousReading ?? null,
      billedUnits: b?.billedUnits ?? null,
      netBillAmount: b?.netBillAmount ?? null,
      existingSolarExport: b?.existingSolarExport ?? null,
    },
    months: (b?.monthlyConsumption as BillEditorProps["months"] | undefined) ?? [],
    checks: (b?.checks as BillEditorProps["checks"] | undefined) ?? [],
    confidence: b?.confidence ?? null,
    source: b?.source ?? null,
    needsReview: b?.needsReview ?? false,
    confirmed: b?.confirmedByAdmin ?? false,
    extraction: billDoc ? { status: billDoc.extractionStatus, error: billDoc.extractionError } : null,
    preview: billDoc ? { id: billDoc.id, mimeType: billDoc.mimeType } : null,
  };

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">{t("subtitle")}</p>
      {/* key forces a fresh editor when new extraction data arrives via realtime */}
      <BillEditor key={b?.updatedAt.toISOString() ?? "none"} {...props} />
    </div>
  );
}
