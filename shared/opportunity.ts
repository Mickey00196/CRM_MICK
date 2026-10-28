// What gets captured at each stage of an account, and the buildings (options) of an opportunity.
// One set of definitions drives the API validation, the forms and the per-stage checklists.

import type { AccountStatus } from "./model.js";

export type FieldType = "text" | "longtext" | "number" | "money" | "date" | "bool" | "select" | "url";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: readonly { key: string; label: string }[];
  /** Shown after the value, e.g. "m²", "€/m²/yr". */
  unit?: string;
  placeholder?: string;
  /** Wider field in the grid (long text, links). */
  wide?: boolean;
}

const opts = (...pairs: [string, string][]) => pairs.map(([key, label]) => ({ key, label }));

// ---------- the brief (requirement), filled in when the opportunity starts ----------

export const BRIEF_GROUPS: { title: string; fields: FieldDef[] }[] = [
  {
    title: "Search",
    fields: [
      { key: "req_type", label: "Type", type: "select", options: opts(["relocation", "Relocation"], ["renewal", "Renewal / renegotiation"], ["expansion", "Expansion"], ["disposal", "Disposal / sublease"], ["other", "Other"]) },
      { key: "size_min_m2", label: "Size from", type: "number", unit: "m²" },
      { key: "size_max_m2", label: "Size to", type: "number", unit: "m²" },
      { key: "headcount_now", label: "Headcount now", type: "number" },
      { key: "headcount_future", label: "Headcount in 3 years", type: "number" },
      { key: "desk_ratio", label: "Desk ratio", type: "text", placeholder: "e.g. 0.7" },
    ],
  },
  {
    title: "Location",
    fields: [
      { key: "areas", label: "Preferred areas", type: "text", placeholder: "Zuidas, Centrum", wide: true },
      { key: "exclude_areas", label: "Not in", type: "text" },
      { key: "must_haves", label: "Must-haves", type: "text", placeholder: "Near a train station, bike parking", wide: true },
      { key: "parking_needed", label: "Parking spaces", type: "number" },
    ],
  },
  {
    title: "Budget and timing",
    fields: [
      { key: "budget_rent_m2", label: "Max rent", type: "money", unit: "€/m²/yr" },
      { key: "budget_year", label: "Total budget", type: "money", unit: "€/yr" },
      { key: "fitout_budget", label: "Fit-out budget", type: "money", unit: "€" },
      { key: "move_in_ideal", label: "Ideal move-in", type: "date" },
      { key: "move_in_latest", label: "Latest move-in", type: "date" },
      { key: "decision_date", label: "Decision by", type: "date" },
    ],
  },
  {
    title: "Building and lease",
    fields: [
      { key: "lease_term", label: "Lease term", type: "text", placeholder: "5+5 years" },
      { key: "flexibility", label: "Lease type", type: "select", options: opts(["conventional", "Conventional lease"], ["flex", "Flex / serviced"], ["hybrid", "Either"]) },
      { key: "delivery", label: "Delivery", type: "select", options: opts(["shell_core", "Shell & core"], ["cat_a", "Cat A"], ["cat_b", "Cat B / turnkey"]) },
      { key: "energy_label_min", label: "Energy label at least", type: "select", options: opts(["A", "A"], ["B", "B"], ["C", "C"]) },
      { key: "amenities", label: "Amenities", type: "text", placeholder: "Gym, canteen, showers", wide: true },
      { key: "sustainability", label: "Sustainability", type: "text", placeholder: "BREEAM Very Good, WELL", wide: true },
    ],
  },
  {
    title: "Decision and mandate",
    fields: [
      { key: "decision_makers", label: "Decision makers", type: "text", wide: true },
      { key: "mandate_signed", label: "Mandate signed", type: "bool" },
      { key: "approval_route", label: "Approval route", type: "text", placeholder: "Board, then HQ in Paris", wide: true },
      { key: "mandate_date", label: "Mandate date", type: "date" },
      { key: "exclusive", label: "Exclusive", type: "bool" },
      { key: "fee_basis", label: "Fee basis", type: "select", options: opts(["pct", "% of first-year rent"], ["fixed", "Fixed fee"]) },
      { key: "fee_pct", label: "Fee %", type: "number", unit: "%" },
      { key: "fee_fixed", label: "Fixed fee", type: "money", unit: "€" },
    ],
  },
];

// ---------- fields that belong to one stage ----------

export const LOST_REASONS = opts(
  ["price", "Price"],
  ["timing", "Timing"],
  ["competitor", "Went with a competitor"],
  ["stayed", "Stayed put"],
  ["no_need", "No real need"],
  ["no_response", "Went quiet"],
  ["other", "Other"],
);

export const STAGE_FIELDS: Record<AccountStatus, FieldDef[]> = {
  lead: [
    { key: "trigger", label: "Trigger", type: "select", options: opts(["lease_expiry", "Lease expiry"], ["growth", "Growth"], ["consolidation", "Consolidation"], ["downsizing", "Hybrid / downsizing"], ["esg", "ESG / quality"], ["other", "Other"]) },
    { key: "expected_type", label: "Likely mandate", type: "select", options: opts(["relocation", "Relocation"], ["renewal", "Renewal / renegotiation"], ["expansion", "Expansion"], ["disposal", "Disposal / sublease"]) },
    { key: "lead_notes", label: "Why now", type: "longtext", wide: true },
  ],
  overview_sent: [
    { key: "overview_link", label: "Brochure link", type: "url", placeholder: "Live link from your shortlist tool", wide: true },
    { key: "overview_sent_at", label: "Sent on", type: "date" },
    { key: "overview_version", label: "Version", type: "text", placeholder: "v1" },
  ],
  viewing: [{ key: "viewing_notes", label: "Viewing round notes", type: "longtext", wide: true }],
  rfp: [
    { key: "rfp_sent_at", label: "RFP sent", type: "date" },
    { key: "rfp_deadline", label: "Responses due", type: "date" },
    { key: "rfp_link", label: "RFP document", type: "url", wide: true },
    { key: "rfp_asks", label: "What we asked for", type: "longtext", placeholder: "Term, incentives, fit-out, parking, indexation cap, ROZ deviations", wide: true },
  ],
  proposal: [
    { key: "advice", label: "Our advice", type: "longtext", placeholder: "Which option and why", wide: true },
    { key: "advice_presented_at", label: "Presented on", type: "date" },
  ],
  negotiation: [{ key: "negotiation_deadline", label: "Deadline / exclusivity until", type: "date" }],
  terms_agreed: [
    { key: "hot_signed_at", label: "Heads of terms signed", type: "date" },
    { key: "hot_link", label: "HoT document", type: "url", wide: true },
    { key: "conditions", label: "Conditions", type: "text", placeholder: "Board approval, permit", wide: true },
    { key: "wwft_done", label: "Wwft / UBO check done", type: "bool" },
    { key: "lawyer", label: "Lawyer", type: "text" },
  ],
  agreement: [
    { key: "lease_signed_at", label: "Lease signed", type: "date" },
    { key: "lease_start", label: "Lease start", type: "date" },
    { key: "lease_end", label: "Lease end", type: "date" },
    { key: "first_break", label: "First break", type: "date" },
    { key: "notice_months", label: "Notice", type: "number", unit: "months" },
    { key: "rent_year", label: "Rent at signing", type: "money", unit: "€/yr" },
    { key: "move_in", label: "Move-in", type: "date" },
    { key: "lease_link", label: "Lease document", type: "url", wide: true },
  ],
  invoicing: [
    { key: "fee_amount", label: "Fee", type: "money", unit: "€" },
    { key: "fee_split", label: "Split", type: "text", placeholder: "e.g. 70/30 with a colleague" },
    { key: "invoice_number", label: "Invoice number", type: "text" },
    { key: "invoice_sent_at", label: "Invoice sent", type: "date" },
    { key: "invoice_due_at", label: "Due", type: "date" },
    { key: "paid_at", label: "Paid", type: "date" },
    { key: "won_notes", label: "Why we won", type: "longtext", wide: true },
  ],
  not_now: [
    { key: "lost_reason", label: "Reason", type: "select", options: LOST_REASONS },
    { key: "lost_notes", label: "Notes", type: "longtext", wide: true },
  ],
};

export const OPPORTUNITY_FIELDS: Record<string, FieldDef> = Object.fromEntries(
  [...BRIEF_GROUPS.flatMap((g) => g.fields), ...Object.values(STAGE_FIELDS).flat()].map((d) => [d.key, d]),
);

// ---------- buildings (options) ----------

export const OPTION_STATUSES = [
  { key: "overview", label: "In overview" },
  { key: "viewed", label: "Viewed" },
  { key: "rfp", label: "RFP sent" },
  { key: "proposal", label: "Proposal in" },
  { key: "negotiating", label: "Negotiating" },
  { key: "chosen", label: "Chosen" },
  { key: "dropped", label: "Dropped" },
] as const;
export type OptionStatus = (typeof OPTION_STATUSES)[number]["key"];

export const OPTION_FIELDS: FieldDef[] = [
  // the building as offered in the overview
  { key: "name", label: "Building", type: "text" },
  { key: "address", label: "Address", type: "text" },
  { key: "city", label: "City", type: "text" },
  { key: "submarket", label: "Area", type: "text" },
  { key: "area_m2", label: "Available", type: "number", unit: "m²" },
  { key: "asking_rent_m2", label: "Asking rent", type: "money", unit: "€/m²/yr" },
  { key: "service_m2", label: "Service charges", type: "money", unit: "€/m²/yr" },
  { key: "available_from", label: "Available from", type: "text" },
  { key: "energy_label", label: "Energy label", type: "text" },
  { key: "landlord", label: "Landlord", type: "text" },
  { key: "agent", label: "Landlord's agent", type: "text" },
  { key: "link", label: "Link", type: "url" },
  { key: "photo", label: "Photo", type: "url" },
  { key: "reaction", label: "Client's reaction", type: "select", options: opts(["yes", "Interested"], ["maybe", "Maybe"], ["no", "Not for us"]) },
  { key: "notes", label: "Notes", type: "longtext" },
  // viewing
  { key: "viewing_date", label: "Viewed on", type: "date" },
  { key: "viewing_score", label: "Score", type: "number" },
  { key: "viewing_notes", label: "Viewing notes", type: "longtext" },
  // RFP
  { key: "rfp_sent_at", label: "RFP sent", type: "date" },
  { key: "rfp_received_at", label: "Response in", type: "date" },
  // the landlord's offer
  { key: "offer_area_m2", label: "Area offered", type: "number", unit: "m²" },
  { key: "offer_rent_m2", label: "Rent", type: "money", unit: "€/m²/yr" },
  { key: "offer_service_m2", label: "Service charges", type: "money", unit: "€/m²/yr" },
  { key: "offer_parking_spaces", label: "Parking spaces", type: "number" },
  { key: "offer_parking_rate", label: "Parking rate", type: "money", unit: "€/space/yr" },
  { key: "offer_rent_free_months", label: "Rent-free", type: "number", unit: "months" },
  { key: "offer_fitout_m2", label: "Fit-out contribution", type: "money", unit: "€/m²" },
  { key: "offer_term_years", label: "Term", type: "number", unit: "years" },
  { key: "offer_break_years", label: "Break after", type: "number", unit: "years" },
  { key: "offer_indexation", label: "Indexation", type: "text", placeholder: "CPI, capped 3%" },
  { key: "offer_guarantee", label: "Guarantee", type: "text", placeholder: "3 months bank guarantee" },
  { key: "offer_delivery", label: "Delivery", type: "text" },
  { key: "offer_start", label: "Start", type: "date" },
  { key: "drop_reason", label: "Why dropped", type: "text" },
];
export const OPTION_FIELD_MAP: Record<string, FieldDef> = Object.fromEntries(OPTION_FIELDS.map((d) => [d.key, d]));

/** The terms you negotiate on, per building: landlord's position, our ask, agreed. */
export const NEGOTIATION_TERMS = opts(
  ["rent", "Rent"],
  ["rent_free", "Rent-free"],
  ["fitout", "Fit-out contribution"],
  ["term", "Term and break"],
  ["indexation", "Indexation"],
  ["service", "Service charges / cap"],
  ["guarantee", "Guarantee"],
  ["parking", "Parking"],
  ["subletting", "Subletting"],
  ["roz", "ROZ deviations"],
  ["other", "Other"],
);
export const TERM_SIDES = ["landlord", "ask", "agreed"] as const;
export type TermSide = (typeof TERM_SIDES)[number];
export type Terms = Partial<Record<string, Partial<Record<TermSide, string>>>>;

export interface OptionRow {
  id: string;
  account_id: string;
  status: OptionStatus;
  position: number;
  source_id: string | null;
  data: Record<string, string | number | boolean | null>;
  terms: Terms;
  created_at: string;
  updated_at: string;
}

// ---------- validation (pure; the API turns errors into 400s) ----------

export class FieldError extends Error {}

/** Accepts 1200, "1.200", "1 200", "245,50", "€ 245,50". */
export function toNumber(v: unknown, label: string): number | null {
  if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) return null;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new FieldError(`${label} must be a number.`);
    return v;
  }
  let s = String(v).replace(/[€\s%]/g, "").replace(/m²|m2/gi, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) throw new FieldError(`${label} must be a number.`);
  return n;
}

/** One field's value as stored, or null to clear it. Throws FieldError with a readable message. */
export function coerceField(def: FieldDef, v: unknown): string | number | boolean | null {
  if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) return def.type === "bool" ? null : null;
  switch (def.type) {
    case "text":
    case "longtext": {
      if (typeof v !== "string" && typeof v !== "number") throw new FieldError(`${def.label} must be text.`);
      const s = String(v).trim();
      const max = def.type === "text" ? 500 : 5000;
      if (s.length > max) throw new FieldError(`${def.label} is too long (max ${max} characters).`);
      return s;
    }
    case "url": {
      const s = String(v).trim();
      if (s.length > 1000 || !/^https?:\/\/[^\s"<>]+$/i.test(s)) throw new FieldError(`${def.label} must be a web link starting with https://`);
      return s;
    }
    case "number":
    case "money": {
      const n = toNumber(v, def.label);
      if (n !== null && (n < 0 || n > 1e12)) throw new FieldError(`${def.label} must be a positive number.`);
      return n;
    }
    case "date": {
      if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw new FieldError(`${def.label} must be a date.`);
      return v;
    }
    case "bool":
      return v === true || v === "true" || v === 1;
    case "select": {
      if (typeof v !== "string" || !def.options?.some((o) => o.key === v)) throw new FieldError(`${def.label} isn't one of the options.`);
      return v;
    }
  }
}

/** Validates a patch against a set of field definitions. Unknown keys are refused. */
export function coercePatch(patch: unknown, defs: Record<string, FieldDef>): Record<string, string | number | boolean | null> {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new FieldError("Nothing to save.");
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(patch)) {
    const def = defs[k];
    if (!def) throw new FieldError(`Unknown field: ${k}.`);
    out[k] = coerceField(def, v);
  }
  return out;
}

export function coerceTerms(patch: unknown): Terms {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new FieldError("Nothing to save.");
  const out: Terms = {};
  for (const [k, sides] of Object.entries(patch as Record<string, unknown>)) {
    if (!NEGOTIATION_TERMS.some((t) => t.key === k)) throw new FieldError(`Unknown term: ${k}.`);
    if (!sides || typeof sides !== "object") throw new FieldError("Each term needs landlord, ask or agreed.");
    const row: Partial<Record<TermSide, string>> = {};
    for (const [side, v] of Object.entries(sides as Record<string, unknown>)) {
      if (!TERM_SIDES.includes(side as TermSide)) throw new FieldError(`Unknown side: ${side}.`);
      const s = v === null || v === undefined ? "" : String(v).trim();
      if (s.length > 300) throw new FieldError("Keep each term under 300 characters.");
      row[side as TermSide] = s;
    }
    out[k] = row;
  }
  return out;
}

// ---------- the money: what an offer really costs ----------

export interface OfferMetrics {
  area: number;
  /** Headline rent per year. */
  rentYear: number;
  /** Value of rent-free plus fit-out contribution over the term. */
  incentives: number;
  /** Net effective rent per m² per year: headline rent minus incentives spread over the term. */
  nerM2: number;
  /** Incentives as a share of the total headline rent over the term. */
  incentivePct: number;
  /** All-in per year: net rent + service charges + parking. */
  totalYear: number;
  totalTerm: number;
  perWorkstationYear: number | null;
}

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Simple (undiscounted) comparison of an offer. Null until area, rent and term are in. */
export function offerMetrics(data: OptionRow["data"], headcount?: number | null): OfferMetrics | null {
  const area = n(data.offer_area_m2) ?? n(data.area_m2);
  const rent = n(data.offer_rent_m2);
  const term = n(data.offer_term_years);
  if (!area || !rent || !term) return null;
  const rentYear = rent * area;
  const incentives = ((n(data.offer_rent_free_months) ?? 0) / 12) * rentYear + (n(data.offer_fitout_m2) ?? 0) * area;
  const extrasYear = (n(data.offer_service_m2) ?? 0) * area + (n(data.offer_parking_spaces) ?? 0) * (n(data.offer_parking_rate) ?? 0);
  const totalTerm = rentYear * term - incentives + extrasYear * term;
  const totalYear = totalTerm / term;
  return {
    area,
    rentYear,
    incentives,
    nerM2: rent - incentives / (area * term),
    incentivePct: incentives / (rentYear * term),
    totalYear,
    totalTerm,
    perWorkstationYear: headcount ? totalYear / headcount : null,
  };
}

/** Suggested fee: a % of the first-year rent (from the agreement, or the chosen offer), or the fixed fee. */
export function suggestedFee(opp: Record<string, unknown>, chosen?: OptionRow | null): number | null {
  if (opp.fee_basis === "fixed") return n(opp.fee_fixed);
  const pct = n(opp.fee_pct);
  if (!pct) return null;
  const rentYear = n(opp.rent_year) ?? (chosen ? offerMetrics(chosen.data)?.rentYear ?? null : null);
  return rentYear ? Math.round((pct / 100) * rentYear) : null;
}

// ---------- what each stage needs before you move on ----------

export interface StageContext {
  opp: Record<string, unknown>;
  options: OptionRow[];
  contacts: number;
  hasCurrentLease: boolean;
}

export interface Check {
  label: string;
  done: boolean;
}

const has = (v: unknown) => v !== null && v !== undefined && v !== "" && v !== false;
const live = (o: OptionRow) => o.status !== "dropped";
const atLeast = (o: OptionRow, s: OptionStatus) => {
  const order: OptionStatus[] = ["overview", "viewed", "rfp", "proposal", "negotiating", "chosen"];
  return order.indexOf(o.status) >= order.indexOf(s);
};

export function stageChecks(stage: AccountStatus, c: StageContext): Check[] {
  const o = c.opp;
  switch (stage) {
    case "lead":
      return [
        { label: "Decision maker or contact added", done: c.contacts > 0 },
        { label: "Current lease end known", done: c.hasCurrentLease },
        { label: "Trigger noted", done: has(o.trigger) },
      ];
    case "overview_sent":
      return [
        { label: "Brief: size", done: has(o.size_min_m2) || has(o.size_max_m2) },
        { label: "Brief: areas and budget", done: has(o.areas) && (has(o.budget_rent_m2) || has(o.budget_year)) },
        { label: "Brief: move-in date", done: has(o.move_in_ideal) || has(o.move_in_latest) },
        { label: "Buildings in the overview", done: c.options.some(live) },
        { label: "Overview sent", done: has(o.overview_sent_at) },
      ];
    case "viewing":
      return [
        { label: "At least one building viewed", done: c.options.some((x) => live(x) && atLeast(x, "viewed")) },
        { label: "Viewed buildings scored", done: c.options.filter((x) => live(x) && atLeast(x, "viewed")).every((x) => has(x.data.viewing_score)) && c.options.some((x) => atLeast(x, "viewed")) },
      ];
    case "rfp":
      return [
        { label: "RFP sent", done: has(o.rfp_sent_at) },
        { label: "Response deadline set", done: has(o.rfp_deadline) },
        { label: "Buildings marked as RFP sent", done: c.options.some((x) => live(x) && atLeast(x, "rfp")) },
      ];
    case "proposal":
      return [
        { label: "At least one offer entered", done: c.options.some((x) => offerMetrics(x.data) !== null) },
        { label: "Advice written", done: has(o.advice) },
        { label: "Advice presented", done: has(o.advice_presented_at) },
      ];
    case "negotiation":
      return [
        { label: "Building(s) in negotiation", done: c.options.some((x) => x.status === "negotiating" || x.status === "chosen") },
        { label: "Terms tracked", done: c.options.some((x) => Object.keys(x.terms ?? {}).length > 0) },
      ];
    case "terms_agreed":
      return [
        { label: "Building chosen", done: c.options.some((x) => x.status === "chosen") },
        { label: "Heads of terms signed", done: has(o.hot_signed_at) },
        { label: "Wwft / UBO check done", done: o.wwft_done === true },
      ];
    case "agreement":
      return [
        { label: "Lease signed", done: has(o.lease_signed_at) },
        { label: "Lease start and end", done: has(o.lease_start) && has(o.lease_end) },
        { label: "Rent at signing", done: has(o.rent_year) },
      ];
    case "invoicing":
      return [
        { label: "Fee set", done: has(o.fee_amount) },
        { label: "Invoice sent", done: has(o.invoice_sent_at) },
        { label: "Paid", done: has(o.paid_at) },
      ];
    case "not_now":
      return [{ label: "Reason noted", done: has(o.lost_reason) }];
  }
}
