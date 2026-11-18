import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ReportTable } from "./definitions";

const W = 842, H = 595, M = 36, SIZE = 8.5, LINE = 14;

/** Plain, readable table PDF (A4 landscape). Long cells are shortened with an ellipsis. */
export async function tableToPdf(t: ReportTable): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const cols = t.columns, colW = (W - 2 * M) / Math.max(1, cols.length);
  const fit = (s: string, f: typeof font, w: number) => {
    let out = s.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?"); // standard fonts only cover Latin-1
    while (out.length > 1 && f.widthOfTextAtSize(out, SIZE) > w - 6) out = out.slice(0, -2) + "…".replace("…", ".");
    return out;
  };
  let page = pdf.addPage([W, H]), y = H - M;
  const header = () => {
    cols.forEach((c, i) => page.drawText(fit(c.label, bold, colW), { x: M + i * colW, y, size: SIZE, font: bold, color: rgb(0.1, 0.15, 0.25) }));
    y -= LINE;
    page.drawLine({ start: { x: M, y: y + 9 }, end: { x: W - M, y: y + 9 }, thickness: 0.5, color: rgb(0.6, 0.65, 0.75) });
  };
  page.drawText(fit(t.title, bold, W - 2 * M), { x: M, y, size: 14, font: bold }); y -= 18;
  page.drawText(fit(t.subtitle, font, W - 2 * M), { x: M, y, size: 9, font, color: rgb(0.35, 0.4, 0.5) }); y -= 24;
  header();
  for (const row of t.rows) {
    if (y < M + LINE) { page = pdf.addPage([W, H]); y = H - M; header(); }
    cols.forEach((c, i) => page.drawText(fit(String(row[c.key] ?? "—"), font, colW), { x: M + i * colW, y, size: SIZE, font }));
    y -= LINE;
  }
  if (t.rows.length === 0) page.drawText("No data for this period.", { x: M, y, size: 10, font });
  pdf.getPages().forEach((p, i, all) => p.drawText(`Page ${i + 1} of ${all.length}`, { x: W - M - 60, y: 18, size: 8, font }));
  return pdf.save();
}
