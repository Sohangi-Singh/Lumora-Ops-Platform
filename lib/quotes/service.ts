import "server-only";
import type { Prisma, Quote } from "@prisma/client";
import { db, type Tx } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { renderQuotePdf } from "@/lib/pdf/render";
import { getSettings } from "@/lib/settings";
import { parseSettings, type Settings } from "@/lib/settings/schema";
import type { CatalogItemInput, LineItem } from "@/lib/solar/bom";
import type { MonthlyUnits, PhaseType } from "@/lib/solar/types";
import { composeQuote, isQuoteExpired, validTillDate, type ComposedQuote, type QuoteInputs, type QuoteOverrides } from "@/lib/solar/quote";
import { fiscalYearOf, formatRefNo } from "@/lib/solar/refNo";
import { BUCKETS, uploadBuffer } from "@/lib/storage";
import { notifyAdmins, notifyCustomer, recordEvent, withWorkflow } from "@/lib/workflow/service";

/**
 * Quote pipeline: confirmed bill + submitted survey + settings → pure
 * composeQuote() → versioned Quote row (inputs + outputs snapshotted) →
 * letterhead PDF in a private bucket → admin approval → customer.
 */

/** Atomic per-financial-year serial (safe under concurrent quote generation). */
export async function nextQuoteSerial(tx: Tx, date: Date): Promise<number> {
  const fy = fiscalYearOf(date);
  const rows = await tx.$queryRaw<{ lastSerial: number }[]>`
    INSERT INTO "RefCounter" ("fiscalYear", "lastSerial") VALUES (${fy}, 1)
    ON CONFLICT ("fiscalYear") DO UPDATE SET "lastSerial" = "RefCounter"."lastSerial" + 1
    RETURNING "lastSerial"`;
  return rows[0].lastSerial;
}

export class QuotePrerequisiteError extends AppError {
  constructor(message: string) {
    super("INVALID_TRANSITION", message);
  }
}

/** Gather and validate everything composeQuote() needs from the database. */
export async function loadQuoteInputs(projectId: string, overrides: QuoteOverrides, quoteDate = new Date()): Promise<QuoteInputs> {
  const [project, catalog, slabs, settings] = await Promise.all([
    db.project.findUnique({ where: { id: projectId }, include: { billData: true, survey: true } }),
    db.catalogItem.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.pricingSlab.findMany({ where: { isActive: true } }),
    getSettings(),
  ]);
  if (!project) throw new AppError("NOT_FOUND");
  const bill = project.billData;
  if (!bill?.confirmedByAdmin) throw new QuotePrerequisiteError("Bill data must be confirmed before quoting");
  const survey = project.survey;
  if (!survey || survey.status !== "SUBMITTED") throw new QuotePrerequisiteError("The site survey must be submitted before quoting");

  return {
    bill: {
      monthlyConsumption: (bill.monthlyConsumption as MonthlyUnits[]) ?? [],
      sanctionedLoadW: bill.sanctionedLoadW,
      connectedLoadKw: bill.connectedLoadKw,
      phase: bill.phase,
      netBillAmount: bill.netBillAmount,
      billedUnits: bill.billedUnits,
    },
    survey: {
      roofAreaSqm: survey.roofAreaSqm,
      phaseObserved: survey.phaseObserved,
      roofToMeterVerticalM: survey.roofToMeterVerticalM,
      roofToMeterHorizontalM: survey.roofToMeterHorizontalM,
      panelToInverterVerticalM: survey.panelToInverterVerticalM,
      panelToInverterHorizontalM: survey.panelToInverterHorizontalM,
      inverterToMeterM: survey.inverterToMeterM,
    },
    overrides: { ...overrides, phase: overrides.phase ?? project.phase ?? null },
    catalog: catalog as CatalogItemInput[],
    slabs: slabs.map((s) => ({ minKw: s.minKw, maxKw: s.maxKw, ratePerKwInclGst: s.ratePerKwInclGst, phase: s.phase, isActive: s.isActive })),
    settings,
    quoteDate,
  };
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

type StoredComputed = Pick<ComposedQuote, "sizing" | "pricing" | "economics" | "cables" | "overridden" | "panelWattage">;

async function addresseeFor(projectId: string) {
  const p = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { customer: { select: { salutation: true, addressLine1: true, addressLine2: true, city: true, state: true, pincode: true, user: { select: { name: true } } } } },
  });
  const c = p.customer;
  return {
    salutation: c.salutation,
    name: c.user.name,
    line1: c.addressLine1,
    line2: [c.addressLine2, c.city, c.state, c.pincode].filter(Boolean).join(", "),
  };
}

/** Render a stored quote exactly as it was computed (settings from its snapshot). */
export async function renderStoredQuote(quote: Quote, opts: { draft: boolean }): Promise<Buffer> {
  const snapshot = quote.inputsSnapshot as { settings?: Settings };
  const settings = parseSettings(snapshot.settings);
  const computed = quote.computed as unknown as StoredComputed;
  return renderQuotePdf({
    addressee: await addresseeFor(quote.projectId),
    refNo: quote.refNo,
    quoteDate: quote.quoteDate,
    validTill: quote.validTill,
    systemKw: quote.systemKw,
    phase: quote.phase as PhaseType,
    lineItems: quote.lineItems as unknown as LineItem[],
    totalInclGst: quote.totalInclGst,
    totalInWords: computed.pricing.totalInWords,
    basicPerWp: computed.pricing.basicPerWp,
    economics: computed.economics,
    settings,
    draft: opts.draft,
  });
}

/** Live preview for the admin's override form — rendered on the fly, never stored. */
export async function renderPreview(projectId: string, overrides: QuoteOverrides): Promise<Buffer> {
  const inputs = await loadQuoteInputs(projectId, overrides);
  const q = composeQuote(inputs);
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId }, select: { quotes: { select: { refNo: true }, take: 1, orderBy: { version: "desc" } } } });
  return renderQuotePdf({
    addressee: await addresseeFor(projectId),
    refNo: project.quotes[0]?.refNo ?? "XXXX/PREVIEW",
    quoteDate: inputs.quoteDate,
    validTill: q.validTill,
    systemKw: q.systemKw,
    phase: q.phase,
    lineItems: q.lineItems,
    totalInclGst: q.pricing.totalInclGst,
    totalInWords: q.pricing.totalInWords,
    basicPerWp: q.pricing.basicPerWp,
    economics: q.economics,
    settings: inputs.settings,
    draft: true,
  });
}

function pdfPathFor(q: { projectId: string; refNo: string; version: number }, final: boolean) {
  return `projects/${q.projectId}/quotes/${q.refNo.replaceAll("/", "-")}-v${q.version}${final ? "" : "-draft"}-${Date.now()}.pdf`;
}

/**
 * Create a new quote version (DRAFT), render its draft PDF, then move it to
 * PENDING_APPROVAL and ping the admins. Earlier unaccepted versions are SUPERSEDED.
 */
export async function generateQuote(projectId: string, opts: { actorId: string | null; overrides?: QuoteOverrides }): Promise<string> {
  const overrides = opts.overrides ?? {};
  const inputs = await loadQuoteInputs(projectId, overrides);
  const q = composeQuote(inputs);

  const quote = await withWorkflow(async (tx, fx) => {
    await tx.$executeRaw`SELECT id FROM "Project" WHERE id = ${projectId} FOR UPDATE`;
    const project = await tx.project.findUniqueOrThrow({ where: { id: projectId }, select: { stage: true, cityCode: true } });
    if (project.stage !== "QUOTE") throw new AppError("INVALID_TRANSITION", "Quotes can only be generated in the quote stage");
    const existing = await tx.quote.findMany({ where: { projectId }, orderBy: { version: "desc" }, select: { refNo: true, version: true, status: true } });
    if (existing.some((e) => e.status === "ACCEPTED")) throw new AppError("CONFLICT", "This project already has an accepted quote");

    const refNo = existing[0]?.refNo ?? formatRefNo(await nextQuoteSerial(tx, inputs.quoteDate), project.cityCode, inputs.quoteDate);
    const version = (existing[0]?.version ?? 0) + 1;
    await tx.quote.updateMany({ where: { projectId, status: { notIn: ["ACCEPTED", "SUPERSEDED"] } }, data: { status: "SUPERSEDED" } });

    const computed: StoredComputed = { sizing: q.sizing, pricing: q.pricing, economics: q.economics, cables: q.cables, overridden: q.overridden, panelWattage: q.panelWattage };
    const created = await tx.quote.create({
      data: {
        projectId,
        refNo,
        version,
        status: "DRAFT",
        quoteDate: inputs.quoteDate,
        validTill: q.validTill,
        systemKw: q.systemKw,
        phase: q.phase,
        panelCount: q.panelCount,
        inputsSnapshot: toJson({ ...inputs, quoteDate: inputs.quoteDate.toISOString() }),
        computed: toJson(computed),
        lineItems: toJson(q.lineItems),
        totalInclGst: q.pricing.totalInclGst,
        overrideReason: overrides.reason ?? null,
      },
    });
    const isOverride = q.overridden.systemKw || q.overridden.phase || q.overridden.panelCount;
    await tx.project.update({
      where: { id: projectId },
      data: {
        systemKw: q.systemKw,
        phase: q.phase,
        sizingOverride: isOverride
          ? toJson({ systemKw: overrides.systemKw ?? null, phase: overrides.phase ?? null, panelCount: overrides.panelCount ?? null, reason: overrides.reason ?? null, by: opts.actorId, at: new Date().toISOString() })
          : undefined,
      },
    });
    if (isOverride) await recordEvent(tx, fx, projectId, opts.actorId, { type: "SIZING_OVERRIDDEN", kw: q.systemKw, reason: overrides.reason ?? "—" });
    await recordEvent(tx, fx, projectId, opts.actorId, { type: "QUOTE_GENERATED", refNo, version, kw: q.systemKw, total: q.pricing.totalInclGst });
    return created;
  });

  // Draft PDF outside the transaction (rendering is slow); a failure here leaves the quote reviewable.
  let pdfPath: string | null = null;
  try {
    const pdf = await renderStoredQuote(quote, { draft: true });
    pdfPath = pdfPathFor(quote, false);
    await uploadBuffer(BUCKETS.quotes, pdfPath, pdf, "application/pdf");
  } catch (err) {
    console.error("[quote] draft PDF failed", err);
    pdfPath = null;
  }

  await withWorkflow(async (tx, fx) => {
    await tx.quote.update({ where: { id: quote.id }, data: { status: "PENDING_APPROVAL", pdfPath } });
    await notifyAdmins(tx, fx, projectId, {
      titleEn: `Quote ${quote.refNo} awaiting approval`,
      titleHi: `कोटेशन ${quote.refNo} मंज़ूरी के लिए`,
      bodyEn: `${quote.systemKw} kW · ₹${quote.totalInclGst.toLocaleString("en-IN")} — review the sizing and approve.`,
      bodyHi: `${quote.systemKw} किलोवाट · ₹${quote.totalInclGst.toLocaleString("en-IN")} — साइज़ जाँचकर मंज़ूरी दें।`,
      href: `/admin/projects/${projectId}?tab=quote`,
    });
  });
  return quote.id;
}

/** Stage hook: entering QUOTE generates the first draft automatically. */
export async function autoGenerateQuote(projectId: string): Promise<void> {
  const active = await db.quote.count({ where: { projectId, status: { notIn: ["SUPERSEDED", "EXPIRED"] } } });
  if (active) return;
  try {
    await generateQuote(projectId, { actorId: null });
  } catch (err) {
    console.error("[quote] auto-generation failed", err);
  }
}

/**
 * Approve & Send: the quote is re-dated to today (so the customer gets the
 * full validity window), re-rendered without the draft watermark, and sent.
 */
export async function approveQuote(quoteId: string, adminId: string): Promise<void> {
  const quote = await db.quote.findUnique({ where: { id: quoteId }, include: { project: { select: { stage: true } } } });
  if (!quote) throw new AppError("NOT_FOUND");
  if (quote.status !== "PENDING_APPROVAL" && quote.status !== "DRAFT") throw new AppError("CONFLICT", `Quote is ${quote.status.toLowerCase()}`);
  if (quote.project.stage !== "QUOTE") throw new AppError("INVALID_TRANSITION", "Project is not in the quote stage");

  const settings = parseSettings((quote.inputsSnapshot as { settings?: unknown }).settings);
  const now = new Date();
  const finalQuote = { ...quote, quoteDate: now, validTill: validTillDate(now, settings.quote.validityDays) };
  const pdf = await renderStoredQuote(finalQuote, { draft: false });
  const pdfPath = pdfPathFor(quote, true);
  await uploadBuffer(BUCKETS.quotes, pdfPath, pdf, "application/pdf");

  await withWorkflow(async (tx, fx) => {
    const updated = await tx.quote.updateMany({
      where: { id: quoteId, status: { in: ["PENDING_APPROVAL", "DRAFT"] } },
      data: { status: "SENT", quoteDate: now, validTill: finalQuote.validTill, pdfPath, approvedById: adminId, approvedAt: now, sentAt: now },
    });
    if (updated.count !== 1) throw new AppError("CONFLICT", "Quote was changed by someone else");
    await recordEvent(tx, fx, quote.projectId, adminId, { type: "QUOTE_APPROVED", refNo: quote.refNo, version: quote.version });
    await notifyCustomer(tx, fx, quote.projectId, {
      titleEn: "Your quotation is ready",
      titleHi: "आपका कोटेशन तैयार है",
      bodyEn: `${quote.systemKw} kW rooftop solar · ₹${quote.totalInclGst.toLocaleString("en-IN")}. Please review and accept before it expires.`,
      bodyHi: `${quote.systemKw} किलोवाट रूफटॉप सोलर · ₹${quote.totalInclGst.toLocaleString("en-IN")}। समय रहते देखकर स्वीकार करें।`,
      href: "/portal/quote",
    });
  });
}

/** Lazily expire sent quotes past their validity (called on page loads). */
export async function expireStaleQuotes(projectId?: string): Promise<void> {
  const now = new Date();
  const stale = await db.quote.findMany({
    where: { status: { in: ["SENT", "APPROVED"] }, validTill: { lt: now }, ...(projectId ? { projectId } : {}) },
    select: { id: true, projectId: true, refNo: true, validTill: true },
  });
  for (const q of stale) {
    if (!isQuoteExpired(q.validTill, now)) continue;
    await withWorkflow(async (tx, fx) => {
      const r = await tx.quote.updateMany({ where: { id: q.id, status: { in: ["SENT", "APPROVED"] } }, data: { status: "EXPIRED" } });
      if (r.count) await recordEvent(tx, fx, q.projectId, null, { type: "QUOTE_EXPIRED", refNo: q.refNo });
    });
  }
}
