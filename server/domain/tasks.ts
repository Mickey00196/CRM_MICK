// To-do workflows. Routes, scheduled jobs and (later) automations all go through these,
// so the rules live in one place and every caller gets the same checks.
import type { Db } from "../db.js";
import { f, pick, bad, notFound, insertSql, updateSql, type Spec } from "../validate.js";
import { OUTCOMES, TASK_TYPES, channelForTaskType, type Channel } from "../../shared/model.js";
import { resolveLinks } from "./links.js";

const TYPE_KEYS = TASK_TYPES.map((t) => t.key);

export const TASK_SPEC: Spec = {
  title: [f.required(300), "To-do"],
  type: [f.oneOf(TYPE_KEYS, false), "Type"],
  due_date: [f.date(), "Due date"],
  due_time: [f.time(), "Time"],
  priority: [f.oneOf(["normal", "high"], false), "Priority"],
  account_id: [f.uuid(), "Account"],
  contact_id: [f.uuid(), "Contact"],
  deal_id: [f.uuid(), "Deal"],
  notes: [f.text(5000), "Notes"],
};

const NEXT_SPEC: Spec = {
  type: [f.oneOf(TYPE_KEYS, false), "Next step type"],
  title: [f.required(300), "Next step"],
  due_date: [f.date(), "Next step date"],
  due_time: [f.time(), "Next step time"],
  contact_id: [f.uuid(), "Contact"],
  priority: [f.oneOf(["normal", "high"], false), "Priority"],
};

export type NextStep = Record<string, unknown>;

/** Parses an optional { next: {...} } block. Returns null when absent or null. */
export function parseNext(body: any): NextStep | null {
  if (!body?.next) return null;
  return pick({ type: "todo", priority: "normal", ...body.next }, NEXT_SPEC, true);
}

export function validateOutcome(channel: string, outcome: unknown): string | null {
  if (outcome === undefined || outcome === null || outcome === "") return null;
  const options = OUTCOMES[channel as Channel] ?? [];
  if (typeof outcome !== "string" || !options.some((o) => o.key === outcome)) {
    throw bad("That outcome doesn't fit this channel.");
  }
  return outcome;
}

export async function createTask(t: Db, owner: string, cols: Record<string, unknown>) {
  if (!cols.title) throw bad("To-do is required.");
  const links = await resolveLinks(t, owner, {
    account_id: cols.account_id as string | null,
    contact_id: cols.contact_id as string | null,
    deal_id: cols.deal_id as string | null,
  });
  const { text, values } = insertSql("tasks", { type: "todo", priority: "normal", ...cols, ...links, owner_id: owner });
  return t.one(text, values);
}

/** Partial update. Snoozing moves the due date and records it. */
export async function updateTask(t: Db, owner: string, id: string, body: any) {
  const existing = await t.one(
    "select account_id, contact_id, deal_id from tasks where id = $1 and owner_id = $2 and archived_at is null",
    [id, owner],
  );
  if (!existing) throw notFound("That to-do");
  const cols = pick(body, TASK_SPEC, true);
  if (body?.snooze_until !== undefined) {
    const until = f.date()(body.snooze_until, "Snooze date");
    if (!until) throw bad("Pick a date to snooze to.");
    cols.due_date = until;
    cols.snoozed_until = until;
  }
  if ("account_id" in cols || "contact_id" in cols || "deal_id" in cols) {
    Object.assign(cols, await resolveLinks(t, owner, { ...existing, ...pickLinks(cols) }));
  }
  const { text, values } = updateSql("tasks", id, owner, cols);
  return t.one(text, values);
}

function pickLinks(cols: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of ["account_id", "contact_id", "deal_id"]) if (k in cols) out[k] = cols[k];
  return out;
}

export interface CompleteInput {
  outcome?: unknown;
  note?: unknown;
  contact_id?: unknown;
  direction?: unknown;
  next?: unknown;
}

/**
 * "How did it go?": completes the to-do, logs the communication on the account and creates the next step.
 * All or nothing; call it inside a transaction.
 */
export async function completeTask(t: Db, owner: string, id: string, input: CompleteInput) {
  const note = f.text(5000)(input.note, "Note") as string;
  const contactId = f.uuid()(input.contact_id, "Contact") as string | null;
  const direction = f.oneOf(["outbound", "inbound"])(input.direction, "Direction") ?? "outbound";
  const next = parseNext(input);

  const task = await t.one("select * from tasks where id = $1 and owner_id = $2 and archived_at is null for update", [id, owner]);
  if (!task) throw notFound("That to-do");
  if (task.status === "done") throw bad("This to-do is already done.");

  const links = await resolveLinks(t, owner, {
    account_id: task.account_id,
    contact_id: contactId ?? task.contact_id,
    deal_id: task.deal_id,
  });

  const channel = channelForTaskType(task.type);
  const outcome = channel ? validateOutcome(channel, input.outcome) : null;
  let activity = null;
  if (task.account_id && (channel || note)) {
    activity = await t.one(
      `insert into activities (owner_id, account_id, contact_id, deal_id, task_id, channel, direction, outcome, summary, source)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'todo') returning *`,
      [owner, links.account_id, links.contact_id, links.deal_id, task.id, channel ?? "note", direction, outcome, note || task.title],
    );
  }
  await t.q("update tasks set status = 'done', completed_at = now(), completion_activity_id = $2 where id = $1", [
    task.id,
    activity?.id ?? null,
  ]);
  const next_task = next
    ? await createTask(t, owner, {
        ...next,
        account_id: task.account_id,
        deal_id: task.deal_id,
        contact_id: next.contact_id ?? links.contact_id,
      })
    : null;
  return { activity, next_task };
}
