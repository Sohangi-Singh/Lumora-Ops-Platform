import type { Stage } from "./stateMachine";

/** Typical days spent in each stage — shown to customers as an ETA. */
export const STAGE_TYPICAL_DAYS: Record<Stage, number> = {
  REGISTERED: 0,
  DOCUMENTS: 2,
  SURVEY: 3,
  QUOTE: 2,
  ADVANCE_PAYMENT: 3,
  SUBSIDY_APPLICATION: 3,
  INSTALLATION: 10,
  NET_METERING: 15,
  COMMISSIONED: 10,
  SUBSIDY_CREDITED: 30,
};
