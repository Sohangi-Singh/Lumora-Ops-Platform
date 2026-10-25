import { formatINR } from "@/lib/format";
import { DOC_LABELS, MILESTONE_LABELS, STAGE_LABELS } from "./labels";
import type { Stage } from "./stateMachine";

/**
 * Every state change writes one ProjectEvent with its message rendered in
 * both languages at write time, so the timeline and audit log read naturally
 * in English and Hindi and never change retroactively.
 */
export type EventSpec =
  | { type: "PROJECT_CREATED" }
  | { type: "STAGE_CHANGED"; from: Stage; to: Stage }
  | { type: "PROJECT_COMPLETED" }
  | { type: "DOCUMENT_UPLOADED"; doc: string; version: number }
  | { type: "DOCUMENT_APPROVED"; doc: string }
  | { type: "DOCUMENT_REJECTED"; doc: string; reason: string }
  | { type: "DOCUMENT_VIEWED"; doc: string; viewer: string }
  | { type: "BILL_EXTRACTED"; source: string; confidence: number | null; needsReview: boolean }
  | { type: "BILL_EXTRACTION_FAILED"; error: string }
  | { type: "BILL_CONFIRMED" }
  | { type: "WORKER_ASSIGNED"; worker: string; date: string }
  | { type: "SURVEY_STARTED"; worker: string }
  | { type: "SURVEY_SUBMITTED"; worker: string }
  | { type: "QUOTE_GENERATED"; refNo: string; version: number; kw: number; total: number }
  | { type: "QUOTE_APPROVED"; refNo: string; version: number }
  | { type: "QUOTE_ACCEPTED"; refNo: string }
  | { type: "QUOTE_EXPIRED"; refNo: string }
  | { type: "QUOTE_REVISION_REQUESTED" }
  | { type: "SIZING_OVERRIDDEN"; kw: number; reason: string }
  | { type: "PAYMENT_RECEIVED"; milestone: "ADVANCE" | "BALANCE"; amount: number; method: string }
  | { type: "PAYMENT_FAILED"; milestone: "ADVANCE" | "BALANCE"; reason: string }
  | { type: "PAYMENT_SUBMITTED"; milestone: "ADVANCE" | "BALANCE"; amount: number; utr: string }
  | { type: "PAYMENT_VERIFIED"; milestone: "ADVANCE" | "BALANCE"; amount: number }
  | { type: "PAYMENT_REJECTED"; milestone: "ADVANCE" | "BALANCE"; reason: string }
  | { type: "SUBSIDY_APPLIED"; applicationNo: string }
  | { type: "MATERIAL_DISPATCHED" }
  | { type: "MATERIAL_RECEIVED" }
  | { type: "INSTALLED" }
  | { type: "INSTALL_PHOTOS_UPLOADED"; count: number }
  | { type: "NET_METERING_FILED"; refNo: string }
  | { type: "NET_METER_INSTALLED" }
  | { type: "SUBSIDY_CREDITED" }
  | { type: "TICKET_RAISED"; category: string }
  | { type: "TICKET_UPDATED"; status: string };

const doc = (k: string) => DOC_LABELS[k] ?? { en: k, hi: k };

export function renderEvent(e: EventSpec): { en: string; hi: string; internal: boolean } {
  const m = (en: string, hi: string, internal = false) => ({ en, hi, internal });
  switch (e.type) {
    case "PROJECT_CREATED":
      return m("Account created and solar project started", "खाता बना और सोलर प्रोजेक्ट शुरू हुआ");
    case "STAGE_CHANGED":
      return m(`Moved to ${STAGE_LABELS[e.to].en}`, `${STAGE_LABELS[e.to].hi} चरण शुरू हुआ`);
    case "PROJECT_COMPLETED":
      return m("Project complete — 5-year AMC has started", "प्रोजेक्ट पूरा हुआ — 5 साल का AMC शुरू हो गया");
    case "DOCUMENT_UPLOADED":
      return m(
        `${doc(e.doc).en} uploaded${e.version > 1 ? ` (version ${e.version})` : ""}`,
        `${doc(e.doc).hi} अपलोड हुआ${e.version > 1 ? ` (संस्करण ${e.version})` : ""}`,
      );
    case "DOCUMENT_APPROVED":
      return m(`${doc(e.doc).en} approved`, `${doc(e.doc).hi} स्वीकृत हुआ`);
    case "DOCUMENT_REJECTED":
      return m(`${doc(e.doc).en} rejected: ${e.reason}`, `${doc(e.doc).hi} अस्वीकार हुआ: ${e.reason}`);
    case "DOCUMENT_VIEWED":
      return m(`${doc(e.doc).en} viewed by ${e.viewer}`, `${doc(e.doc).hi} ${e.viewer} ने देखा`, true);
    case "BILL_EXTRACTED":
      return m(
        `Bill data read automatically (${e.source}${e.confidence !== null ? `, ${Math.round(e.confidence * 100)}% confidence` : ""})${e.needsReview ? " — needs review" : ""}`,
        `बिल की जानकारी अपने-आप पढ़ी गई${e.needsReview ? " — जाँच ज़रूरी" : ""}`,
        true,
      );
    case "BILL_EXTRACTION_FAILED":
      return m(`Automatic bill reading failed: ${e.error}. Manual entry needed.`, "बिल अपने-आप नहीं पढ़ा जा सका, हाथ से भरना होगा", true);
    case "BILL_CONFIRMED":
      return m("Electricity bill details confirmed", "बिजली बिल की जानकारी पक्की हुई");
    case "WORKER_ASSIGNED":
      return m(`Site survey scheduled for ${e.date} with ${e.worker}`, `साइट सर्वे ${e.date} को तय हुआ — ${e.worker} आएंगे`);
    case "SURVEY_STARTED":
      return m(`${e.worker} started the site survey`, `${e.worker} ने साइट सर्वे शुरू किया`);
    case "SURVEY_SUBMITTED":
      return m(`Site survey completed by ${e.worker}`, `${e.worker} ने साइट सर्वे पूरा किया`);
    case "QUOTE_GENERATED":
      return m(
        `Quotation ${e.refNo} v${e.version} generated: ${e.kw} kW, ${formatINR(e.total)} — awaiting approval`,
        `कोटेशन ${e.refNo} तैयार हुआ: ${e.kw} किलोवाट, ${formatINR(e.total)} — मंज़ूरी बाकी`,
        true,
      );
    case "QUOTE_APPROVED":
      return m(`Your quotation ${e.refNo} is ready`, `आपका कोटेशन ${e.refNo} तैयार है`);
    case "QUOTE_ACCEPTED":
      return m(`Quotation ${e.refNo} accepted`, `कोटेशन ${e.refNo} स्वीकार किया गया`);
    case "QUOTE_EXPIRED":
      return m(`Quotation ${e.refNo} expired`, `कोटेशन ${e.refNo} की वैधता खत्म हो गई`);
    case "QUOTE_REVISION_REQUESTED":
      return m("Revised quotation requested", "नया कोटेशन माँगा गया");
    case "SIZING_OVERRIDDEN":
      return m(`System size set to ${e.kw} kW: ${e.reason}`, `सिस्टम साइज़ ${e.kw} किलोवाट किया गया: ${e.reason}`, true);
    case "PAYMENT_RECEIVED":
      return m(
        `${MILESTONE_LABELS[e.milestone].en} of ${formatINR(e.amount)} received (${e.method})`,
        `${MILESTONE_LABELS[e.milestone].hi} ${formatINR(e.amount)} प्राप्त हुआ`,
      );
    case "PAYMENT_FAILED":
      return m(`${MILESTONE_LABELS[e.milestone].en} payment failed: ${e.reason}`, `${MILESTONE_LABELS[e.milestone].hi} भुगतान असफल रहा`);
    case "PAYMENT_SUBMITTED":
      return m(
        `${MILESTONE_LABELS[e.milestone].en} of ${formatINR(e.amount)} reported (UTR ${e.utr}) — under verification`,
        `${MILESTONE_LABELS[e.milestone].hi} ${formatINR(e.amount)} की जानकारी मिली (UTR ${e.utr}) — जाँच जारी`,
      );
    case "PAYMENT_VERIFIED":
      return m(`${MILESTONE_LABELS[e.milestone].en} of ${formatINR(e.amount)} verified`, `${MILESTONE_LABELS[e.milestone].hi} ${formatINR(e.amount)} की पुष्टि हुई`);
    case "PAYMENT_REJECTED":
      return m(`${MILESTONE_LABELS[e.milestone].en} could not be verified: ${e.reason}`, `${MILESTONE_LABELS[e.milestone].hi} की पुष्टि नहीं हो सकी: ${e.reason}`);
    case "SUBSIDY_APPLIED":
      return m(`PM Surya Ghar subsidy application filed (No. ${e.applicationNo})`, `पीएम सूर्य घर सब्सिडी का आवेदन हुआ (क्रमांक ${e.applicationNo})`);
    case "MATERIAL_DISPATCHED":
      return m("Panels, inverter and structure dispatched", "पैनल, इन्वर्टर और स्ट्रक्चर भेज दिए गए");
    case "MATERIAL_RECEIVED":
      return m("Material received at site", "सामान साइट पर पहुँच गया");
    case "INSTALLED":
      return m("Solar plant installed on your roof", "आपकी छत पर सोलर प्लांट लग गया");
    case "INSTALL_PHOTOS_UPLOADED":
      return m(`${e.count} installation photo(s) uploaded`, `इंस्टॉलेशन की ${e.count} फ़ोटो अपलोड हुईं`);
    case "NET_METERING_FILED":
      return m(`Net-metering file submitted to CSPDCL (${e.refNo})`, `CSPDCL में नेट मीटरिंग फ़ाइल जमा हुई (${e.refNo})`);
    case "NET_METER_INSTALLED":
      return m("Net meter installed — your plant is live!", "नेट मीटर लग गया — आपका प्लांट चालू है!");
    case "SUBSIDY_CREDITED":
      return m("Subsidy credited to your bank account", "सब्सिडी आपके बैंक खाते में आ गई");
    case "TICKET_RAISED":
      return m(`Service request raised: ${e.category}`, `सर्विस अनुरोध दर्ज हुआ: ${e.category}`);
    case "TICKET_UPDATED":
      return m(`Service request ${e.status.toLowerCase().replace("_", " ")}`, `सर्विस अनुरोध की स्थिति: ${e.status}`);
  }
}

/** Customer-facing notification text for events that should ping someone. */
export const STAGE_NOTIFICATION: Partial<Record<Stage, { titleEn: string; titleHi: string; bodyEn: string; bodyHi: string; href: string }>> = {
  SURVEY: {
    titleEn: "Documents verified",
    titleHi: "दस्तावेज़ सत्यापित हुए",
    bodyEn: "All your documents are approved. We'll schedule your site survey next.",
    bodyHi: "आपके सभी दस्तावेज़ स्वीकृत हो गए। अब हम आपका साइट सर्वे तय करेंगे।",
    href: "/portal",
  },
  ADVANCE_PAYMENT: {
    titleEn: "Quotation accepted",
    titleHi: "कोटेशन स्वीकार हुआ",
    bodyEn: "Pay the 90% advance to confirm your order.",
    bodyHi: "ऑर्डर पक्का करने के लिए 90% अग्रिम भुगतान करें।",
    href: "/portal/payments",
  },
  SUBSIDY_APPLICATION: {
    titleEn: "Advance received — thank you!",
    titleHi: "अग्रिम भुगतान मिल गया — धन्यवाद!",
    bodyEn: "We're filing your PM Surya Ghar subsidy application and ordering material.",
    bodyHi: "हम आपकी पीएम सूर्य घर सब्सिडी का आवेदन कर रहे हैं और सामान मंगा रहे हैं।",
    href: "/portal",
  },
  INSTALLATION: {
    titleEn: "Subsidy application filed",
    titleHi: "सब्सिडी आवेदन हो गया",
    bodyEn: "Installation is next. Our team will contact you before the visit.",
    bodyHi: "अब इंस्टॉलेशन होगा। टीम आने से पहले आपसे संपर्क करेगी।",
    href: "/portal",
  },
  NET_METERING: {
    titleEn: "Installation complete",
    titleHi: "इंस्टॉलेशन पूरा हुआ",
    bodyEn: "We're filing for net metering with CSPDCL.",
    bodyHi: "हम CSPDCL में नेट मीटरिंग की फ़ाइल लगा रहे हैं।",
    href: "/portal",
  },
  COMMISSIONED: {
    titleEn: "Balance received",
    titleHi: "बाकी भुगतान मिल गया",
    bodyEn: "Waiting for CSPDCL to install the net meter.",
    bodyHi: "अब CSPDCL नेट मीटर लगाएगा।",
    href: "/portal",
  },
  SUBSIDY_CREDITED: {
    titleEn: "Your plant is live!",
    titleHi: "आपका प्लांट चालू है!",
    bodyEn: "The net meter is installed. The subsidy will be credited to your bank account.",
    bodyHi: "नेट मीटर लग गया है। सब्सिडी आपके बैंक खाते में आएगी।",
    href: "/portal",
  },
};
