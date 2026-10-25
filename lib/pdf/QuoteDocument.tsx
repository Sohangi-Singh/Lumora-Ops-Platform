import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import path from "node:path";
import type { ReactNode } from "react";
import type { Settings } from "@/lib/settings/schema";
import { formatDateDMY, formatIndianNumber, istDateParts, ordinalSuffix } from "@/lib/format";
import type { LineItem } from "@/lib/solar/bom";
import type { EconomicsResult } from "@/lib/solar/economics";
import { phaseLabel, type PhaseType } from "@/lib/solar/types";

/**
 * Lumora's techno-commercial proposal, replicating the sample quotation's
 * structure, wording and emphasis, rendered on the new letterhead.
 * Times-metric serif (Tinos) is embedded so every viewer renders it the same.
 */

const FONT_DIR = path.join(process.cwd(), "lib/pdf/fonts");
Font.register({
  family: "Tinos",
  fonts: [
    { src: path.join(FONT_DIR, "tinos-latin-400-normal.woff"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "tinos-latin-700-normal.woff"), fontWeight: 700 },
    { src: path.join(FONT_DIR, "tinos-latin-400-italic.woff"), fontWeight: 400, fontStyle: "italic" },
    { src: path.join(FONT_DIR, "tinos-latin-700-italic.woff"), fontWeight: 700, fontStyle: "italic" },
  ],
});
Font.registerHyphenationCallback((word) => [word]); // never hyphenate names/specs

export const LETTERHEAD_PATH = path.join(process.cwd(), "public/brand/letterhead.jpg");

export type QuotePdfData = {
  addressee: { salutation: string; name: string; line1: string; line2: string };
  refNo: string;
  quoteDate: Date;
  validTill: Date;
  systemKw: number;
  phase: PhaseType;
  lineItems: LineItem[];
  totalInclGst: number;
  totalInWords: string;
  basicPerWp: number;
  economics: EconomicsResult | null;
  settings: Settings;
  letterhead: Buffer;
  draft?: boolean;
};

const BORDER = "0.75pt solid #000";

const s = StyleSheet.create({
  page: { fontFamily: "Tinos", fontSize: 11, lineHeight: 1.25, color: "#000" },
  bg: { position: "absolute", top: 0, left: 0, width: 595.28, height: 841.89 },
  p: { marginBottom: 6 },
  bold: { fontWeight: 700 },
  title: { fontWeight: 700, textDecoration: "underline", fontSize: 12, marginTop: 10, marginBottom: 12 },
  refRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  h: { fontWeight: 700, fontSize: 11.5, marginTop: 10, marginBottom: 8 },
  table: { borderTop: BORDER, borderLeft: BORDER },
  tr: { flexDirection: "row" },
  th: { borderRight: BORDER, borderBottom: BORDER, padding: 4, fontWeight: 700, textAlign: "center" },
  td: { borderRight: BORDER, borderBottom: BORDER, padding: 4 },
  center: { textAlign: "center" },
  bulletRow: { flexDirection: "row", marginBottom: 3, paddingLeft: 14 },
  bullet: { width: 14 },
  watermark: {
    position: "absolute",
    top: 380,
    left: 60,
    fontSize: 56,
    color: "#C6A75E",
    opacity: 0.18,
    transform: "rotate(-30deg)",
    fontWeight: 700,
  },
});

const BOM_COLS = [7, 16, 18, 16, 17, 9, 17]; // % widths: S.No | Description | Specification | Make | Warranty | Unit | Quantity
const OFFER_COLS = [8, 62, 30];

/** Render "**bold**" markers inside a string as nested bold Text. */
function rich(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <Text key={i} style={s.bold}>
        {part.slice(2, -2)}
      </Text>
    ) : (
      <Text key={i}>{part}</Text>
    ),
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <View style={s.bulletRow} wrap={false}>
      <Text style={s.bullet}>•</Text>
      <Text style={{ flex: 1 }}>{children}</Text>
    </View>
  );
}

function Cell({ w, children, style }: { w: number; children: ReactNode; style?: Style }) {
  return <View style={[s.td, { width: `${w}%` }, style ?? {}]}>{typeof children === "string" ? <Text>{rich(children)}</Text> : children}</View>;
}

function ValidTill({ date }: { date: Date }) {
  const { day, month, year } = istDateParts(date);
  const monthName = new Intl.DateTimeFormat("en-IN", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  return (
    <Text style={s.bold}>
      Price quoted valid till {day}
      <Text style={{ fontSize: 7, verticalAlign: "super" }}>{ordinalSuffix(day)}</Text> {monthName} {year}, only
    </Text>
  );
}

export function QuoteDocument(d: QuotePdfData) {
  const m = d.settings.letterhead;
  const kw = Number.isInteger(d.systemKw) ? String(d.systemKw) : d.systemKw.toFixed(2);
  const phase = phaseLabel(d.phase);
  const gst = d.settings.gst;
  const pagePadding = { paddingTop: m.marginTop, paddingBottom: m.marginBottom, paddingLeft: m.marginLeft, paddingRight: m.marginRight };

  const background = (
    <>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt; decorative background */}
      <Image src={d.letterhead} style={s.bg} fixed />
      {d.draft ? (
        <Text style={s.watermark} fixed>
          DRAFT — FOR APPROVAL
        </Text>
      ) : null}
    </>
  );

  return (
    <Document title={`Techno-Commercial Proposal ${d.refNo}`} author="Lumora Solar Private Limited" subject={`${kw} kW On-Grid Rooftop Solar`} creator="Lumora Solar Ops">
      <Page size="A4" style={[s.page, pagePadding]}>
        {background}

        <View style={s.p}>
          <Text>
            {d.addressee.salutation} {d.addressee.name},
          </Text>
          <Text>{d.addressee.line1},</Text>
          <Text>{d.addressee.line2}</Text>
        </View>
        <Text style={[s.p, { marginTop: 6 }]}>Good Day!</Text>

        <Text style={s.title}>
          Techno-Commercial Proposal for {kw} kW On – Grid Roof Top Solar (RTS) Power Plant
        </Text>

        <View style={s.refRow}>
          <Text style={s.bold}>Ref. No.: {d.refNo}</Text>
          <Text>Date: {formatDateDMY(d.quoteDate)}</Text>
        </View>

        <Text style={s.p}>
          Please refer our discussion regarding Supply, Installation, Testing and Commissioning of{" "}
          <Text style={s.bold}>
            {kw} kW, {phase} Phase, On- Grid Roof Top Solar (RTS)
          </Text>
        </Text>

        <Text style={s.h}>Product Technical Details &amp; Bill of Material:</Text>
        <View style={s.table}>
          {/* `fixed` inside the table repeats the header on every page the table spans */}
          <View style={s.tr} fixed>
            {["S. No.", "Description", "Specification", "Make / Standard", "Warranty", "Unit", "Quantity"].map((h, i) => (
              <Text key={h} style={[s.th, { width: `${BOM_COLS[i]}%` }]}>
                {h}
              </Text>
            ))}
          </View>
          {d.lineItems.map((row) => (
            <View key={row.sNo} style={s.tr} wrap={false}>
              <Cell w={BOM_COLS[0]} style={s.center}>
                {String(row.sNo)}
              </Cell>
              <Cell w={BOM_COLS[1]}>{row.description}</Cell>
              <Cell w={BOM_COLS[2]}>{row.specification}</Cell>
              <Cell w={BOM_COLS[3]}>{row.make}</Cell>
              <Cell w={BOM_COLS[4]} style={s.center}>
                {row.warranty}
              </Cell>
              <Cell w={BOM_COLS[5]} style={s.center}>
                {row.unit}
              </Cell>
              <Cell w={BOM_COLS[6]} style={s.center}>
                {row.quantity}
              </Cell>
            </View>
          ))}
        </View>

        <View wrap={false}>
          <Text style={[s.h, { marginTop: 18 }]}>Commercial Offer:</Text>
          <View style={s.table}>
            <View style={s.tr}>
              <Text style={[s.th, { width: `${OFFER_COLS[0]}%` }]}>S. No.</Text>
              <Text style={[s.th, { width: `${OFFER_COLS[1]}%` }]}>Description</Text>
              <Text style={[s.th, { width: `${OFFER_COLS[2]}%` }]}>Amount (INR)</Text>
            </View>
            <View style={s.tr}>
              <Cell w={OFFER_COLS[0]} style={s.center}>
                1
              </Cell>
              <Cell w={OFFER_COLS[1]}>{`Total EPC for Solar Roof Top Solar Power Plant ${kw} **kW**`}</Cell>
              <Cell w={OFFER_COLS[2]} style={s.center}>
                <Text style={s.bold}>{formatIndianNumber(d.totalInclGst)}</Text>
                <Text style={s.bold}>({d.totalInWords})</Text>
              </Cell>
            </View>
            <View style={s.tr}>
              <Cell w={OFFER_COLS[0]} style={s.center}>
                2
              </Cell>
              <Cell w={OFFER_COLS[1]}>
                {`GST **included** as applicable ${gst.goodsRatePct}% on goods (Solar Panel, Inverters **On- Grid** etc.) i.e. ${gst.goodsSharePct} % of contract value`}
              </Cell>
              <Cell w={OFFER_COLS[2]}>{""}</Cell>
            </View>
            <View style={s.tr}>
              <Cell w={OFFER_COLS[0]} style={s.center}>
                3
              </Cell>
              <Cell w={OFFER_COLS[1]}>{`GST **included** as applicable ${gst.servicesRatePct}% on Services i.e. ${gst.servicesSharePct} % of contract value`}</Cell>
              <Cell w={OFFER_COLS[2]}>{""}</Cell>
            </View>
            <View style={s.tr}>
              <Cell w={OFFER_COLS[0]} style={s.center}>
                4
              </Cell>
              <Cell w={OFFER_COLS[1]}>Per Wp cost (Basic)</Cell>
              <Cell w={OFFER_COLS[2]} style={s.center}>
                <Text style={s.bold}>{d.basicPerWp.toFixed(3)}</Text>
              </Cell>
            </View>
          </View>
        </View>

        <View>
          <Text style={[s.h, { marginTop: 18 }]} minPresenceAhead={48}>
            Payment Terms &amp; Condition:
          </Text>
          {d.settings.terms.paymentTerms.map((term, i) => (
            <Bullet key={i}>{rich(term)}</Bullet>
          ))}
          <Bullet>
            <ValidTill date={d.validTill} />
          </Bullet>
        </View>

        <View>
          <Text style={[s.h, { marginTop: 14 }]} minPresenceAhead={48}>
            General Terms &amp; Conditions:
          </Text>
          {d.settings.terms.generalTerms.map((term, i) => (
            <Bullet key={i}>{rich(term)}</Bullet>
          ))}
        </View>

        <View wrap={false}>
          <Text style={[s.h, { marginTop: 14 }]}>
            Lumora Solar Bank Account Details:
          </Text>
          <Bullet>Bank Account Name: {d.settings.bank.accountName}</Bullet>
          <Bullet>Bank Name: {d.settings.bank.bankName}</Bullet>
          <Bullet>Bank Account Number: {d.settings.bank.accountNumber}</Bullet>
          <Bullet>Bank Account Type: {d.settings.bank.accountType}</Bullet>
          <Bullet>IFSC: {d.settings.bank.ifsc}</Bullet>
        </View>

        <View wrap={false} style={{ marginTop: 16, paddingLeft: 28 }}>
          <Text style={{ marginBottom: 14 }}>Thank you for the opportunity to serve you!</Text>
          <Text style={{ marginBottom: 14 }}>Regards,</Text>
          <Text style={{ marginBottom: 22 }}>For, Lumora Solar Private Limited</Text>
          <Text>{d.settings.signatory.name}</Text>
          <Text>({d.settings.signatory.designation})</Text>
          <Text>Contact Number: {d.settings.signatory.phone}</Text>
          <Text>
            E Mail: <Text style={{ color: "#1a4fb5", textDecoration: "underline" }}>{d.settings.signatory.email}</Text>
          </Text>
        </View>
      </Page>

      {d.settings.quote.includeSavingsPage && d.economics ? (
        <Page size="A4" style={[s.page, pagePadding]}>
          {background}
          <SavingsPage kw={kw} e={d.economics} exportTariff={d.settings.economics.exportTariffPerUnit} />
        </Page>
      ) : null}
    </Document>
  );
}

function SavingsPage({ kw, e, exportTariff }: { kw: string; e: EconomicsResult; exportTariff: number }) {
  const row = (label: string, value: string, bold = false) => (
    <View style={s.tr} wrap={false}>
      <Cell w={65}>{label}</Cell>
      <Cell w={35} style={{ textAlign: "right" }}>
        <Text style={bold ? s.bold : {}}>{value}</Text>
      </Cell>
    </View>
  );
  const inr = (n: number) => `Rs. ${formatIndianNumber(n)}`;
  return (
    <View>
      <Text style={s.title}>Your Savings at a Glance – {kw} kW Rooftop Solar</Text>
      <View style={s.table}>
        {row("Expected generation per year", `${formatIndianNumber(e.yearlyGenerationUnits)} units`)}
        {row("Your current consumption per year", `${formatIndianNumber(e.annualConsumptionUnits)} units`)}
        {row(`Electricity bill savings per year (@ Rs. ${e.tariffPerUnit.toFixed(2)}/unit)`, inr(e.yearlyBillSavings))}
        {row(`Surplus export credit per year (@ Rs. ${exportTariff}/unit)`, inr(e.yearlyExportCredit))}
        {row("Total EPC price (incl. GST)", inr(e.grossCost))}
        {row("PM Surya Ghar subsidy – Central", inr(e.centralSubsidy))}
        {row("Subsidy – State", inr(e.stateSubsidy))}
        {row("Net cost after subsidy", inr(e.netCost), true)}
        {row("Simple payback", e.paybackYears ? `${e.paybackYears.toFixed(1)} years` : "—", true)}
        {row(`Estimated savings over ${e.lifetimeYears} years`, inr(e.lifetimeSavings), true)}
      </View>
      <Text style={[s.p, { marginTop: 12, fontSize: 9.5 }]}>
        Subsidy is credited directly to the customer&apos;s bank account by the Central and State Government as applicable. Loan facility is available
        through the PM Surya Ghar portal via your bank. Figures are estimates based on your past consumption and average solar generation.
      </Text>
    </View>
  );
}
