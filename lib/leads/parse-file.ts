import ExcelJS from "exceljs";
import Papa from "papaparse";
import { AppError } from "@/lib/errors";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 20_000;
export const MAX_COLUMNS = 50;
const MAX_CELL = 2000;

export type ParsedRow = { rowNumber: number; values: Record<string, string> };
export type ParsedFile = { headers: string[]; rows: ParsedRow[] };

const bad = (msg: string) => new AppError("VALIDATION_ERROR", msg);

function cellToString(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("result" in v) return cellToString(v.result as ExcelJS.CellValue); // formulas: use the computed value, never evaluate
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text);
    return "";
  }
  return String(v);
}

/** Unique, non-empty, trimmed headers. */
function cleanHeaders(raw: string[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((h, i) => {
    const base = h.trim().slice(0, 100) || `Column ${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
}

/** rowNumber is the row's position in the uploaded sheet (header = row 1), so reports match what users see in Excel. */
function toObjects(headers: string[], matrix: string[][]): ParsedRow[] {
  return matrix
    .map((r, i) => ({ r, rowNumber: i + 2 }))
    .filter(({ r }) => r.some((c) => c.trim() !== ""))
    .map(({ r, rowNumber }) => ({ rowNumber, values: Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").slice(0, MAX_CELL)])) }));
}

export async function parseUpload(fileName: string, buf: Buffer): Promise<ParsedFile> {
  const ext = fileName.toLowerCase().split(".").pop();
  let headers: string[];
  let matrix: string[][];

  if (ext === "csv") {
    if (buf.includes(0)) throw bad("This doesn't look like a CSV file.");
    const text = buf.toString("utf8").replace(/^\uFEFF/, "");
    const parsed = Papa.parse<string[]>(text, { header: false, skipEmptyLines: "greedy" });
    const all = parsed.data.map((r) => r.map((c) => String(c ?? "")));
    if (all.length < 2) throw bad("The file needs a header row and at least one data row.");
    headers = cleanHeaders(all[0] ?? []);
    matrix = all.slice(1);
  } else if (ext === "xlsx") {
    if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) throw bad("This doesn't look like a valid .xlsx file.");
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buf as never);
    } catch {
      throw bad("Could not read this Excel file. Re-save it as .xlsx or CSV and try again.");
    }
    const ws = wb.worksheets[0];
    if (!ws || ws.rowCount < 2) throw bad("The first sheet needs a header row and at least one data row.");
    if (ws.rowCount - 1 > MAX_ROWS * 2) throw bad(`Too many rows. The limit is ${MAX_ROWS.toLocaleString("en-IN")} per import.`);
    const cols = Math.min(ws.columnCount, MAX_COLUMNS + 1);
    const read = (r: number) => Array.from({ length: cols }, (_, c) => cellToString(ws.getRow(r).getCell(c + 1).value));
    headers = cleanHeaders(read(1));
    matrix = [];
    for (let r = 2; r <= ws.rowCount; r++) matrix.push(read(r));
  } else {
    throw bad("Upload a .csv or .xlsx file.");
  }

  if (headers.length > MAX_COLUMNS) throw bad(`Too many columns (limit ${MAX_COLUMNS}).`);
  const rows = toObjects(headers, matrix);
  if (rows.length === 0) throw bad("No data rows found.");
  if (rows.length > MAX_ROWS) throw bad(`Too many rows (${rows.length.toLocaleString("en-IN")}). The limit is ${MAX_ROWS.toLocaleString("en-IN")} per import; split the file.`);
  return { headers, rows };
}
