// Renders a sample quote for a fictional customer: npx tsx scripts/render-sample-quote.tsx out.pdf
import { writeFile } from "node:fs/promises";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";
import { renderQuotePdf } from "@/lib/pdf/render";
import { composeQuote } from "@/lib/solar/quote";
import { amountInWords } from "@/lib/solar/amountInWords";
import { CATALOG_SEED, PRICING_SLAB_SEED } from "@/prisma/seed-data";

const MONTHS = ["2026-04", "2026-03", "2026-02", "2026-01", "2025-12", "2025-11", "2025-10"];
const months = [812, 701, 655, 690, 742, 806, 873].map((units, i) => ({ month: MONTHS[i], units }));

async function main() {
  const quoteDate = new Date("2026-10-19T05:00:00Z");
  const q = composeQuote({
    bill: {
      monthlyConsumption: months,
      sanctionedLoadW: null,
      connectedLoadKw: 9.89,
      phase: "THREE",
      netBillAmount: 6200,
      billedUnits: 812,
    },
    survey: {
      roofAreaSqm: 64,
      phaseObserved: "THREE",
      panelToInverterVerticalM: 4,
      panelToInverterHorizontalM: 6,
      inverterToMeterM: 5,
      roofToMeterVerticalM: 7,
      roofToMeterHorizontalM: 4,
    },
    overrides: {},
    catalog: CATALOG_SEED,
    slabs: PRICING_SLAB_SEED,
    settings: {
      ...DEFAULT_SETTINGS,
      quote: { ...DEFAULT_SETTINGS.quote, includeSavingsPage: process.argv.includes("--savings") },
    },
    quoteDate,
  });
  const pdf = await renderQuotePdf({
    addressee: {
      salutation: "Mr.",
      name: "Arjun Mehta",
      line1: "B-12, Green Valley Colony",
      line2: "Shankar Nagar, Raipur, Chhattisgarh, 492007",
    },
    refNo: "0241/RPR/10/2026-2027",
    quoteDate,
    validTill: q.validTill,
    systemKw: q.systemKw,
    phase: q.phase,
    lineItems: q.lineItems,
    totalInclGst: q.pricing.totalInclGst,
    totalInWords: amountInWords(q.pricing.totalInclGst),
    basicPerWp: q.pricing.basicPerWp,
    economics: q.economics,
    settings: {
      ...DEFAULT_SETTINGS,
      quote: { ...DEFAULT_SETTINGS.quote, includeSavingsPage: process.argv.includes("--savings") },
    },
    draft: process.argv.includes("--draft"),
  });
  await writeFile(process.argv[2] ?? "sample-quote.pdf", pdf);
  console.log(
    "kW",
    q.systemKw,
    "total",
    q.pricing.totalInclGst,
    "basic/Wp",
    q.pricing.basicPerWp.toFixed(3),
    "binding",
    q.sizing.binding,
    "bytes",
    pdf.length,
  );
}

void main();
