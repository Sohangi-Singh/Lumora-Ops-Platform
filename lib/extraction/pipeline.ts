import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { BUCKETS, downloadObject } from "@/lib/storage";
import { notifyAdmins, recordEvent, withWorkflow } from "@/lib/workflow/service";
import { mergeExtractions, needsReview, runBillChecks, scoreConfidence } from "./checks";
import { extractWithVision, visionAvailable, visionProvider } from "./vision";
import { parseCspdclText } from "./cspdclParser";
import type { ExtractedBill } from "./schema";

/**
 * Bill extraction = deterministic text parse + AI vision (Claude or Gemini) + cross-checks.
 * Runs after the upload response (never blocks the customer), and every
 * failure degrades to "manual entry" rather than an error screen.
 */

async function pdfText(bytes: Buffer): Promise<string | null> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (err) {
    console.warn("[extraction] pdf text failed", err);
    return null;
  }
}

export async function queueBillExtraction(projectId: string): Promise<void> {
  const docs = await db.document.findMany({
    where: { projectId, isLatest: true, uploaded: true, type: { in: ["ELECTRICITY_BILL", "CONSUMPTION_HISTORY"] } },
  });
  const bill = docs.find((d) => d.type === "ELECTRICITY_BILL");
  const history = docs.filter((d) => d.type === "CONSUMPTION_HISTORY");
  if (!bill && !history.length) return;

  await db.document.updateMany({ where: { id: { in: docs.map((d) => d.id) } }, data: { extractionStatus: "RUNNING", extractionError: null } });

  const errors: string[] = [];
  let parser: ExtractedBill | null = null;
  let vision: ExtractedBill | null = null;
  const historyResults: ExtractedBill[] = [];

  if (bill) {
    try {
      const bytes = await downloadObject(BUCKETS.documents, bill.storagePath);
      if (bill.mimeType === "application/pdf") {
        const text = await pdfText(bytes);
        if (text) {
          const parsed = parseCspdclText(text);
          if (parsed.fieldsFound >= 3) parser = parsed;
        }
      }
      if (visionAvailable(bill.mimeType)) {
        vision = await extractWithVision({ bytes, mimeType: bill.mimeType, kind: "BILL" });
        if (vision.documentKind === "NOT_A_BILL") errors.push("Uploaded electricity bill does not look like a bill");
      }
    } catch (err) {
      errors.push(`Bill: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  for (const h of history) {
    if (!visionAvailable(h.mimeType)) continue;
    try {
      const bytes = await downloadObject(BUCKETS.documents, h.storagePath);
      historyResults.push(await extractWithVision({ bytes, mimeType: h.mimeType, kind: "HISTORY" }));
    } catch (err) {
      errors.push(`History: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const anything = vision ?? parser ?? historyResults[0] ?? null;
  const docIds = docs.map((d) => d.id);

  if (!anything) {
    const reason = errors[0] ?? (visionProvider() ? "Nothing readable found" : "Automatic reading not configured");
    await withWorkflow(async (tx, fx) => {
      await tx.document.updateMany({
        where: { id: { in: docIds } },
        data: { extractionStatus: visionProvider() ? "FAILED" : "SKIPPED", extractionError: reason },
      });
      await tx.billData.upsert({
        where: { projectId },
        create: { projectId, source: "MANUAL", needsReview: true, sourceDocumentIds: docIds },
        update: { needsReview: true },
      });
      await recordEvent(tx, fx, projectId, null, { type: "BILL_EXTRACTION_FAILED", error: reason });
    });
    return;
  }

  const { bill: merged, months } = mergeExtractions(vision, parser, historyResults);
  const checks = runBillChecks(merged, months, vision && parser ? parser : null);
  const confidence = scoreConfidence(vision?.confidence ?? null, checks);
  const review = needsReview(confidence, checks) || errors.length > 0;
  const source = vision ? "AI" : "PARSER";

  await withWorkflow(async (tx, fx) => {
    const existing = await tx.billData.findUnique({ where: { projectId }, select: { monthlyConsumption: true } });
    // Months an admin typed in by hand survive re-extraction.
    const manual = ((existing?.monthlyConsumption as { month: string; units: number; source?: string }[] | null) ?? []).filter(
      (m) => m.source === "MANUAL",
    );
    const { mergeConsumption } = await import("@/lib/solar/consumption");
    const finalMonths = mergeConsumption(months, manual as typeof months);

    const data = {
      serviceNo: merged.serviceNo,
      consumerName: merged.consumerName,
      billAddress: merged.billAddress,
      tariffCategory: merged.tariffCategory,
      purpose: merged.purpose,
      sanctionedLoadW: merged.sanctionedLoadW !== null ? Math.round(merged.sanctionedLoadW) : null,
      connectedLoadKw: merged.connectedLoadKw,
      phase: merged.phase,
      currentReading: merged.currentReading,
      previousReading: merged.previousReading,
      billedUnits: merged.billedUnits,
      netBillAmount: merged.netBillAmount,
      existingSolarExport: merged.existingSolarExport,
      monthlyConsumption: finalMonths as unknown as Prisma.InputJsonValue,
      source,
      confidence,
      checks: checks as unknown as Prisma.InputJsonValue,
      needsReview: review,
      rawExtraction: { vision, parser, history: historyResults, errors } as unknown as Prisma.InputJsonValue,
      sourceDocumentIds: docIds,
      confirmedByAdmin: false,
      confirmedById: null,
      confirmedAt: null,
    } satisfies Prisma.BillDataUncheckedUpdateInput;

    await tx.billData.upsert({ where: { projectId }, create: { projectId, ...data }, update: data });
    await tx.document.updateMany({
      where: { id: { in: docIds } },
      data: { extractionStatus: review ? "NEEDS_REVIEW" : "DONE", extractionError: errors.join("; ") || null },
    });
    await recordEvent(tx, fx, projectId, null, { type: "BILL_EXTRACTED", source, confidence, needsReview: review });
    await notifyAdmins(tx, fx, projectId, {
      titleEn: review ? "Bill data needs review" : "Bill data ready to confirm",
      titleHi: review ? "बिल की जानकारी जाँचें" : "बिल की जानकारी पक्की करें",
      bodyEn: `${merged.consumerName ?? "Customer"} · ${finalMonths.length} months read (${Math.round(confidence * 100)}% confidence)`,
      bodyHi: `${finalMonths.length} महीने पढ़े गए (${Math.round(confidence * 100)}% भरोसा)`,
      href: `/admin/projects/${projectId}?tab=bill`,
    });
  });
}
