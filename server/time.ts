const tz = process.env.TIMEZONE || "Europe/Amsterdam";
// Validated because it's also used inside SQL.
if (!/^[A-Za-z_]+(\/[A-Za-z_+-]+)*$/.test(tz)) throw new Error(`TIMEZONE "${tz}" isn't a valid IANA time zone.`);
export const TIMEZONE = tz;

/** Today's date in the CRM's timezone, as YYYY-MM-DD. */
export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Adds days to a YYYY-MM-DD date. */
export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonths(iso: string, months: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Local wall-clock parts in the CRM's timezone. */
export function localParts(now = new Date()): { weekday: number; hhmm: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { weekday, hhmm: `${get("hour")}:${get("minute")}` };
}
