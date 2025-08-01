import { serveFile } from "@std/http/file-server";
import { parse } from "@std/csv/parse";
import { PDFDocument, StandardFonts } from "pdf-lib";

const INCH_POINTS = 72; // 1" = 72 point
const PAGE_WIDTH = 4 * INCH_POINTS; // 4" in points
const PAGE_HEIGHT = 6 * INCH_POINTS; // 6" in points
const TOP_MARGIN = 0.5 * INCH_POINTS; // 0.5" margin from the top

async function toLabels(csv: string): Promise<Uint8Array> {
  const rows = parse(csv, { skipFirstRow: true });
  const pdfDoc = await PDFDocument.create();
  const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);

  for (const row of rows) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.setFontSize(12);
    page.setLineHeight(72 * 0.25);
    const lines = [
      row.recipient_name,
      row.address,
      row.recipient_phone,
      " ",
      `Sender: ${row.seller_name}`,
      `Notes: ${row.notes}`,
      " ",
      `Date: ${new Date().toLocaleDateString("en-AU")}`,
      `Order: ${row.stop_number} of ${rows.length}`,
      `Driver: ${row.driver}`,
    ];

    page.drawText(
      lines.join("\n"),
      {
        font: courierFont,
        x: INCH_POINTS * 0.25, // 0.25" left margin
        y: PAGE_HEIGHT - TOP_MARGIN, // 0.25" from the top
        maxWidth: PAGE_WIDTH - INCH_POINTS * 0.5, // 0.5" margin on each side
      },
    );
  }

  return pdfDoc.save();
}

async function handler(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname !== "/") {
    return new Response("Not Found", { status: 404 });
  }

  if (request.method === "GET") {
    return serveFile(request, "./index.html");
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return new Response("Bad Request", { status: 400 });
  }
  const labels = await toLabels(await file.text());

  return new Response(labels, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="labels.pdf"',
    },
  });
}

export default {
  fetch: handler,
} as Deno.ServeDefaultExport;
