// Readable dates for lists. Pure: "today" is passed in, so it's easy to test.

const DAY_MS = 86400_000;

export function isoDiff(a: string, b: string): number {
  return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / DAY_MS);
}

export function isoAdd(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmt(iso: string, opts: Intl.DateTimeFormatOptions): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });
}

/** "Mon 2 Nov", with the year when it isn't this year. */
export function shortDate(iso: string, today: string): string {
  const opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };
  if (iso.slice(0, 4) !== today.slice(0, 4)) opts.year = "numeric";
  return fmt(iso, opts).replace(",", "");
}

/**
 * When a to-do is due, the way you'd say it:
 * "Today", "Tomorrow 10:00", "Thu", "Mon 9 Nov", "Yesterday", "3 days late", "2 weeks late".
 */
export function dueText(due: string | null, time: string | null, today: string): string {
  if (!due) return "";
  const d = isoDiff(today, due);
  const at = time ? ` ${time}` : "";
  if (d === 0) return time ?? "Today";
  if (d === 1) return `Tomorrow${at}`;
  if (d > 1 && d < 7) return fmt(due, { weekday: "short" }) + at;
  if (d >= 7) return shortDate(due, today) + at;
  const late = -d;
  if (late === 1) return "Yesterday";
  if (late < 14) return `${late} days late`;
  if (late < 60) return `${Math.round(late / 7)} weeks late`;
  return `${Math.round(late / 30.44)} months late`;
}
