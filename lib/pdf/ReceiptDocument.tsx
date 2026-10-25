import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Settings } from "@/lib/settings/schema";
import { formatDateDMY, formatIndianNumber } from "@/lib/format";
import { amountInWords } from "@/lib/solar/amountInWords";
import "./QuoteDocument"; // registers the Tinos font family

export type ReceiptData = {
  receiptNo: string;
  date: Date;
  customer: { salutation: string; name: string; address: string };
  quoteRef: string;
  milestoneLabel: string;
  amount: number;
  method: string;
  reference: string;
  settings: Settings;
  letterhead: Buffer;
};

const s = StyleSheet.create({
  page: { fontFamily: "Tinos", fontSize: 11, lineHeight: 1.35 },
  bg: { position: "absolute", top: 0, left: 0, width: 595.28, height: 841.89 },
  title: { fontSize: 15, fontWeight: 700, textAlign: "center", textDecoration: "underline", marginBottom: 18 },
  row: { flexDirection: "row", borderBottom: "0.5pt solid #999", paddingVertical: 6 },
  k: { width: "38%", color: "#333" },
  v: { width: "62%", fontWeight: 700 },
});

export function ReceiptDocument(d: ReceiptData) {
  const m = d.settings.letterhead;
  const rows: [string, string][] = [
    ["Receipt No.", d.receiptNo],
    ["Date", formatDateDMY(d.date)],
    ["Received from", `${d.customer.salutation} ${d.customer.name}`],
    ["Address", d.customer.address],
    ["Against quotation", d.quoteRef],
    ["Towards", d.milestoneLabel],
    ["Amount (INR)", `${formatIndianNumber(d.amount)} (${amountInWords(d.amount)})`],
    ["Payment mode", d.method],
    ["Transaction reference", d.reference],
  ];
  return (
    <Document title={`Payment Receipt ${d.receiptNo}`} author="Lumora Solar Private Limited">
      <Page size="A4" style={[s.page, { paddingTop: m.marginTop + 10, paddingBottom: m.marginBottom, paddingLeft: m.marginLeft, paddingRight: m.marginRight }]}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- decorative letterhead */}
        <Image src={d.letterhead} style={s.bg} fixed />
        <Text style={s.title}>Payment Receipt</Text>
        {rows.map(([k, v]) => (
          <View key={k} style={s.row}>
            <Text style={s.k}>{k}</Text>
            <Text style={s.v}>{v}</Text>
          </View>
        ))}
        <Text style={{ marginTop: 28 }}>This is a computer-generated receipt and does not require a signature.</Text>
        <Text style={{ marginTop: 28 }}>For, Lumora Solar Private Limited</Text>
        <Text style={{ marginTop: 18 }}>{d.settings.signatory.name}</Text>
        <Text>({d.settings.signatory.designation})</Text>
      </Page>
    </Document>
  );
}
