import type { Stage } from "./stateMachine";

/** Bilingual labels used in stored event/notification text (DB rows, emails). */
export const STAGE_LABELS: Record<Stage, { en: string; hi: string }> = {
  REGISTERED: { en: "Registered", hi: "पंजीकरण" },
  DOCUMENTS: { en: "Documents", hi: "दस्तावेज़" },
  SURVEY: { en: "Site survey", hi: "साइट सर्वे" },
  QUOTE: { en: "Quotation", hi: "कोटेशन" },
  ADVANCE_PAYMENT: { en: "Advance payment", hi: "अग्रिम भुगतान" },
  SUBSIDY_APPLICATION: { en: "Subsidy application", hi: "सब्सिडी आवेदन" },
  INSTALLATION: { en: "Installation", hi: "इंस्टॉलेशन" },
  NET_METERING: { en: "Net metering", hi: "नेट मीटरिंग" },
  COMMISSIONED: { en: "Commissioned", hi: "प्लांट चालू" },
  SUBSIDY_CREDITED: { en: "Subsidy credited", hi: "सब्सिडी जमा" },
};

export const DOC_LABELS: Record<string, { en: string; hi: string }> = {
  ELECTRICITY_BILL: { en: "Electricity bill", hi: "बिजली बिल" },
  CONSUMPTION_HISTORY: { en: "Consumption history", hi: "बिजली खपत का इतिहास" },
  AADHAAR: { en: "Aadhaar card", hi: "आधार कार्ड" },
  PAN: { en: "PAN card", hi: "पैन कार्ड" },
  CANCELLED_CHEQUE: { en: "Cancelled cheque", hi: "कैंसिल चेक" },
  OTHER: { en: "Other document", hi: "अन्य दस्तावेज़" },
};

export const MILESTONE_LABELS: Record<"ADVANCE" | "BALANCE", { en: string; hi: string }> = {
  ADVANCE: { en: "90% advance", hi: "90% अग्रिम" },
  BALANCE: { en: "10% balance", hi: "10% बाकी राशि" },
};
