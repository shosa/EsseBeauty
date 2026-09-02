import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const fraunces_bytes = readFileSync(join(moduleDir, "..", "assets", "fonts", "Fraunces-Variable.ttf"));

const ink = rgb(0.141, 0.102, 0.125);
const inkSoft = rgb(0.361, 0.310, 0.329);
const muted = rgb(0.541, 0.490, 0.510);
const border = rgb(0.910, 0.875, 0.894);
const borderStrong = rgb(0.851, 0.788, 0.808);
const brand = rgb(0.475, 0.184, 0.349);
const white = rgb(1, 1, 1);

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN = 40;

export interface AccountingPdfSnapshot {
  expenses: {
    categories: Array<{ category: string; count: number; total_cents: number }>;
  };
  operators: Array<{ count: number; name: string; total_cents: number }>;
  payments: Array<{ amount_cents: number; method: string }>;
  salon_name: string;
  sales: {
    summary: { discount_cents: number };
  };
  summary: { expense_total_cents: number; gross_margin_cents: number; revenue_cents: number };
}

const paymentMethodLabels: Record<string, string> = {
  bank_transfer: "Bonifico",
  card: "Carta",
  cash: "Contanti",
  other: "Altro",
  voucher: "Voucher",
};

function euro(cents: number) {
  return (cents / 100).toLocaleString("it-IT", { currency: "EUR", style: "currency" });
}

interface Fonts { display: PDFFont; mono: PDFFont; monoBold: PDFFont; sans: PDFFont; sansBold: PDFFont; }

function textWidth(font: PDFFont, text: string, size: number) {
  return font.widthOfTextAtSize(text, size);
}

function drawRow(page: PDFPage, fonts: Fonts, options: { label: string; separator?: "dashed" | "solid"; size?: number; value: string; width: number; x: number; y: number }) {
  const size = options.size ?? 9.5;
  page.drawText(options.label, { color: inkSoft, font: fonts.sans, size, x: options.x, y: options.y });
  const valueWidth = textWidth(fonts.mono, options.value, size);
  page.drawText(options.value, { color: ink, font: fonts.mono, size, x: options.x + options.width - valueWidth, y: options.y });
  if (options.separator) {
    page.drawLine({
      color: options.separator === "dashed" ? borderStrong : border,
      dashArray: options.separator === "dashed" ? [2, 2] : undefined,
      end: { x: options.x + options.width, y: options.y - 6 },
      start: { x: options.x, y: options.y - 6 },
      thickness: 0.75,
    });
  }
}

function drawSectionHeader(page: PDFPage, fonts: Fonts, text: string, x: number, y: number) {
  page.drawText(text.toUpperCase(), { color: muted, font: fonts.sansBold, size: 8, x, y });
}

export async function renderAccountingPdf(snapshot: AccountingPdfSnapshot, options: { period?: string; title?: string } = {}) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  pdfDoc.setTitle(options.title ?? "Rapportino contabile");
  pdfDoc.setProducer("EsseBeauty");

  const fonts: Fonts = {
    display: await pdfDoc.embedFont(fraunces_bytes),
    mono: await pdfDoc.embedFont(StandardFonts.Courier),
    monoBold: await pdfDoc.embedFont(StandardFonts.CourierBold),
    sans: await pdfDoc.embedFont(StandardFonts.Helvetica),
    sansBold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };

  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawRectangle({ color: white, height: PAGE_HEIGHT, width: PAGE_WIDTH, x: 0, y: 0 });
  const contentWidth = PAGE_WIDTH - MARGIN * 2;
  let y = PAGE_HEIGHT - MARGIN;

  // Letterhead
  page.drawText(snapshot.salon_name, { color: ink, font: fonts.display, size: 18, x: MARGIN, y: y - 14 });
  const generated = `Generato il ${new Date().toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}`;
  const generatedWidth = textWidth(fonts.sans, generated, 8.5);
  page.drawText(generated, { color: muted, font: fonts.sans, size: 8.5, x: PAGE_WIDTH - MARGIN - generatedWidth, y: y - 10 });
  y -= 24;
  page.drawLine({ color: ink, end: { x: PAGE_WIDTH - MARGIN, y }, start: { x: MARGIN, y }, thickness: 1.4 });
  y -= 30;

  // Title
  const title = options.title ?? "Rapportino contabile";
  page.drawText(title, { color: ink, font: fonts.display, size: 22, x: MARGIN, y });
  y -= 20;
  page.drawText(options.period ?? "", { color: muted, font: fonts.sans, size: 11, x: MARGIN, y });
  y -= 30;

  const columnTop = y;
  const leftX = MARGIN;
  const leftWidth = 340;
  const rightX = MARGIN + 380;
  const rightWidth = contentWidth - 380;

  // Left column: ledger
  let cursor = columnTop;
  drawRow(page, fonts, { label: "Incassato", separator: "dashed", value: euro(snapshot.summary.revenue_cents), width: leftWidth, x: leftX, y: cursor });
  cursor -= 24;
  drawRow(page, fonts, { label: "Sconti applicati", separator: "dashed", value: `- ${euro(snapshot.sales.summary.discount_cents)}`, width: leftWidth, x: leftX, y: cursor });
  cursor -= 24;
  drawRow(page, fonts, { label: "Spese registrate", separator: "dashed", value: `- ${euro(snapshot.summary.expense_total_cents)}`, width: leftWidth, x: leftX, y: cursor });
  cursor -= 22;
  page.drawLine({ color: ink, end: { x: leftX + leftWidth, y: cursor }, start: { x: leftX, y: cursor }, thickness: 1.2 });
  cursor -= 22;
  page.drawText("Margine netto", { color: ink, font: fonts.display, size: 14, x: leftX, y: cursor });
  const marginValue = euro(snapshot.summary.gross_margin_cents);
  const marginWidth = textWidth(fonts.monoBold, marginValue, 14);
  page.drawText(marginValue, { color: brand, font: fonts.monoBold, size: 14, x: leftX + leftWidth - marginWidth, y: cursor });
  cursor -= 40;

  page.drawText("Firma responsabile di cassa", { color: muted, font: fonts.sans, size: 8, x: leftX, y: MARGIN + 30 });
  page.drawLine({ color: inkSoft, end: { x: leftX + 180, y: MARGIN + 44 }, start: { x: leftX, y: MARGIN + 44 }, thickness: 0.75 });

  // Right column: breakdown tables
  cursor = columnTop;
  drawSectionHeader(page, fonts, "Metodi di pagamento", rightX, cursor);
  cursor -= 16;
  for (const item of snapshot.payments) {
    drawRow(page, fonts, { label: paymentMethodLabels[item.method] ?? item.method, separator: "solid", value: euro(item.amount_cents), width: rightWidth, x: rightX, y: cursor });
    cursor -= 16;
  }
  cursor -= 10;

  drawSectionHeader(page, fonts, "Spese per categoria", rightX, cursor);
  cursor -= 16;
  const categories = snapshot.expenses.categories.slice(0, 8);
  for (const item of categories) {
    drawRow(page, fonts, { label: `${item.category} (${item.count})`, separator: "solid", value: euro(item.total_cents), width: rightWidth, x: rightX, y: cursor });
    cursor -= 16;
  }
  if (snapshot.expenses.categories.length > categories.length) {
    page.drawText(`+ ${snapshot.expenses.categories.length - categories.length} altre categorie`, { color: muted, font: fonts.sans, size: 8, x: rightX, y: cursor });
    cursor -= 16;
  }
  cursor -= 10;

  drawSectionHeader(page, fonts, "Migliori operatori", rightX, cursor);
  cursor -= 16;
  const operators = snapshot.operators.slice(0, 6);
  for (const item of operators) {
    drawRow(page, fonts, { label: `${item.name} — ${item.count} vendite`, separator: "solid", value: euro(item.total_cents), width: rightWidth, x: rightX, y: cursor });
    cursor -= 16;
  }
  if (snapshot.operators.length > operators.length) {
    page.drawText(`+ ${snapshot.operators.length - operators.length} altri operatori`, { color: muted, font: fonts.sans, size: 8, x: rightX, y: cursor });
    cursor -= 16;
  }

  // Footer
  page.drawLine({ color: border, end: { x: PAGE_WIDTH - MARGIN, y: MARGIN + 18 }, start: { x: MARGIN, y: MARGIN + 18 }, thickness: 0.75 });
  page.drawText("Documento generato automaticamente da EsseBeauty", { color: muted, font: fonts.sans, size: 8.5, x: MARGIN, y: MARGIN });
  const pageLabel = "Pagina 1 di 1";
  const pageLabelWidth = textWidth(fonts.sans, pageLabel, 8.5);
  page.drawText(pageLabel, { color: muted, font: fonts.sans, size: 8.5, x: PAGE_WIDTH - MARGIN - pageLabelWidth, y: MARGIN });

  return Buffer.from(await pdfDoc.save());
}
