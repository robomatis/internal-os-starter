// Server-only quote PDF generation with pdfkit (pure Node, serverless-safe). We embed
// the bundled DejaVuSans TTF so Slovenian glyphs (č/š/ž) render — pdfkit's built-in
// Helvetica is Latin-1 only. Neutral placeholder branding for now; rebrand the header
// block here later. buildQuotePdf collects the document stream into a Buffer in memory.
import "server-only";
import path from "node:path";
import PDFDocument from "pdfkit";

const FONT_DIR = path.join(process.cwd(), "modules", "ponudbe", "assets");
const FONT_REGULAR = path.join(FONT_DIR, "DejaVuSans.ttf");
const FONT_BOLD = path.join(FONT_DIR, "DejaVuSans-Bold.ttf");

export type QuotePdfQuote = {
  customer_name: string | null;
  customer_email: string | null;
  currency: string;
  net_amount: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  created_at: string;
};

export type QuotePdfItem = {
  line_no: number;
  product_name: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  net_amount: number | null;
  tax_rate: number | null;
};

function money(v: number | null, currency: string): string {
  if (v === null || v === undefined) return "—";
  return `${v.toLocaleString("sl-SI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export async function buildQuotePdf(input: {
  quote: QuotePdfQuote;
  items: QuotePdfItem[];
}): Promise<Buffer> {
  const { quote, items } = input;
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("body", FONT_REGULAR);
    doc.registerFont("bold", FONT_BOLD);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const currency = quote.currency || "EUR";

    // --- Header (placeholder branding) ---
    doc.font("bold").fontSize(20).text("[Vaše podjetje]", left, 50);
    doc.font("body").fontSize(9).fillColor("#666");
    doc.text("Naslov podjetja · davčna št. · kontakt", left);
    doc.fillColor("#000");

    doc.font("bold").fontSize(16).text("PONUDBA", left, 50, { align: "right" });
    doc.font("body").fontSize(9).fillColor("#666");
    doc.text(`Datum: ${quote.created_at.slice(0, 10)}`, left, 72, { align: "right" });
    doc.fillColor("#000");

    // --- Customer block ---
    let y = 120;
    doc.font("bold").fontSize(10).text("Stranka", left, y);
    doc.font("body").fontSize(10);
    y += 16;
    doc.text(quote.customer_name ?? "—", left, y);
    if (quote.customer_email) {
      y += 14;
      doc.fillColor("#666").text(quote.customer_email, left, y).fillColor("#000");
    }

    // --- Line-item table ---
    y += 36;
    const cols = {
      no: left,
      name: left + 28,
      qty: right - 230,
      price: right - 150,
      net: right - 70,
    };
    doc.font("bold").fontSize(9);
    doc.text("#", cols.no, y);
    doc.text("Izdelek", cols.name, y);
    doc.text("Kol.", cols.qty, y, { width: 60, align: "right" });
    doc.text("Cena/EM", cols.price, y, { width: 70, align: "right" });
    doc.text("Neto", cols.net, y, { width: 70, align: "right" });
    y += 4;
    doc.moveTo(left, y + 10).lineTo(right, y + 10).strokeColor("#ccc").stroke();
    y += 18;

    doc.font("body").fontSize(9);
    for (const it of items) {
      if (y > doc.page.height - 120) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      const nameWidth = cols.qty - cols.name - 10;
      const nameHeight = doc.heightOfString(it.product_name ?? "—", { width: nameWidth });
      doc.text(String(it.line_no), cols.no, y);
      doc.text(it.product_name ?? "—", cols.name, y, { width: nameWidth });
      doc.text(
        `${it.quantity ?? "—"} ${it.unit ?? ""}`.trim(),
        cols.qty,
        y,
        { width: 60, align: "right" },
      );
      doc.text(money(it.unit_price, currency), cols.price, y, { width: 70, align: "right" });
      doc.text(money(it.net_amount, currency), cols.net, y, { width: 70, align: "right" });
      y += Math.max(nameHeight, 12) + 8;
    }

    // --- Totals ---
    doc.moveTo(left, y).lineTo(right, y).strokeColor("#ccc").stroke();
    y += 12;
    const labelX = right - 230;
    const valX = right - 70;
    const row = (label: string, value: string, bold = false) => {
      doc.font(bold ? "bold" : "body").fontSize(10);
      doc.text(label, labelX, y, { width: 150, align: "right" });
      doc.text(value, valX, y, { width: 70, align: "right" });
      y += 16;
    };
    row("Neto:", money(quote.net_amount, currency));
    row("DDV:", money(quote.tax_amount, currency));
    row("Skupaj:", money(quote.total_amount, currency), true);

    // --- Footer ---
    doc.font("body").fontSize(8).fillColor("#999");
    doc.text(
      "Ponudba je informativne narave. Veljavnost in dobavni rok po dogovoru.",
      left,
      doc.page.height - 70,
      { width: right - left, align: "center" },
    );

    doc.end();
  });
}
