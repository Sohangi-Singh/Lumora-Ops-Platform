import { renderToBuffer } from "@react-pdf/renderer";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { LETTERHEAD_PATH, QuoteDocument, type QuotePdfData } from "./QuoteDocument";

let letterhead: Buffer | undefined;

export async function loadLetterhead(): Promise<Buffer> {
  letterhead ??= await readFile(LETTERHEAD_PATH);
  return letterhead;
}

export async function renderQuotePdf(data: Omit<QuotePdfData, "letterhead">): Promise<Buffer> {
  const element = createElement(QuoteDocument, { ...data, letterhead: await loadLetterhead() });
  // renderToBuffer's type expects a <Document> element; QuoteDocument returns one.
  return renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
}
