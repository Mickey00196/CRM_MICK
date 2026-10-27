// Shared vocabulary for the API and the web app.

type Opt<K extends string = string> = { key: K; label: string };
const label = <K extends string>(opts: readonly Opt<K>[], key: string | null | undefined) =>
  opts.find((o) => o.key === key)?.label ?? key ?? "";

// ---------- accounts ----------

export const ACCOUNT_STATUSES = [
  { key: "lead", label: "Lead" },
  { key: "prospect", label: "Prospect" },
  { key: "client", label: "Client" },
  { key: "former_client", label: "Former client" },
  { key: "not_a_fit", label: "Not a fit" },
] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]["key"];
export const accountStatusLabel = (k: string) => label(ACCOUNT_STATUSES, k);

export const SIZE_BANDS = [
  { key: "1-10", label: "1–10" },
  { key: "11-50", label: "11–50" },
  { key: "51-200", label: "51–200" },
  { key: "201-500", label: "201–500" },
  { key: "501-1000", label: "501–1.000" },
  { key: "1000+", label: "1.000+" },
] as const;

export const ICP_FIT = [
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
] as const;

export const LANGUAGES = [
  { key: "nl", label: "Dutch" },
  { key: "en", label: "English" },
] as const;

// ---------- office & lease ----------

export const TENURES = [
  { key: "lease", label: "Lease" },
  { key: "flex", label: "Flex" },
  { key: "sublease", label: "Sublease" },
  { key: "owned", label: "Owned" },
] as const;
export const tenureLabel = (k: string | null) => label(TENURES, k);

export const GROWTH = [
  { key: "grow", label: "Growing" },
  { key: "stable", label: "Stable" },
  { key: "shrink", label: "Shrinking" },
  { key: "unknown", label: "Unknown" },
] as const;

/** Months before lease end (or break) when the decision window opens. */
export const DECISION_WINDOW_MONTHS = 24;

// ---------- contacts ----------

export const BUYING_ROLES = [
  { key: "decision_maker", label: "Decision maker" },
  { key: "champion", label: "Champion" },
  { key: "influencer", label: "Influencer" },
  { key: "user", label: "User" },
  { key: "gatekeeper", label: "Gatekeeper" },
] as const;
export const buyingRoleLabel = (k: string | null) => label(BUYING_ROLES, k);

export const LAWFUL_BASIS = [
  { key: "legitimate_interest", label: "Legitimate interest" },
  { key: "consent", label: "Consent" },
  { key: "contract", label: "Contract" },
] as const;

// ---------- projects ----------

export const PROJECT_STAGES = [
  { key: "todo", label: "To do" },
  { key: "active", label: "Active" },
  { key: "waiting", label: "Waiting on others" },
  { key: "done", label: "Done" },
] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number]["key"];
export const projectStageLabel = (k: string) => label(PROJECT_STAGES, k);
/** Projects in these stages should always have a next to-do. */
export const OPEN_PROJECT_STAGES: ProjectStage[] = ["todo", "active", "waiting"];

// ---------- communication ----------

export const CHANNELS = [
  { key: "call", label: "Call" },
  { key: "email", label: "Email" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "meeting", label: "Meeting" },
  { key: "viewing", label: "Viewing" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "note", label: "Note" },
  { key: "other", label: "Other" },
] as const;
export type Channel = (typeof CHANNELS)[number]["key"];
export const channelLabel = (k: string) => label(CHANNELS, k);
/** Channels that count as contact with the client (notes don't). */
export const CONTACT_CHANNELS: Channel[] = ["call", "email", "linkedin", "meeting", "viewing", "whatsapp", "other"];

export const DIRECTIONS = [
  { key: "outbound", label: "Outbound" },
  { key: "inbound", label: "Inbound" },
] as const;

const MESSAGE_OUTCOMES = [
  { key: "sent", label: "Sent" },
  { key: "replied", label: "Replied" },
  { key: "no_reply", label: "No reply" },
  { key: "meeting_booked", label: "Meeting booked" },
  { key: "not_interested", label: "Not interested" },
];

export const OUTCOMES: Record<Channel, Opt[]> = {
  call: [
    { key: "reached", label: "Reached" },
    { key: "no_answer", label: "No answer" },
    { key: "voicemail", label: "Voicemail" },
    { key: "wrong_number", label: "Wrong number" },
    { key: "meeting_booked", label: "Meeting booked" },
    { key: "not_interested", label: "Not interested" },
    { key: "call_back_later", label: "Call back later" },
  ],
  email: MESSAGE_OUTCOMES,
  linkedin: MESSAGE_OUTCOMES,
  whatsapp: MESSAGE_OUTCOMES,
  meeting: [
    { key: "held", label: "Held" },
    { key: "no_show", label: "No-show" },
    { key: "rescheduled", label: "Rescheduled" },
  ],
  viewing: [
    { key: "held", label: "Held" },
    { key: "shortlisted", label: "Shortlisted" },
    { key: "rejected", label: "Rejected" },
    { key: "no_show", label: "No-show" },
  ],
  note: [],
  other: [],
};

export function outcomeLabel(channel: string, outcome: string | null): string {
  if (!outcome) return "";
  return OUTCOMES[channel as Channel]?.find((o) => o.key === outcome)?.label ?? outcome;
}

// ---------- to-dos ----------

export const TASK_TYPES = [
  { key: "call", label: "Call" },
  { key: "email", label: "Email" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "meeting", label: "Meeting" },
  { key: "viewing", label: "Viewing" },
  { key: "todo", label: "To-do" },
] as const;
export type TaskType = (typeof TASK_TYPES)[number]["key"];
export const taskTypeLabel = (k: string) => label(TASK_TYPES, k);

/** The channel logged when a to-do of this type is completed. Plain to-dos aren't communication. */
export function channelForTaskType(t: string): Channel | null {
  return ["call", "email", "linkedin", "meeting", "viewing"].includes(t) ? (t as Channel) : null;
}

export interface NextStepSuggestion {
  type: TaskType;
  title: string;
  days: number;
  /** Ask for a specific date (e.g. the meeting date) rather than offering "in N days". */
  pickDate?: boolean;
}

const SAME = "same" as const;
const RULES: Record<string, Record<string, { type: TaskType | typeof SAME; title: string; days: number; pickDate?: boolean }>> = {
  call: {
    reached: { type: "email", title: "Send follow-up email", days: 1 },
    no_answer: { type: "call", title: "Call again", days: 2 },
    voicemail: { type: "call", title: "Call again", days: 2 },
    wrong_number: { type: "todo", title: "Find the right number", days: 1 },
    meeting_booked: { type: "meeting", title: "Prep meeting", days: 7, pickDate: true },
    not_interested: { type: "call", title: "Nurture check-in", days: 182 },
    call_back_later: { type: "call", title: "Call back", days: 3 },
  },
  message: {
    sent: { type: SAME, title: "Follow up", days: 5 },
    replied: { type: SAME, title: "Reply", days: 0 },
    no_reply: { type: "call", title: "Switch channel: call", days: 2 },
    meeting_booked: { type: "meeting", title: "Prep meeting", days: 7, pickDate: true },
    not_interested: { type: "call", title: "Nurture check-in", days: 182 },
  },
  meeting: {
    held: { type: "email", title: "Send meeting follow-up", days: 1 },
    no_show: { type: "call", title: "Reschedule meeting", days: 1 },
    rescheduled: { type: "meeting", title: "Prep meeting", days: 7, pickDate: true },
  },
  viewing: {
    held: { type: "call", title: "Get viewing feedback", days: 1 },
    shortlisted: { type: "todo", title: "Prepare proposal", days: 2 },
    rejected: { type: "viewing", title: "Plan next viewing", days: 7 },
    no_show: { type: "call", title: "Reschedule viewing", days: 1 },
  },
};

/** Pre-fills the next step from what just happened. */
export function suggestNextStep(channel: string, outcome: string | null): NextStepSuggestion | null {
  if (!outcome) return null;
  const group = ["email", "linkedin", "whatsapp"].includes(channel) ? "message" : channel;
  const rule = RULES[group]?.[outcome];
  if (!rule) return null;
  const type: TaskType = rule.type === SAME ? (channel === "whatsapp" ? "todo" : (channel as TaskType)) : rule.type;
  return { type, title: rule.title, days: rule.days, pickDate: rule.pickDate };
}

// ---------- API shapes ----------

export interface TodoRow {
  id: string;
  title: string;
  type: TaskType;
  due_date: string | null;
  due_time: string | null;
  priority: "normal" | "high";
  account_id: string | null;
  account_name: string | null;
  project_id: string | null;
  project_name: string | null;
}

export interface StalledProject {
  id: string;
  name: string;
  stage: ProjectStage;
  account_name: string | null;
  last_activity_at: string | null;
}

export interface TodoList {
  today: string;
  overdue: TodoRow[];
  due_today: TodoRow[];
  upcoming: TodoRow[];
  no_next_step: StalledProject[];
}

export interface ActivityRow {
  id: string;
  account_id: string | null;
  account_name?: string | null;
  project_id: string | null;
  project_name?: string | null;
  contact_id: string | null;
  contact_name?: string | null;
  task_id: string | null;
  channel: Channel;
  direction: "outbound" | "inbound";
  outcome: string | null;
  summary: string;
  occurred_at: string;
  expect_reply: boolean;
  source: string;
}

export interface OfficeSummary {
  id: string;
  building_name: string;
  city: string;
  submarket: string;
  area_m2: number | null;
  lease_end: string | null;
  notice_months: number | null;
  break_dates: string[];
}

export interface ContactLite {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  linkedin_url: string;
  do_not_contact: boolean;
}

export interface TaskDetail {
  task: TodoRow & {
    contact_id: string | null;
    notes: string;
    status: "open" | "done" | "snoozed";
    completed_at: string | null;
    created_by: string;
  };
  account: { id: string; name: string; status: AccountStatus } | null;
  project: { id: string; name: string; stage: ProjectStage } | null;
  contact: ContactLite | null;
  contacts: ContactLite[];
  last_activity: ActivityRow | null;
  office: OfficeSummary | null;
  other_open_tasks: number;
}

export interface NextStep {
  id: string;
  title: string;
  type: TaskType;
  due_date: string | null;
  due_time: string | null;
}

export interface AccountRow {
  id: string;
  name: string;
  domain: string | null;
  status: AccountStatus;
  industry: string;
  lead_source: string;
  language: "nl" | "en";
  tags: string[];
  archived_at: string | null;
  office_city: string | null;
  office_submarket: string | null;
  office_building: string | null;
  area_m2: number | null;
  lease_end: string | null;
  next_step: NextStep | null;
  last_contact_at: string | null;
  created_at: string;
}

export interface Account {
  id: string;
  name: string;
  domain: string | null;
  website: string;
  industry: string;
  size_band: string | null;
  status: AccountStatus;
  icp_fit: string | null;
  lead_source: string;
  language: "nl" | "en";
  tags: string[];
  notes: string;
  archived_at: string | null;
  created_at: string;
}

export interface OfficeLocation {
  id: string;
  account_id: string;
  is_primary: boolean;
  is_current: boolean;
  building_name: string;
  address: string;
  postcode: string;
  city: string;
  submarket: string;
  floors: string;
  area_m2: number | null;
  workstations: number | null;
  headcount: number | null;
  meeting_rooms: number | null;
  parking_spaces: number | null;
  hybrid_policy: string;
  fit_out_condition: string;
  tenure: string | null;
  landlord: string;
  landlord_agent: string;
  lease_start: string | null;
  lease_end: string | null;
  initial_term_months: number | null;
  renewal_options: string;
  notice_months: number | null;
  break_dates: string[];
  sublet_allowed: boolean | null;
  rent_per_m2: number | null;
  annual_rent: number | null;
  service_charges: number | null;
  parking_rent: number | null;
  indexation: string;
  rent_free_months: number | null;
  fitout_contribution: number | null;
  guarantee: string;
  satisfaction: number | null;
  pain_points: string;
  growth_outlook: string | null;
  re_decision_maker: string;
  notes: string;
}

export interface Contact extends ContactLite {
  account_id: string | null;
  account_name?: string | null;
  buying_role: string | null;
  language: "nl" | "en" | null;
  opt_out_at: string | null;
  lawful_basis: string | null;
  notes: string;
  last_contacted_at: string | null;
  archived_at: string | null;
}

export interface OpenTask extends NextStep {
  priority: "normal" | "high";
  contact_id: string | null;
  project_id: string | null;
  project_name?: string | null;
}

export interface ProjectRow {
  id: string;
  name: string;
  stage: ProjectStage;
  account_id: string | null;
  account_name: string | null;
  waiting_on: string;
  target_date: string | null;
  next_step: NextStep | null;
  open_tasks: number;
  last_activity_at: string | null;
  stage_changed_at: string;
  done_at: string | null;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  stage: ProjectStage;
  account_id: string | null;
  account_name: string | null;
  contact_id: string | null;
  waiting_on: string;
  target_date: string | null;
  notes: string;
  stage_changed_at: string;
  done_at: string | null;
  created_at: string;
  archived_at: string | null;
}

export interface ProjectDetail {
  project: Project;
  tasks: OpenTask[];
  done_tasks: (OpenTask & { completed_at: string })[];
  activities: ActivityRow[];
  contacts: ContactLite[];
}

export interface AccountDetail {
  account: Account;
  offices: OfficeLocation[];
  contacts: Contact[];
  tasks: OpenTask[];
  projects: ProjectRow[];
  last_contact_at: string | null;
}

export interface ContactDetail {
  contact: Contact;
  activities: ActivityRow[];
  tasks: OpenTask[];
}

export interface SearchHit {
  kind: "project" | "account" | "contact" | "activity" | "task";
  id: string;
  account_id: string | null;
  project_id: string | null;
  title: string;
  subtitle: string;
}
