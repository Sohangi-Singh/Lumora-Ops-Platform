-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'WORKER', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('REGISTERED', 'DOCUMENTS', 'SURVEY', 'QUOTE', 'ADVANCE_PAYMENT', 'SUBSIDY_APPLICATION', 'INSTALLATION', 'NET_METERING', 'COMMISSIONED', 'SUBSIDY_CREDITED');

-- CreateEnum
CREATE TYPE "Phase" AS ENUM ('SINGLE', 'THREE');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('ELECTRICITY_BILL', 'CONSUMPTION_HISTORY', 'AADHAAR', 'PAN', 'CANCELLED_CHEQUE', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('NOT_APPLICABLE', 'QUEUED', 'RUNNING', 'DONE', 'NEEDS_REVIEW', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "BillSource" AS ENUM ('AI', 'MANUAL');

-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "RoofType" AS ENUM ('RCC', 'TIN', 'OTHER');

-- CreateEnum
CREATE TYPE "PhotoKind" AS ENUM ('SURVEY_ROOF', 'SURVEY_SHADOW', 'INSTALL_BEFORE', 'INSTALL_AFTER', 'TICKET');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACCEPTED', 'EXPIRED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "PaymentMilestone" AS ENUM ('ADVANCE', 'BALANCE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('RAZORPAY', 'BANK_TRANSFER', 'LOAN');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PAID', 'FAILED', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "salutation" TEXT NOT NULL DEFAULT 'Mr.',
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'Chhattisgarh',
    "pincode" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "consentVersion" TEXT NOT NULL DEFAULT 'dpdp-2026-01',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "assignedWorkerId" UUID,
    "stage" "Stage" NOT NULL DEFAULT 'REGISTERED',
    "stageEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stageTimestamps" JSONB NOT NULL DEFAULT '{}',
    "cityCode" TEXT NOT NULL DEFAULT 'RPR',
    "systemKw" DOUBLE PRECISION,
    "phase" "Phase",
    "targetCompletionDate" TIMESTAMP(3),
    "sizingOverride" JSONB,
    "subsidyApplicationNo" TEXT,
    "subsidyAppliedAt" TIMESTAMP(3),
    "materialDispatchedAt" TIMESTAMP(3),
    "materialReceivedAt" TIMESTAMP(3),
    "installedAt" TIMESTAMP(3),
    "installationNotes" TEXT,
    "netMeteringFiledAt" TIMESTAMP(3),
    "netMeteringRefNo" TEXT,
    "netMeterInstalledAt" TIMESTAMP(3),
    "commissionedAt" TIMESTAMP(3),
    "subsidyCreditedAt" TIMESTAMP(3),
    "amcStartDate" TIMESTAMP(3),
    "amcEndDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploaded" BOOLEAN NOT NULL DEFAULT false,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "uploadedById" UUID NOT NULL,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "extractionStatus" "ExtractionStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "extractionError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillData" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "serviceNo" TEXT,
    "consumerName" TEXT,
    "billAddress" TEXT,
    "tariffCategory" TEXT,
    "purpose" TEXT,
    "sanctionedLoadW" INTEGER,
    "connectedLoadKw" DOUBLE PRECISION,
    "phase" "Phase",
    "currentReading" DOUBLE PRECISION,
    "previousReading" DOUBLE PRECISION,
    "billedUnits" DOUBLE PRECISION,
    "netBillAmount" DOUBLE PRECISION,
    "existingSolarExport" DOUBLE PRECISION,
    "monthlyConsumption" JSONB NOT NULL DEFAULT '[]',
    "source" "BillSource" NOT NULL DEFAULT 'MANUAL',
    "confidence" DOUBLE PRECISION,
    "checks" JSONB NOT NULL DEFAULT '[]',
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "rawExtraction" JSONB,
    "sourceDocumentIds" TEXT[],
    "confirmedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "confirmedById" UUID,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workerId" UUID NOT NULL,
    "status" "SurveyStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "roofLengthM" DOUBLE PRECISION,
    "roofWidthM" DOUBLE PRECISION,
    "roofAreaSqm" DOUBLE PRECISION,
    "southShadowFree" BOOLEAN,
    "shadowNotes" TEXT,
    "buildingHeightM" DOUBLE PRECISION,
    "roofToMeterVerticalM" DOUBLE PRECISION,
    "roofToMeterHorizontalM" DOUBLE PRECISION,
    "panelToInverterVerticalM" DOUBLE PRECISION,
    "panelToInverterHorizontalM" DOUBLE PRECISION,
    "inverterToMeterM" DOUBLE PRECISION,
    "roofType" "RoofType",
    "phaseObserved" "Phase",
    "notes" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "gpsAccuracy" DOUBLE PRECISION,
    "gpsCapturedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "surveyId" TEXT,
    "ticketId" TEXT,
    "kind" "PhotoKind" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploaded" BOOLEAN NOT NULL DEFAULT false,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "takenAt" TIMESTAMP(3),
    "caption" TEXT,
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "specification" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "warranty" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "qtyRule" TEXT NOT NULL,
    "fixedQty" INTEGER,
    "qtyText" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingSlab" (
    "id" TEXT NOT NULL,
    "minKw" DOUBLE PRECISION NOT NULL,
    "maxKw" DOUBLE PRECISION NOT NULL,
    "ratePerKwInclGst" INTEGER NOT NULL,
    "phase" "Phase",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingSlab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" UUID,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "refNo" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "quoteDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTill" TIMESTAMP(3) NOT NULL,
    "systemKw" DOUBLE PRECISION NOT NULL,
    "phase" "Phase" NOT NULL,
    "panelCount" INTEGER NOT NULL,
    "inputsSnapshot" JSONB NOT NULL,
    "computed" JSONB NOT NULL,
    "lineItems" JSONB NOT NULL,
    "totalInclGst" INTEGER NOT NULL,
    "pdfPath" TEXT,
    "overrideReason" TEXT,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "acceptedIp" TEXT,
    "acceptedUserAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "milestone" "PaymentMilestone" NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "utr" TEXT,
    "receiptPath" TEXT,
    "failureReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "verifiedById" UUID,
    "verifiedAt" TIMESTAMP(3),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" UUID,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "messageEn" TEXT NOT NULL,
    "messageHi" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "projectId" TEXT,
    "titleEn" TEXT NOT NULL,
    "titleHi" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "bodyHi" TEXT NOT NULL,
    "href" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceTicket" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" UUID NOT NULL,
    "adminNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefCounter" (
    "fiscalYear" TEXT NOT NULL,
    "lastSerial" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RefCounter_pkey" PRIMARY KEY ("fiscalYear")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" UUID,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "action" TEXT NOT NULL,
    "diff" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_userId_key" ON "Customer"("userId");

-- CreateIndex
CREATE INDEX "Project_stage_idx" ON "Project"("stage");

-- CreateIndex
CREATE INDEX "Project_assignedWorkerId_stage_idx" ON "Project"("assignedWorkerId", "stage");

-- CreateIndex
CREATE INDEX "Project_customerId_idx" ON "Project"("customerId");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storagePath_key" ON "Document"("storagePath");

-- CreateIndex
CREATE INDEX "Document_projectId_type_isLatest_idx" ON "Document"("projectId", "type", "isLatest");

-- CreateIndex
CREATE INDEX "Document_status_uploaded_idx" ON "Document"("status", "uploaded");

-- CreateIndex
CREATE UNIQUE INDEX "BillData_projectId_key" ON "BillData"("projectId");

-- CreateIndex
CREATE INDEX "BillData_serviceNo_idx" ON "BillData"("serviceNo");

-- CreateIndex
CREATE UNIQUE INDEX "Survey_projectId_key" ON "Survey"("projectId");

-- CreateIndex
CREATE INDEX "Survey_workerId_status_scheduledAt_idx" ON "Survey"("workerId", "status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Photo_storagePath_key" ON "Photo"("storagePath");

-- CreateIndex
CREATE INDEX "Photo_projectId_kind_idx" ON "Photo"("projectId", "kind");

-- CreateIndex
CREATE INDEX "PricingSlab_isActive_minKw_idx" ON "PricingSlab"("isActive", "minKw");

-- CreateIndex
CREATE INDEX "Quote_status_idx" ON "Quote"("status");

-- CreateIndex
CREATE INDEX "Quote_refNo_idx" ON "Quote"("refNo");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_projectId_version_key" ON "Quote"("projectId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayOrderId_key" ON "Payment"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayPaymentId_key" ON "Payment"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "Payment_projectId_milestone_status_idx" ON "Payment"("projectId", "milestone", "status");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "ProjectEvent_projectId_createdAt_idx" ON "ProjectEvent"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectEvent_type_idx" ON "ProjectEvent"("type");

-- CreateIndex
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceTicket_projectId_idx" ON "ServiceTicket"("projectId");

-- CreateIndex
CREATE INDEX "ServiceTicket_status_createdAt_idx" ON "ServiceTicket"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_createdAt_idx" ON "AuditLog"("entity", "createdAt");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_assignedWorkerId_fkey" FOREIGN KEY ("assignedWorkerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillData" ADD CONSTRAINT "BillData_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ServiceTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEvent" ADD CONSTRAINT "ProjectEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEvent" ADD CONSTRAINT "ProjectEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTicket" ADD CONSTRAINT "ServiceTicket_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Defence in depth: Supabase exposes the public schema through PostgREST using
-- the anon key. The app only talks to Postgres through Prisma (server-side, as
-- the table owner), so we enable RLS with *no* policies: anon/authenticated
-- roles can read nothing, while the server role is unaffected.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
