/**
 * Demo seed: business config from Lumora's sample quote + fictional people
 * spread across the lifecycle so every screen has something to show.
 *
 *   npm run db:seed            (refuses to wipe a database that already has users)
 *   SEED_RESET=1 npm run db:seed
 *
 * With Supabase env vars set it also creates Auth users, private buckets and
 * uploads demo files + quote PDFs. Without them it seeds the DB only.
 */
import { PrismaClient, type Prisma, type Stage } from "@prisma/client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderQuotePdf } from "@/lib/pdf/render";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";
import { amountInWords } from "@/lib/solar/amountInWords";
import { composeQuote } from "@/lib/solar/quote";
import { formatRefNo } from "@/lib/solar/refNo";
import { roofAreaSqm } from "@/lib/survey/requirements";
import { renderEvent, type EventSpec } from "@/lib/workflow/events";
import { exitBlockers, STAGES, autoAdvancePath } from "@/lib/workflow/stateMachine";
import { SNAPSHOT_INCLUDE, toSnapshot } from "@/lib/workflow/snapshot";
import { CATALOG_SEED, PRICING_SLAB_SEED } from "./seed-data";

const db = new PrismaClient();
const PASSWORD = "Lumora@2026";
const DAY = 86_400_000;
const now = new Date();
const ago = (days: number, hours = 11) => new Date(now.getTime() - days * DAY + (hours - 11) * 3600_000);

const supabase: SupabaseClient | null =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : null;

const BUCKETS = { documents: "project-documents", photos: "project-photos", quotes: "quotes" } as const;
const ASSETS = path.join(process.cwd(), "prisma/seed-assets");

/* ----------------------------------------------------------- helpers -- */

async function ensureBuckets() {
  if (!supabase) return;
  const { data } = await supabase.storage.listBuckets();
  const have = new Set((data ?? []).map((b) => b.name));
  for (const name of Object.values(BUCKETS)) {
    if (!have.has(name)) {
      const { error } = await supabase.storage.createBucket(name, { public: false, fileSizeLimit: 10 * 1024 * 1024 });
      if (error) throw new Error(`bucket ${name}: ${error.message}`);
    }
  }
}

async function upload(bucket: string, key: string, body: Buffer, contentType: string) {
  if (!supabase) return;
  const { error } = await supabase.storage.from(bucket).upload(key, body, { contentType, upsert: true });
  if (error) throw new Error(`upload ${key}: ${error.message}`);
}

async function authUser(email: string, name: string): Promise<string> {
  if (!supabase) return randomUUID();
  for (let page = 1; page < 20; page++) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    const found = data?.users.find((u) => u.email === email);
    if (found) {
      await supabase.auth.admin.updateUserById(found.id, { password: PASSWORD, ban_duration: "none", user_metadata: { name } });
      return found.id;
    }
    if (!data || data.users.length < 200) break;
  }
  const { data, error } = await supabase.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { name } });
  if (error || !data.user) throw new Error(`auth user ${email}: ${error?.message}`);
  return data.user.id;
}

async function event(projectId: string, actorId: string | null, spec: EventSpec, at: Date) {
  const { en, hi, internal } = renderEvent(spec);
  await db.projectEvent.create({
    data: { projectId, actorId, type: spec.type, payload: spec as unknown as Prisma.InputJsonValue, messageEn: en, messageHi: hi, internal, createdAt: at },
  });
}

/** Seasonal Chhattisgarh consumption: summer peak, winter dip. */
function months(base: number, count = 7, end = "2026-09"): { month: string; units: number; source: "BILL" }[] {
  const factor = [0.72, 0.7, 0.85, 1.2, 1.45, 1.38, 1.08, 1.0, 1.02, 0.95, 0.82, 0.74];
  const [y, m] = end.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const idx = y * 12 + (m - 1) - i;
    const mm = (idx % 12) + 1;
    return { month: `${Math.floor(idx / 12)}-${String(mm).padStart(2, "0")}`, units: Math.round(base * factor[mm - 1]), source: "BILL" as const };
  });
}

type Who = { admin: string; workers: string[] };

/* ------------------------------------------------------------- main -- */

async function main() {
  const existing = await db.user.count();
  if (existing > 0 && process.env.SEED_RESET !== "1") {
    console.error("Database already has users. Re-run with SEED_RESET=1 to wipe and reseed demo data.");
    process.exit(1);
  }

  console.log(`Seeding${supabase ? " (with Supabase Auth + Storage)" : " (DB only — Supabase env not set)"}…`);
  // Wipe in FK-safe order.
  await db.$transaction([
    db.notification.deleteMany(),
    db.projectEvent.deleteMany(),
    db.photo.deleteMany(),
    db.serviceTicket.deleteMany(),
    db.payment.deleteMany(),
    db.quote.deleteMany(),
    db.survey.deleteMany(),
    db.billData.deleteMany(),
    db.document.deleteMany(),
    db.project.deleteMany(),
    db.customer.deleteMany(),
    db.user.deleteMany(),
    db.catalogItem.deleteMany(),
    db.pricingSlab.deleteMany(),
    db.settings.deleteMany(),
    db.refCounter.deleteMany(),
    db.webhookEvent.deleteMany(),
    db.auditLog.deleteMany(),
    db.rateLimit.deleteMany(),
  ]);

  await db.settings.create({ data: { id: 1, data: DEFAULT_SETTINGS as unknown as Prisma.InputJsonValue } });
  await db.catalogItem.createMany({ data: CATALOG_SEED.map((c) => ({ ...c, isActive: true })) });
  await db.pricingSlab.createMany({ data: PRICING_SLAB_SEED.map((s) => ({ ...s, isActive: true })) });
  // The sample quotation was 0241 for FY 2026-27, so new quotes continue from there.
  await db.refCounter.create({ data: { fiscalYear: "2026-2027", lastSerial: 240 } });
  await ensureBuckets();

  const adminId = await authUser("admin.demo@example.com", "Deepak Singh");
  await db.user.create({ data: { id: adminId, role: "ADMIN", name: "Deepak Singh", email: "admin.demo@example.com", phone: "9000000001" } });
  const workers: string[] = [];
  for (const [i, w] of [
    ["ravi.demo@example.com", "Ravi Kumar Sahu", "9000000011"],
    ["manoj.demo@example.com", "Manoj Patel", "9000000012"],
  ].entries()) {
    const id = await authUser(w[0], w[1]);
    await db.user.create({ data: { id, role: "WORKER", name: w[1], email: w[0], phone: w[2], language: i === 0 ? "hi" : "en" } });
    workers.push(id);
  }
  const who: Who = { admin: adminId, workers };

  const files = {
    aadhaar: await readFile(path.join(ASSETS, "aadhaar.jpg")),
    pan: await readFile(path.join(ASSETS, "pan.jpg")),
    cheque: await readFile(path.join(ASSETS, "cheque.jpg")),
    bill: await readFile(path.join(ASSETS, "bill.jpg")),
    rooftop: await readFile(path.join(ASSETS, "rooftop.jpg")),
    shadow: await readFile(path.join(ASSETS, "shadow.jpg")),
    before: await readFile(path.join(ASSETS, "install-before.jpg")),
    after: await readFile(path.join(ASSETS, "install-after.jpg")),
  };

  let serial = 240;
  const S = DEFAULT_SETTINGS;

  type Spec = {
    email: string;
    name: string;
    salutation: "Mr." | "Ms.";
    phone: string;
    language: "en" | "hi";
    address: [string, string];
    city: "RPR" | "DEL";
    pincode: string;
    createdDaysAgo: number;
    stage: Stage;
    baseUnits: number;
    loadW: number;
    phase: "SINGLE" | "THREE";
    roof: [number, number];
    worker: 0 | 1;
    rejectAadhaar?: boolean;
    partialDocs?: boolean;
    quoteStatus?: "PENDING_APPROVAL" | "ACCEPTED";
  };

  const specs: Spec[] = [
    { email: "kavita.demo@example.com", name: "Kavita Yadav", salutation: "Ms.", phone: "9100000001", language: "hi", address: ["House 14, Sector 2", "Avanti Vihar"], city: "RPR", pincode: "492006", createdDaysAgo: 0, stage: "DOCUMENTS", baseUnits: 420, loadW: 3000, phase: "SINGLE", roof: [6, 5], worker: 0 },
    { email: "priya.demo@example.com", name: "Priya Sharma", salutation: "Ms.", phone: "9100000002", language: "en", address: ["B-7, Green Park Colony", "Shankar Nagar"], city: "RPR", pincode: "492007", createdDaysAgo: 3, stage: "DOCUMENTS", baseUnits: 610, loadW: 5000, phase: "SINGLE", roof: [8, 6], worker: 0, rejectAadhaar: true, partialDocs: true },
    { email: "rohit.demo@example.com", name: "Rohit Verma", salutation: "Mr.", phone: "9100000003", language: "en", address: ["42, Shanti Nagar", "Near Gurudwara"], city: "RPR", pincode: "492001", createdDaysAgo: 6, stage: "SURVEY", baseUnits: 700, loadW: 6000, phase: "THREE", roof: [9, 7], worker: 0 },
    { email: "anjali.demo@example.com", name: "Anjali Gupta", salutation: "Ms.", phone: "9100000004", language: "hi", address: ["C-21, Capital Homes", "Saddu"], city: "RPR", pincode: "492014", createdDaysAgo: 9, stage: "QUOTE", baseUnits: 760, loadW: 9890, phase: "THREE", roof: [10, 7], worker: 0, quoteStatus: "PENDING_APPROVAL" },
    { email: "vikram.demo@example.com", name: "Vikram Sahu", salutation: "Mr.", phone: "9100000005", language: "en", address: ["Plot 8, Gayatri Nagar", "Shankar Nagar"], city: "RPR", pincode: "492007", createdDaysAgo: 16, stage: "SUBSIDY_APPLICATION", baseUnits: 450, loadW: 3000, phase: "SINGLE", roof: [6, 5.5], worker: 1, quoteStatus: "ACCEPTED" },
    { email: "neha.demo@example.com", name: "Neha Patel", salutation: "Ms.", phone: "9100000006", language: "en", address: ["Tower 3, Flat 1204, Sunrise Heights", "Sector 50"], city: "DEL", pincode: "122018", createdDaysAgo: 38, stage: "INSTALLATION", baseUnits: 820, loadW: 7000, phase: "THREE", roof: [10, 8], worker: 1, quoteStatus: "ACCEPTED" },
    { email: "suresh.demo@example.com", name: "Suresh Agrawal", salutation: "Mr.", phone: "9100000007", language: "hi", address: ["17, Civil Lines", "Opp. Collectorate"], city: "RPR", pincode: "492001", createdDaysAgo: 75, stage: "SUBSIDY_CREDITED", baseUnits: 760, loadW: 6000, phase: "THREE", roof: [9, 8], worker: 0, quoteStatus: "ACCEPTED" },
  ];

  for (const sp of specs) {
    const userId = await authUser(sp.email, sp.name);
    const created = ago(sp.createdDaysAgo, 10);
    await db.user.create({ data: { id: userId, role: "CUSTOMER", name: sp.name, email: sp.email, phone: sp.phone, language: sp.language, createdAt: created } });
    const city = S.cityCodes.find((c) => c.code === sp.city)!;
    const customer = await db.customer.create({
      data: { userId, salutation: sp.salutation, addressLine1: sp.address[0], addressLine2: sp.address[1], city: city.name, state: city.state, pincode: sp.pincode, consentAt: created, createdAt: created },
    });
    const project = await db.project.create({ data: { customerId: customer.id, cityCode: sp.city, createdAt: created, stage: "REGISTERED" } });
    const pid = project.id;
    const target = STAGES.indexOf(sp.stage);
    const reached = (s: Stage) => STAGES.indexOf(s) <= target;
    const stamps: Record<string, string> = { REGISTERED: created.toISOString(), DOCUMENTS: created.toISOString() };
    let t = sp.createdDaysAgo; // days-ago cursor moving forward in time
    const step = (d: number) => {
      t = Math.max(0, t - d);
      return ago(t);
    };

    await event(pid, userId, { type: "PROJECT_CREATED" }, created);
    await event(pid, userId, { type: "STAGE_CHANGED", from: "REGISTERED", to: "DOCUMENTS" }, created);

    // ---- documents
    if (sp.createdDaysAgo > 0) {
      const docs: [string, Buffer][] = [
        ["ELECTRICITY_BILL", files.bill],
        ["AADHAAR", files.aadhaar],
        ["PAN", files.pan],
        ["CANCELLED_CHEQUE", files.cheque],
      ];
      const upAt = step(sp.stage === "DOCUMENTS" ? 1 : 1);
      for (const [type, buf] of docs) {
        const key = `projects/${pid}/documents/${type.toLowerCase()}/${randomUUID()}.jpg`;
        await upload(BUCKETS.documents, key, buf, "image/jpeg");
        const rejected = sp.rejectAadhaar && type === "AADHAAR";
        const pending = sp.partialDocs && type === "PAN";
        await db.document.create({
          data: {
            projectId: pid,
            type: type as "AADHAAR",
            storagePath: key,
            fileName: `${type.toLowerCase()}.jpg`,
            mimeType: "image/jpeg",
            size: buf.length,
            uploaded: true,
            isLatest: true,
            status: rejected ? "REJECTED" : pending ? "PENDING" : "APPROVED",
            rejectionReason: rejected ? "Photo is blurry — please upload a clear copy of the front side" : null,
            uploadedById: userId,
            reviewedById: pending ? null : adminId,
            reviewedAt: pending ? null : upAt,
            extractionStatus: type === "ELECTRICITY_BILL" ? "DONE" : "NOT_APPLICABLE",
            createdAt: upAt,
          },
        });
        await event(pid, userId, { type: "DOCUMENT_UPLOADED", doc: type, version: 1 }, upAt);
        if (rejected) await event(pid, adminId, { type: "DOCUMENT_REJECTED", doc: type, reason: "Photo is blurry — please upload a clear copy of the front side" }, upAt);
        else if (!pending) await event(pid, adminId, { type: "DOCUMENT_APPROVED", doc: type }, upAt);
      }

      const m = months(sp.baseUnits);
      const confirmed = reached("SURVEY");
      await db.billData.create({
        data: {
          projectId: pid,
          serviceNo: `10023${sp.phone.slice(-5)}`,
          consumerName: sp.name.toUpperCase(),
          billAddress: `${sp.address[0]}, ${sp.address[1]}, ${city.name}`,
          tariffCategory: "LV1DL1SR25",
          purpose: "Residential Connection",
          sanctionedLoadW: sp.loadW,
          phase: sp.phase,
          billedUnits: m[0].units,
          netBillAmount: Math.round(m[0].units * 7.2),
          previousReading: 50000,
          currentReading: 50000 + m[0].units,
          existingSolarExport: 0,
          monthlyConsumption: m,
          source: "PARSER",
          confidence: 0.86,
          checks: [
            { code: "READINGS_CONSISTENT", ok: true, critical: true, detail: `50000 + ${m[0].units} ≈ ${50000 + m[0].units}` },
            { code: "MONTHS_CONTINUOUS", ok: true, critical: false, detail: `${m.length} consecutive months` },
            { code: "ENOUGH_MONTHS", ok: true, critical: true, detail: `${m.length} month(s) of consumption` },
          ],
          needsReview: false,
          confirmedByAdmin: confirmed,
          confirmedById: confirmed ? adminId : null,
          confirmedAt: confirmed ? upAt : null,
        },
      });
      await event(pid, null, { type: "BILL_EXTRACTED", source: "PARSER", confidence: 0.86, needsReview: false }, upAt);
      if (confirmed) {
        await event(pid, adminId, { type: "BILL_CONFIRMED" }, upAt);
        stamps.SURVEY = step(0.2).toISOString();
        await event(pid, adminId, { type: "STAGE_CHANGED", from: "DOCUMENTS", to: "SURVEY" }, new Date(stamps.SURVEY));
      }
    }

    // ---- survey
    if (reached("SURVEY")) {
      const workerId = who.workers[sp.worker];
      const workerName = sp.worker === 0 ? "Ravi Kumar Sahu" : "Manoj Patel";
      const scheduledAt = sp.stage === "SURVEY" ? new Date(now.getTime() + DAY + 2 * 3600_000) : step(1);
      await db.project.update({ where: { id: pid }, data: { assignedWorkerId: workerId } });
      await event(pid, adminId, { type: "WORKER_ASSIGNED", worker: workerName, date: scheduledAt.toDateString() }, sp.stage === "SURVEY" ? step(0) : scheduledAt);
      const submitted = reached("QUOTE");
      const survey = await db.survey.create({
        data: {
          projectId: pid,
          workerId,
          scheduledAt,
          status: submitted ? "SUBMITTED" : "SCHEDULED",
          ...(submitted
            ? {
                startedAt: scheduledAt,
                submittedAt: scheduledAt,
                roofLengthM: sp.roof[0],
                roofWidthM: sp.roof[1],
                roofAreaSqm: roofAreaSqm(sp.roof[0], sp.roof[1]),
                roofType: "RCC",
                buildingHeightM: 7,
                southShadowFree: true,
                roofToMeterVerticalM: 7,
                roofToMeterHorizontalM: 6,
                panelToInverterVerticalM: 4,
                panelToInverterHorizontalM: 6,
                inverterToMeterM: 5,
                phaseObserved: sp.phase,
                lat: sp.city === "DEL" ? 28.4231 : 21.2514,
                lng: sp.city === "DEL" ? 77.0545 : 81.6296,
                gpsAccuracy: 6,
                gpsCapturedAt: scheduledAt,
              }
            : {}),
        },
      });
      if (submitted) {
        for (const [kind, buf] of [
          ["SURVEY_ROOF", files.rooftop],
          ["SURVEY_SHADOW", files.shadow],
        ] as const) {
          const key = `projects/${pid}/photos/${kind.toLowerCase()}/${randomUUID()}.jpg`;
          await upload(BUCKETS.photos, key, buf, "image/jpeg");
          await db.photo.create({
            data: {
              projectId: pid,
              surveyId: survey.id,
              kind,
              storagePath: key,
              mimeType: "image/jpeg",
              size: buf.length,
              uploaded: true,
              lat: kind === "SURVEY_ROOF" ? survey.lat : null,
              lng: kind === "SURVEY_ROOF" ? survey.lng : null,
              accuracy: kind === "SURVEY_ROOF" ? 6 : null,
              takenAt: scheduledAt,
              uploadedById: workerId,
            },
          });
        }
        await event(pid, workerId, { type: "SURVEY_STARTED", worker: workerName }, scheduledAt);
        await event(pid, workerId, { type: "SURVEY_SUBMITTED", worker: workerName }, scheduledAt);
        stamps.QUOTE = scheduledAt.toISOString();
        await event(pid, workerId, { type: "STAGE_CHANGED", from: "SURVEY", to: "QUOTE" }, scheduledAt);
      }
    }

    // ---- quote
    if (reached("QUOTE") && sp.quoteStatus) {
      const bill = await db.billData.findUniqueOrThrow({ where: { projectId: pid } });
      const survey = await db.survey.findUniqueOrThrow({ where: { projectId: pid } });
      const quoteDate = step(0.5);
      const inputs = {
        bill: {
          monthlyConsumption: bill.monthlyConsumption as { month: string; units: number }[],
          sanctionedLoadW: bill.sanctionedLoadW,
          connectedLoadKw: null,
          phase: bill.phase,
          netBillAmount: bill.netBillAmount,
          billedUnits: bill.billedUnits,
        },
        survey: { ...survey, roofAreaSqm: survey.roofAreaSqm },
        overrides: {},
        catalog: CATALOG_SEED,
        slabs: PRICING_SLAB_SEED,
        settings: S,
        quoteDate: sp.quoteStatus === "PENDING_APPROVAL" ? now : quoteDate,
      };
      const q = composeQuote(inputs);
      serial += 1;
      const refNo = formatRefNo(serial, sp.city, inputs.quoteDate);
      const accepted = sp.quoteStatus === "ACCEPTED";
      const pdf = await renderQuotePdf({
        addressee: { salutation: sp.salutation, name: sp.name, line1: sp.address[0], line2: `${sp.address[1]}, ${city.name}, ${city.state}, ${sp.pincode}` },
        refNo,
        quoteDate: inputs.quoteDate,
        validTill: q.validTill,
        systemKw: q.systemKw,
        phase: q.phase,
        lineItems: q.lineItems,
        totalInclGst: q.pricing.totalInclGst,
        totalInWords: amountInWords(q.pricing.totalInclGst),
        basicPerWp: q.pricing.basicPerWp,
        economics: q.economics,
        settings: S,
        draft: !accepted,
      });
      const pdfPath = `projects/${pid}/quotes/${refNo.replaceAll("/", "-")}-v1.pdf`;
      await upload(BUCKETS.quotes, pdfPath, pdf, "application/pdf");
      const quote = await db.quote.create({
        data: {
          projectId: pid,
          refNo,
          version: 1,
          status: sp.quoteStatus,
          quoteDate: inputs.quoteDate,
          validTill: q.validTill,
          systemKw: q.systemKw,
          phase: q.phase,
          panelCount: q.panelCount,
          inputsSnapshot: JSON.parse(JSON.stringify({ ...inputs, quoteDate: inputs.quoteDate.toISOString() })),
          computed: JSON.parse(JSON.stringify({ sizing: q.sizing, pricing: q.pricing, economics: q.economics, cables: q.cables, overridden: q.overridden, panelWattage: q.panelWattage })),
          lineItems: JSON.parse(JSON.stringify(q.lineItems)),
          totalInclGst: q.pricing.totalInclGst,
          pdfPath,
          approvedById: accepted ? adminId : null,
          approvedAt: accepted ? inputs.quoteDate : null,
          sentAt: accepted ? inputs.quoteDate : null,
          acceptedAt: accepted ? step(1) : null,
          acceptedIp: accepted ? "103.21.58.12" : null,
          createdAt: inputs.quoteDate,
        },
      });
      await db.project.update({ where: { id: pid }, data: { systemKw: q.systemKw, phase: q.phase } });
      await event(pid, null, { type: "QUOTE_GENERATED", refNo, version: 1, kw: q.systemKw, total: q.pricing.totalInclGst }, inputs.quoteDate);

      if (accepted) {
        await event(pid, adminId, { type: "QUOTE_APPROVED", refNo, version: 1 }, inputs.quoteDate);
        await event(pid, userId, { type: "QUOTE_ACCEPTED", refNo }, quote.acceptedAt!);
        stamps.ADVANCE_PAYMENT = quote.acceptedAt!.toISOString();
        await event(pid, userId, { type: "STAGE_CHANGED", from: "QUOTE", to: "ADVANCE_PAYMENT" }, quote.acceptedAt!);

        // advance
        const paidAt = step(0.3);
        const viaBank = sp.city === "DEL";
        await db.payment.create({
          data: {
            projectId: pid,
            quoteId: quote.id,
            milestone: "ADVANCE",
            amount: q.pricing.advanceAmount,
            method: viaBank ? "BANK_TRANSFER" : "RAZORPAY",
            status: viaBank ? "VERIFIED" : "PAID",
            razorpayOrderId: viaBank ? null : `order_demo${randomUUID().slice(0, 8)}`,
            razorpayPaymentId: viaBank ? null : `pay_demo${randomUUID().slice(0, 8)}`,
            utr: viaBank ? `HDFCN${Date.now().toString().slice(-10)}` : null,
            paidAt,
            verifiedAt: viaBank ? paidAt : null,
            verifiedById: viaBank ? adminId : null,
            createdById: userId,
            createdAt: paidAt,
          },
        });
        await event(pid, viaBank ? adminId : userId, { type: "PAYMENT_RECEIVED", milestone: "ADVANCE", amount: q.pricing.advanceAmount, method: viaBank ? "bank transfer" : "Razorpay" }, paidAt);
        stamps.SUBSIDY_APPLICATION = paidAt.toISOString();
        await event(pid, null, { type: "STAGE_CHANGED", from: "ADVANCE_PAYMENT", to: "SUBSIDY_APPLICATION" }, paidAt);
        await db.project.update({ where: { id: pid }, data: { targetCompletionDate: new Date(paidAt.getTime() + S.quote.completionDays * DAY) } });

        if (reached("INSTALLATION")) {
          const at = step(1);
          await db.project.update({ where: { id: pid }, data: { subsidyApplicationNo: `PMSG/${sp.city === "DEL" ? "DL" : "CG"}/2026/${String(serial).padStart(5, "0")}`, subsidyAppliedAt: at } });
          await event(pid, adminId, { type: "SUBSIDY_APPLIED", applicationNo: `PMSG/${sp.city === "DEL" ? "DL" : "CG"}/2026/${String(serial).padStart(5, "0")}` }, at);
          stamps.INSTALLATION = at.toISOString();
          await event(pid, adminId, { type: "STAGE_CHANGED", from: "SUBSIDY_APPLICATION", to: "INSTALLATION" }, at);
          const dispatched = step(1);
          await db.project.update({ where: { id: pid }, data: { materialDispatchedAt: dispatched, materialReceivedAt: step(0.5) } });
          await event(pid, adminId, { type: "MATERIAL_DISPATCHED" }, dispatched);
          await event(pid, who.workers[sp.worker], { type: "MATERIAL_RECEIVED" }, ago(t));
        }

        if (reached("NET_METERING")) {
          const installedAt = step(3);
          for (const [kind, buf] of [
            ["INSTALL_BEFORE", files.before],
            ["INSTALL_AFTER", files.after],
          ] as const) {
            const key = `projects/${pid}/photos/${kind.toLowerCase()}/${randomUUID()}.jpg`;
            await upload(BUCKETS.photos, key, buf, "image/jpeg");
            await db.photo.create({ data: { projectId: pid, kind, storagePath: key, mimeType: "image/jpeg", size: buf.length, uploaded: true, takenAt: installedAt, uploadedById: who.workers[sp.worker] } });
          }
          await db.project.update({ where: { id: pid }, data: { installedAt, installationNotes: "8 modules on RCC roof, south-facing, 15° tilt. Earthing pits done." } });
          await event(pid, who.workers[sp.worker], { type: "INSTALL_PHOTOS_UPLOADED", count: 2 }, installedAt);
          await event(pid, who.workers[sp.worker], { type: "INSTALLED" }, installedAt);
          stamps.NET_METERING = installedAt.toISOString();
          await event(pid, null, { type: "STAGE_CHANGED", from: "INSTALLATION", to: "NET_METERING" }, installedAt);

          const filed = step(2);
          await db.project.update({ where: { id: pid }, data: { netMeteringFiledAt: filed, netMeteringRefNo: "CSPDCL/NM/RPR/2026/0817" } });
          await event(pid, adminId, { type: "NET_METERING_FILED", refNo: "CSPDCL/NM/RPR/2026/0817" }, filed);
          const balAt = step(2);
          await db.payment.create({
            data: {
              projectId: pid,
              quoteId: quote.id,
              milestone: "BALANCE",
              amount: q.pricing.balanceAmount,
              method: "BANK_TRANSFER",
              status: "VERIFIED",
              utr: `SBIN${Date.now().toString().slice(-12)}`,
              paidAt: balAt,
              verifiedAt: balAt,
              verifiedById: adminId,
              createdById: userId,
              createdAt: balAt,
            },
          });
          await event(pid, adminId, { type: "PAYMENT_VERIFIED", milestone: "BALANCE", amount: q.pricing.balanceAmount }, balAt);
          stamps.COMMISSIONED = balAt.toISOString();
          await event(pid, null, { type: "STAGE_CHANGED", from: "NET_METERING", to: "COMMISSIONED" }, balAt);

          const live = step(10);
          await db.project.update({ where: { id: pid }, data: { netMeterInstalledAt: live, commissionedAt: live } });
          await event(pid, adminId, { type: "NET_METER_INSTALLED" }, live);
          stamps.SUBSIDY_CREDITED = live.toISOString();
          await event(pid, adminId, { type: "STAGE_CHANGED", from: "COMMISSIONED", to: "SUBSIDY_CREDITED" }, live);

          if (sp.stage === "SUBSIDY_CREDITED") {
            const credited = step(14);
            const amcEnd = new Date(credited);
            amcEnd.setFullYear(amcEnd.getFullYear() + 5);
            await db.project.update({ where: { id: pid }, data: { subsidyCreditedAt: credited, amcStartDate: credited, amcEndDate: amcEnd, completedAt: credited } });
            await event(pid, adminId, { type: "SUBSIDY_CREDITED" }, credited);
            await event(pid, adminId, { type: "PROJECT_COMPLETED" }, credited);
            const ticket = await db.serviceTicket.create({
              data: { projectId: pid, category: "CLEANING", description: "Panels look dusty after the dust storm. Please schedule a cleaning visit.", createdById: userId, status: "OPEN", createdAt: ago(1) },
            });
            await event(pid, userId, { type: "TICKET_RAISED", category: "cleaning" }, ticket.createdAt);
          }
        }
      } else {
        // awaiting approval
        await db.notification.create({
          data: {
            userId: adminId,
            projectId: pid,
            titleEn: `Quote ${refNo} awaiting approval`,
            titleHi: `कोटेशन ${refNo} मंज़ूरी के लिए`,
            bodyEn: `${q.systemKw} kW · ₹${q.pricing.totalInclGst.toLocaleString("en-IN")} — review the sizing and approve.`,
            bodyHi: `${q.systemKw} किलोवाट — साइज़ जाँचकर मंज़ूरी दें।`,
            href: `/admin/projects/${pid}?tab=quote`,
          },
        });
      }
    }

    const lastStamp = stamps[sp.stage] ? new Date(stamps[sp.stage]) : created;
    await db.project.update({ where: { id: pid }, data: { stage: sp.stage, stageEnteredAt: lastStamp, stageTimestamps: stamps } });
    if (sp.rejectAadhaar) {
      await db.notification.create({
        data: { userId, projectId: pid, titleEn: "Aadhaar card needs to be re-uploaded", titleHi: "आधार कार्ड दोबारा अपलोड करें", bodyEn: "Reason: Photo is blurry — please upload a clear copy of the front side", bodyHi: "कारण: फ़ोटो धुंधली है — सामने की साफ़ कॉपी अपलोड करें", href: "/portal/documents" },
      });
    }
  }
  await db.refCounter.update({ where: { fiscalYear: "2026-2027" }, data: { lastSerial: serial } });

  // Every seeded project must be a state the real state machine could have produced.
  const rows = await db.project.findMany({ include: { ...SNAPSHOT_INCLUDE, customer: { include: { user: true } } } });
  for (const r of rows) {
    const snap = toSnapshot(r);
    const idx = STAGES.indexOf(r.stage);
    for (const s of STAGES.slice(0, idx)) {
      const unmet = exitBlockers(s, snap);
      if (unmet.length) throw new Error(`${r.customer.user.name}: ${s} incomplete (${unmet.join(", ")})`);
    }
    const pending = autoAdvancePath(snap);
    if (pending.length) throw new Error(`${r.customer.user.name}: would auto-advance to ${pending.join(" → ")}`);
  }

  console.log("\nDemo credentials (password for everyone: " + PASSWORD + ")");
  console.log("  Admin   admin.demo@example.com");
  console.log("  Workers ravi.demo@example.com (Hindi), manoj.demo@example.com");
  for (const sp of specs) console.log(`  Customer ${sp.email.padEnd(26)} ${sp.stage}`);
  console.log("\nDone ✓");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
