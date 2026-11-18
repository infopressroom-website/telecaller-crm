/** Prevents spreadsheet formula injection (=, +, -, @) when exporting user-supplied text. */
export function escapeCsvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}
