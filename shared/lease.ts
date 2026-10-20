// Lease date logic shared by the API and the web app. Dates are YYYY-MM-DD strings.
import { DECISION_WINDOW_MONTHS } from "./model.js";

export function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export function monthsBetween(fromISO: string, toISO: string): number {
  const [y1, m1, d1] = fromISO.split("-").map(Number);
  const [y2, m2, d2] = toISO.split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1) + (d2 - d1) / 31;
}

export interface KeyDate {
  date: string;
  label: string;
}

export interface LeaseInfo {
  /** Whole months until lease end (negative if ended). */
  remainingMonths: number | null;
  noticeDeadline: string | null;
  keyDates: KeyDate[];
  nextKeyDate: KeyDate | null;
  decisionWindowOpens: string | null;
  inDecisionWindow: boolean;
}

export function leaseInfo(
  o: { lease_end: string | null; notice_months: number | null; break_dates?: string[] | null },
  today: string,
  windowMonths = DECISION_WINDOW_MONTHS,
): LeaseInfo {
  const breaks = (o.break_dates ?? []).filter(Boolean).sort();
  const keyDates: KeyDate[] = [];
  let noticeDeadline: string | null = null;

  for (const b of breaks) {
    keyDates.push({ date: b, label: "Break option" });
    if (o.notice_months) keyDates.push({ date: addMonthsISO(b, -o.notice_months), label: "Break notice deadline" });
  }
  if (o.lease_end) {
    keyDates.push({ date: o.lease_end, label: "Lease end" });
    if (o.notice_months) {
      noticeDeadline = addMonthsISO(o.lease_end, -o.notice_months);
      keyDates.push({ date: noticeDeadline, label: "Notice deadline" });
    }
  }
  keyDates.sort((a, b) => a.date.localeCompare(b.date));
  const nextKeyDate = keyDates.find((k) => k.date >= today) ?? null;

  // The window opens N months before the first exit point still ahead: a break or the lease end.
  const exits = [...breaks, ...(o.lease_end ? [o.lease_end] : [])].filter((d) => d >= today).sort();
  const decisionWindowOpens = exits.length ? addMonthsISO(exits[0], -windowMonths) : null;

  return {
    remainingMonths: o.lease_end ? Math.round(monthsBetween(today, o.lease_end)) : null,
    noticeDeadline,
    keyDates,
    nextKeyDate,
    decisionWindowOpens,
    inDecisionWindow: Boolean(decisionWindowOpens && today >= decisionWindowOpens),
  };
}
