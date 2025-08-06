import { serveFile } from "@std/http/file-server";
import { parse } from "@std/csv/parse";
import { PDFDocument, StandardFonts } from "pdf-lib";

const INCHES_IN_PTS = 72; // 1" = 72 point
const PAGE_WIDTH = 4 * INCHES_IN_PTS; // 4" in points
const PAGE_HEIGHT = 6 * INCHES_IN_PTS; // 6" in points
const LEFT_MARGIN = 0.25 * INCHES_IN_PTS; // 0.25" margin on left side (right side is same)

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

  const date = formData.get("date");
  if (typeof date !== "string" || !date) {
    return new Response("Bad Request", { status: 400 });
  }
  const dateStr = new Date(date).toLocaleDateString("en-AU");

  const includeProduct = formData.get("include-product") === "on";

  const csvStr = await file.text();
  const stops = parse(csvStr, { skipFirstRow: true });
  const stopsByDriver = Object.groupBy(stops, (stop) => stop.driver);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Courier);
  for (const stop of stops) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.setFontSize(12);
    page.setLineHeight(72 * 0.25);
    const totalStops = stopsByDriver[stop.driver]?.length || 0;
    const lines = [
      stop.recipient_name,
      stop.address,
      stop.recipient_phone,
      " ",
      `Sender: ${stop.seller_name}`,
      `Notes: ${stop.notes}`,
      " ",
      `Date: ${dateStr}`,
      `Order: ${stop.stop_number} of ${totalStops}`,
      `Driver: ${stop.driver}`,
      includeProduct ? `Product: ${stop.products}` : "",
    ];

    page.drawText(
      lines.join("\n"),
      {
        font,
        x: LEFT_MARGIN,
        y: PAGE_HEIGHT - 0.5 * INCHES_IN_PTS,
        maxWidth: PAGE_WIDTH - LEFT_MARGIN * 2,
      },
    );
  }
  const labelsPdf = await pdfDoc.save();

  return new Response(labelsPdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${
        file.name.slice(0, -4)
      }.pdf"`,
    },
  });
}

export default {
  fetch: handler,
} as Deno.ServeDefaultExport;
