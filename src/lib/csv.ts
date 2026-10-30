/** One spreadsheet (CSV) cell: quoted when needed, and never read as a formula. */
export function csvCell(value: string | number): string {
  const text = String(value);
  // Stop spreadsheet apps treating a cell as a formula.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Rows of cells as CSV text, one line per row. */
export function toCsv(rows: readonly (readonly (string | number)[])[]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}
