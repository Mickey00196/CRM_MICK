// "Call Sanne tomorrow 10:00 about the break option" → type, date and time, in English or Dutch.
// Pure: "today" is passed in. Date and time words are taken out of the title; the rest stays as typed.

import { isoAdd } from "./dates.js";
import type { TaskType } from "./model.js";

export interface QuickParse {
  title: string;
  due_date: string | null;
  due_time: string | null;
  type: TaskType | null;
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  zondag: 0, maandag: 1, dinsdag: 2, woensdag: 3, donderdag: 4, vrijdag: 5, zaterdag: 6,
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, maa: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12,
};

// Only the first word sets the type, so "Update LinkedIn headline" stays a plain to-do.
const TYPE_WORDS: [RegExp, TaskType][] = [
  [/^(call|ring|phone|bel|bellen|nabellen|terugbellen)$/i, "call"],
  [/^(e-?mail|mail|mailen)$/i, "email"],
  [/^linkedin$/i, "linkedin"],
  [/^(meeting|meet|afspraak|lunch|koffie|coffee|overleg)$/i, "meeting"],
  [/^(viewing|bezichtiging|rondleiding|tour)$/i, "viewing"],
];

const PREFIX = String.raw`(?:(?:on|op|by|before|uiterlijk|at|om)\s+)?`;

function weekdayOf(iso: string): number {
  return new Date(iso + "T12:00:00Z").getUTCDay();
}

/** The next given weekday after today (a week ahead if it's today). */
function nextWeekday(today: string, day: number): string {
  const diff = (day - weekdayOf(today) + 7) % 7 || 7;
  return isoAdd(today, diff);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function validDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const iso = `${y}-${pad(m)}-${pad(d)}`;
  return new Date(iso + "T12:00:00Z").toISOString().slice(0, 10) === iso ? iso : null;
}

/** A day and month without a year: this year, or next year if that's already past. */
function dayMonth(today: string, d: number, m: number, y?: number): string | null {
  if (y !== undefined) return validDate(y < 100 ? 2000 + y : y, m, d);
  const year = Number(today.slice(0, 4));
  const iso = validDate(year, m, d);
  if (!iso) return null;
  return iso < today ? validDate(year + 1, m, d) : iso;
}

function toTime(h: number, min: number, suffix?: string): string | null {
  const s = suffix?.toLowerCase();
  if (s === "pm" && h < 12) h += 12;
  if (s === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

type Rule<T> = [RegExp, (m: RegExpExecArray) => T | null];

export function parseQuick(input: string, today: string): QuickParse {
  let text = ` ${input} `;
  let due_date: string | null = null;
  let due_time: string | null = null;

  // Takes the first rule that matches and cuts the match out of the text.
  function take<T>(rules: Rule<T>[]): T | null {
    for (const [re, fn] of rules) {
      const m = re.exec(text);
      if (!m) continue;
      const v = fn(m);
      if (v === null) continue;
      text = text.slice(0, m.index) + " " + text.slice(m.index + m[0].length);
      return v;
    }
    return null;
  }

  due_time = take<string>([
    [new RegExp(String.raw`\s(?:at|om)\s+(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|uur|u)?(?=[\s,.!?])`, "i"), (m) => toTime(+m[1], +(m[2] ?? 0), m[3])],
    [/\s(\d{1,2})[:.](\d{2})\s*(am|pm)?(?=[\s,.!?])/i, (m) => toTime(+m[1], +m[2], m[3])],
    [/\s(\d{1,2})\s*(am|pm)(?=[\s,.!?])/i, (m) => toTime(+m[1], 0, m[2])],
    [/\s(\d{1,2})u(\d{2})?(?=[\s,.!?])/i, (m) => toTime(+m[1], +(m[2] ?? 0))],
  ]);

  due_date = take<string>([
    [new RegExp(String.raw`\s${PREFIX}(?:the\s+)?(?:day after tomorrow|overmorgen)(?=[\s,.!?])`, "i"), () => isoAdd(today, 2)],
    [new RegExp(String.raw`\s${PREFIX}(?:today|vandaag)(?=[\s,.!?])`, "i"), () => today],
    [new RegExp(String.raw`\s${PREFIX}(?:tomorrow|morgen)(?=[\s,.!?])`, "i"), () => isoAdd(today, 1)],
    [/\s(?:next week|volgende week)(?=[\s,.!?])/i, () => nextWeekday(today, 1)],
    [
      /\s(?:in|over)\s+(\d{1,2})\s+(days?|dagen|dag|weeks?|weken)(?=[\s,.!?])/i,
      (m) => isoAdd(today, +m[1] * (/^(w|week)/i.test(m[2]) ? 7 : 1)),
    ],
    [
      new RegExp(String.raw`\s${PREFIX}(?:(?:next|volgende|aanstaande|this|deze)\s+)?(${Object.keys(WEEKDAYS).join("|")})(?=[\s,.!?])`, "i"),
      (m) => nextWeekday(today, WEEKDAYS[m[1].toLowerCase()]),
    ],
    [
      new RegExp(String.raw`\s${PREFIX}(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?(?=[\s,.!?])`, "i"),
      (m) => dayMonth(today, +m[1], +m[2], m[3] ? +m[3] : undefined),
    ],
    [
      new RegExp(String.raw`\s${PREFIX}(\d{1,2})\s+(${Object.keys(MONTHS).join("|")})[a-z]*\.?(?=[\s,.!?])`, "i"),
      (m) => dayMonth(today, +m[1], MONTHS[m[2].toLowerCase().slice(0, 3)] ?? MONTHS[m[2].toLowerCase()]),
    ],
  ]);

  const title = text.replace(/\s+/g, " ").replace(/\s+([,.!?])/g, "$1").trim().replace(/^[,.\s]+|[,\s]+$/g, "");
  const first = title.split(/\s+/)[0] ?? "";
  const type = TYPE_WORDS.find(([re]) => re.test(first))?.[1] ?? null;
  return { title, due_date, due_time, type };
}
