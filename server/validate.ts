// Input parsing for API bodies. Every parser returns the DB value or throws a 400.

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export const bad = (msg: string) => new HttpError(400, msg);
export const notFound = (what = "That record") => new HttpError(404, `${what} doesn't exist.`);

type Parser = (v: unknown, label: string) => unknown;
const empty = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/** Accepts 1200, "1.200", "1 200", "245,50", "245.50". */
export function parseNumber(v: unknown, label: string): number | null {
  if (empty(v)) return null;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw bad(`${label} must be a number.`);
    return v;
  }
  let s = String(v).replace(/[€\s]/g, "").replace(/m²|m2/gi, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) throw bad(`${label} must be a number.`);
  return n;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const f = {
  text:
    (max = 500): Parser =>
    (v, label) => {
      if (empty(v)) return "";
      if (typeof v !== "string") throw bad(`${label} must be text.`);
      const s = v.trim();
      if (s.length > max) throw bad(`${label} is too long (max ${max} characters).`);
      return s;
    },
  required:
    (max = 300): Parser =>
    (v, label) => {
      const s = f.text(max)(v, label) as string;
      if (!s) throw bad(`${label} is required.`);
      return s;
    },
  textOrNull:
    (max = 300): Parser =>
    (v, label) => (f.text(max)(v, label) as string) || null,
  int:
    (min = 0, max = 10_000_000): Parser =>
    (v, label) => {
      const n = parseNumber(v, label);
      if (n === null) return null;
      if (n < min || n > max) throw bad(`${label} must be between ${min} and ${max}.`);
      return Math.round(n);
    },
  num:
    (min = 0): Parser =>
    (v, label) => {
      const n = parseNumber(v, label);
      if (n !== null && n < min) throw bad(`${label} can't be below ${min}.`);
      return n;
    },
  date: (): Parser => (v, label) => {
    if (empty(v)) return null;
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
      throw bad(`${label} must be a valid date.`);
    }
    return v;
  },
  time: (): Parser => (v, label) => {
    if (empty(v)) return null;
    if (typeof v !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw bad(`${label} must be a time like 14:30.`);
    return v;
  },
  timestamp: (): Parser => (v, label) => {
    if (empty(v)) return null;
    if (typeof v !== "string" || Number.isNaN(Date.parse(v))) throw bad(`${label} must be a date and time.`);
    return new Date(v).toISOString();
  },
  bool: (): Parser => (v) => v === true || v === "true" || v === 1,
  boolOrNull: (): Parser => (v) => (empty(v) ? null : v === true || v === "true" || v === 1),
  oneOf:
    (keys: readonly string[], nullable = true): Parser =>
    (v, label) => {
      if (empty(v)) {
        if (nullable) return null;
        throw bad(`${label} is required.`);
      }
      if (typeof v !== "string" || !keys.includes(v)) throw bad(`${label} isn't a valid option.`);
      return v;
    },
  uuid:
    (nullable = true): Parser =>
    (v, label) => {
      if (empty(v)) {
        if (nullable) return null;
        throw bad(`${label} is required.`);
      }
      if (typeof v !== "string" || !UUID_RE.test(v)) throw bad(`${label} isn't valid.`);
      return v;
    },
  tags: (): Parser => (v, label) => {
    if (empty(v)) return [];
    const list = Array.isArray(v) ? v : String(v).split(",");
    if (list.some((t) => typeof t !== "string")) throw bad(`${label} must be text.`);
    return [...new Set(list.map((t: string) => t.trim()).filter(Boolean))].slice(0, 30);
  },
  dates: (): Parser => (v, label) => {
    if (empty(v)) return [];
    const list = Array.isArray(v) ? v : String(v).split(",");
    return list.map((d) => f.date()(typeof d === "string" ? d.trim() : d, label)).filter(Boolean);
  },
  json: (): Parser => (v, label) => {
    if (empty(v)) return {};
    if (typeof v !== "object" || Array.isArray(v)) throw bad(`${label} must be an object.`);
    return v;
  },
};

export type Spec = Record<string, [Parser, string]>;

/** Parses the fields of `spec` present in body. With partial=false, missing fields are parsed as empty. */
export function pick(body: any, spec: Spec, partial: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const src = body && typeof body === "object" ? body : {};
  for (const [key, [parse, label]] of Object.entries(spec)) {
    if (key in src) out[key] = parse(src[key], label);
    else if (!partial) out[key] = parse(undefined, label);
  }
  return out;
}

/** Validates a route param id. */
export function idOf(v: unknown, what = "That record"): string {
  if (typeof v !== "string" || !UUID_RE.test(v)) throw notFound(what);
  return v;
}

export function insertSql(table: string, cols: Record<string, unknown>) {
  const keys = Object.keys(cols);
  return {
    text: `insert into ${table} (${keys.join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning *`,
    values: Object.values(cols),
  };
}

/** Owner-scoped update by id. */
export function updateSql(table: string, id: string, ownerId: string, cols: Record<string, unknown>) {
  const keys = Object.keys(cols);
  if (!keys.length) throw bad("Nothing to update.");
  return {
    text: `update ${table} set ${keys.map((k, i) => `${k} = $${i + 3}`).join(", ")}
           where id = $1 and owner_id = $2 and archived_at is null returning *`,
    values: [id, ownerId, ...Object.values(cols)],
  };
}
