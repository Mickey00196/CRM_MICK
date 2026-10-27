let TZ = "Europe/Amsterdam";

/** Uses the server's time zone so dates match what the server considers "today". */
export function setTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    TZ = tz;
  } catch {
    /* unknown zone: keep the default */
  }
}
const nl = new Intl.NumberFormat("nl-NL");
const eur = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** Local calendar date as YYYY-MM-DD. */
export function todayISO(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Moves a weekend date to the Monday after. */
export function workday(iso: string): string {
  const day = new Date(iso + "T12:00:00Z").getUTCDay();
  return day === 6 ? addDays(iso, 2) : day === 0 ? addDays(iso, 1) : iso;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400_000);
}

/** dd-mm-yyyy */
export function dmy(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = iso.length > 10 ? todayISO(new Date(iso)) : iso;
  return `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;
}

/** dd-mm-yyyy HH:mm for timestamps. */
export function dmyTime(ts: string): string {
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ts));
  return `${dmy(ts)} ${time}`;
}

export function longDate(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
}

export function m2(n: number | null | undefined): string {
  return n == null ? "" : `${nl.format(n)} m²`;
}

export function num(n: number | null | undefined): string {
  return n == null ? "" : nl.format(n);
}

export function money(n: number | null | undefined): string {
  return n == null ? "" : eur.format(n);
}

/** "in 14 months", "in 3 weeks", "2 months ago". */
export function relative(iso: string, today = todayISO()): string {
  const d = daysBetween(today, iso.slice(0, 10));
  const abs = Math.abs(d);
  const unit = abs < 14 ? [abs, "day"] : abs < 60 ? [Math.round(abs / 7), "week"] : abs < 730 ? [Math.round(abs / 30.44), "month"] : [Math.round(abs / 365.25 * 10) / 10, "year"];
  const s = `${unit[0]} ${unit[1]}${unit[0] === 1 ? "" : "s"}`;
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === -1) return "yesterday";
  return d > 0 ? `in ${s}` : `${s} ago`;
}

/** Converts a timestamp to the value of a datetime-local input (local time). */
export function toLocalInput(ts: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(ts);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
}

/** Converts a datetime-local value (Amsterdam wall time) to an ISO timestamp. */
export function fromLocalInput(v: string): string {
  // Find the offset for that wall time by asking Intl what UTC instant maps back to it.
  const guess = new Date(v + ":00Z");
  const asLocal = new Date(toLocalInput(guess) + ":00Z");
  const offset = asLocal.getTime() - guess.getTime();
  return new Date(guess.getTime() - offset).toISOString();
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
