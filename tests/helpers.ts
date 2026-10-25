import type { ProjectSnapshot, Stage } from "@/lib/workflow/stateMachine";

export const NOW = new Date("2026-10-20T06:30:00Z"); // 20 Oct 2026, 12:00 IST
export const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);
export const daysFromNow = (d: number) => new Date(NOW.getTime() + d * 86_400_000);

const APPROVED_DOCS: ProjectSnapshot["documents"] = ["ELECTRICITY_BILL", "AADHAAR", "PAN", "CANCELLED_CHEQUE"].map((type) => ({
  type,
  status: "APPROVED",
  uploadedAt: daysAgo(10),
}));

/** Empty snapshot at a stage. */
export function snap(stage: Stage, overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    stage,
    documents: [],
    billConfirmed: false,
    workerAssigned: false,
    survey: null,
    quote: null,
    payments: [],
    subsidyApplicationNo: null,
    materialDispatchedAt: null,
    installedAt: null,
    installationPhotoCount: 0,
    netMeteringFiledAt: null,
    netMeterInstalledAt: null,
    subsidyCreditedAt: null,
    stageEnteredAt: daysAgo(1),
    ...overrides,
  };
}

/** A snapshot where every exit condition up to and including `stage` holds. */
export function completedThrough(stage: Stage, overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  const order: Stage[] = [
    "REGISTERED",
    "DOCUMENTS",
    "SURVEY",
    "QUOTE",
    "ADVANCE_PAYMENT",
    "SUBSIDY_APPLICATION",
    "INSTALLATION",
    "NET_METERING",
    "COMMISSIONED",
    "SUBSIDY_CREDITED",
  ];
  const upto = order.indexOf(stage);
  const s = snap(stage);
  if (upto >= 1) Object.assign(s, { documents: APPROVED_DOCS, billConfirmed: true });
  if (upto >= 2)
    Object.assign(s, { workerAssigned: true, survey: { status: "SUBMITTED", scheduledAt: daysAgo(8), hasGeoPhoto: true } });
  if (upto >= 3)
    Object.assign(s, { quote: { status: "ACCEPTED", validTill: daysFromNow(3), acceptedAt: daysAgo(1), createdAt: daysAgo(3) } });
  if (upto >= 4) s.payments = [{ milestone: "ADVANCE", status: "PAID" }];
  if (upto >= 5) s.subsidyApplicationNo = "PMSG/CG/2026/0001";
  if (upto >= 6) Object.assign(s, { materialDispatchedAt: daysAgo(5), installedAt: daysAgo(2), installationPhotoCount: 2 });
  if (upto >= 7) {
    s.netMeteringFiledAt = daysAgo(1);
    s.payments = [...s.payments, { milestone: "BALANCE", status: "VERIFIED" }];
  }
  if (upto >= 8) s.netMeterInstalledAt = daysAgo(1);
  if (upto >= 9) s.subsidyCreditedAt = daysAgo(0);
  return { ...s, ...overrides };
}
