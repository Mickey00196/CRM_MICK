// CSV helpers for exports opened in Excel.

export function csvCell(v: unknown, sep: string): string {
  let s = v == null ? "" : String(v);
  // Stop Excel from running text that looks like a formula (CSV injection).
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s.includes(sep) || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
}
export const dmy = (iso: string | null) => (iso ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}` : "");
