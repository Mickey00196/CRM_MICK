import { Router } from "express";
import { db, tx, type Db } from "../db.js";
import { uid } from "../auth.js";
import { f, pick, idOf, bad, notFound, insertSql, updateSql, type Spec } from "../validate.js";
import { LAST_CONTACT, OPEN_TASK_ORDER, assertOwned, todayISO } from "../sql.js";
import {
  ACTIVE_ACCOUNT_STATUSES,
  CLOSED_DEAL_STAGES,
  OUTCOMES,
  TASK_TYPES,
  channelForTaskType,
  type Channel,
  type TodoRow,
} from "../../shared/model.js";

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

/** Parses an optional { next: {...} } block. Returns null when absent or explicitly null. */
export function parseNext(body: any): Record<string, unknown> | null {
  if (!body?.next) return null;
  const next = { type: "todo", priority: "normal", ...body.next };
  return pick(next, NEXT_SPEC, true);
}

export async function createTask(t: Db, owner: string, cols: Record<string, unknown>) {
  await assertOwned(t, "accounts", cols.account_id as string, owner, "That account");
  await assertOwned(t, "contacts", cols.contact_id as string, owner, "That contact");
  await assertOwned(t, "deals", cols.deal_id as string, owner, "That deal");
  const { text, values } = insertSql("tasks", { ...cols, owner_id: owner });
  return t.one(text, values);
}

export function validateOutcome(channel: string, outcome: unknown): string | null {
  if (outcome === undefined || outcome === null || outcome === "") return null;
  const options = OUTCOMES[channel as Channel] ?? [];
  if (typeof outcome !== "string" || !options.some((o) => o.key === outcome)) {
    throw bad("That outcome doesn't fit this channel.");
  }
  return outcome;
}

export const tasks = Router();

tasks.get("/todos", async (req, res) => {
  const owner = uid(req);
  const today = todayISO();
  const rows = await db.q<TodoRow>(
    `select t.id, t.title, t.type, t.due_date, t.due_time, t.priority, t.account_id, a.name as account_name
     from tasks t
     left join accounts a on a.id = t.account_id
     where t.owner_id = $1 and t.status = 'open' and t.archived_at is null
       and (a.id is null or a.archived_at is null)
     order by ${OPEN_TASK_ORDER}`,
    [owner],
  );
  const no_next_step = await db.q(
    `select a.id, a.name, a.status, lc.last_contact_at
     from accounts a
     ${LAST_CONTACT}
     where a.owner_id = $1 and a.archived_at is null
       and (a.status = any($2::text[]) or exists (
         select 1 from deals d where d.account_id = a.id and d.archived_at is null and d.stage <> all($3::text[])
       ))
       and not exists (
         select 1 from tasks t where t.account_id = a.id and t.status = 'open' and t.archived_at is null
       )
     order by lc.last_contact_at asc nulls first, a.name`,
    [owner, ACTIVE_ACCOUNT_STATUSES, CLOSED_DEAL_STAGES],
  );
  res.json({
    today,
    overdue: rows.filter((r) => r.due_date && r.due_date < today),
    due_today: rows.filter((r) => r.due_date === today),
    upcoming: rows.filter((r) => !r.due_date || r.due_date > today),
    no_next_step,
  });
});

tasks.get("/tasks/:id", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That to-do");
  const task = await db.one(
    `select t.*, a.name as account_name from tasks t left join accounts a on a.id = t.account_id
     where t.id = $1 and t.owner_id = $2 and t.archived_at is null`,
    [id, owner],
  );
  if (!task) throw notFound("That to-do");

  const [account, contact, contacts, last_activity, office] = task.account_id
    ? await Promise.all([
        db.one("select id, name, status from accounts where id = $1", [task.account_id]),
        task.contact_id
          ? db.one("select id, name, role, email, phone, linkedin_url, do_not_contact from contacts where id = $1", [task.contact_id])
          : Promise.resolve(null),
        db.q(
          `select id, name, role, email, phone, linkedin_url, do_not_contact from contacts
           where account_id = $1 and archived_at is null order by name`,
          [task.account_id],
        ),
        db.one(
          `select x.*, c.name as contact_name from activities x left join contacts c on c.id = x.contact_id
           where x.account_id = $1 and x.archived_at is null and x.channel <> 'note'
           order by x.occurred_at desc limit 1`,
          [task.account_id],
        ),
        db.one(
          `select id, building_name, city, submarket, area_m2, lease_end, notice_months, break_dates
           from office_locations where account_id = $1 and archived_at is null and is_current
           order by is_primary desc, created_at asc limit 1`,
          [task.account_id],
        ),
      ])
    : [
        null,
        task.contact_id
          ? await db.one("select id, name, role, email, phone, linkedin_url, do_not_contact from contacts where id = $1", [task.contact_id])
          : null,
        [],
        null,
        null,
      ];

  const other = task.account_id
    ? await db.one<{ n: number }>(
        `select count(*)::int as n from tasks where account_id = $1 and id <> $2 and status = 'open' and archived_at is null`,
        [task.account_id, id],
      )
    : null;
  res.json({
    task,
    account: account ?? null,
    contact: contact ?? null,
    contacts,
    last_activity: last_activity ?? null,
    office: office ?? null,
    other_open_tasks: other?.n ?? 0,
  });
});

tasks.post("/tasks", async (req, res) => {
  const owner = uid(req);
  const cols = pick({ type: "todo", priority: "normal", ...req.body }, TASK_SPEC, true);
  if (!cols.title) throw bad("To-do is required.");
  res.status(201).json(await createTask(db, owner, cols));
});

tasks.patch("/tasks/:id", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That to-do");
  const cols = pick(req.body, TASK_SPEC, true);
  // Snoozing moves the due date and remembers it was snoozed.
  if (req.body?.snooze_until !== undefined) {
    const until = f.date()(req.body.snooze_until, "Snooze date");
    if (!until) throw bad("Pick a date to snooze to.");
    cols.due_date = until;
    cols.snoozed_until = until;
  }
  await assertOwned(db, "accounts", cols.account_id as string, owner, "That account");
  await assertOwned(db, "contacts", cols.contact_id as string, owner, "That contact");
  const { text, values } = updateSql("tasks", id, owner, cols);
  const row = await db.one(text, values);
  if (!row) throw notFound("That to-do");
  res.json(row);
});

/**
 * "How did it go?" — completes the to-do, logs the communication and creates the next step in one go.
 * Body: { outcome?, note?, contact_id?, direction?, next?: { type, title, due_date, due_time?, contact_id? } | null }
 */
tasks.post("/tasks/:id/complete", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That to-do");
  const body = req.body ?? {};
  const note = f.text(5000)(body.note, "Note") as string;
  const contactId = f.uuid()(body.contact_id, "Contact") as string | null;
  const direction = f.oneOf(["outbound", "inbound"])(body.direction, "Direction") ?? "outbound";
  const next = parseNext(body);

  const result = await tx(async (t) => {
    const task = await t.one(
      "select * from tasks where id = $1 and owner_id = $2 and archived_at is null for update",
      [id, owner],
    );
    if (!task) throw notFound("That to-do");
    if (task.status === "done") throw bad("This to-do is already done.");
    await assertOwned(t, "contacts", contactId, owner, "That contact");

    const channel = channelForTaskType(task.type);
    const outcome = channel ? validateOutcome(channel, body.outcome) : null;
    let activity = null;
    if (task.account_id && (channel || note)) {
      activity = await t.one(
        `insert into activities (owner_id, account_id, contact_id, deal_id, task_id, channel, direction, outcome, summary, source)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'todo') returning *`,
        [owner, task.account_id, contactId ?? task.contact_id, task.deal_id, task.id, channel ?? "note", direction, outcome, note || task.title],
      );
    }
    await t.q(
      "update tasks set status = 'done', completed_at = now(), completion_activity_id = $2 where id = $1",
      [task.id, activity?.id ?? null],
    );
    const next_task = next
      ? await createTask(t, owner, {
          ...next,
          account_id: task.account_id,
          deal_id: task.deal_id,
          contact_id: next.contact_id ?? contactId ?? task.contact_id,
        })
      : null;
    return { activity, next_task };
  });
  res.json(result);
});

tasks.post("/tasks/:id/reopen", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That to-do");
  const row = await db.one(
    `update tasks set status = 'open', completed_at = null
     where id = $1 and owner_id = $2 and archived_at is null returning *`,
    [id, owner],
  );
  if (!row) throw notFound("That to-do");
  res.json(row);
});

tasks.delete("/tasks/:id", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That to-do");
  await db.q("update tasks set archived_at = now() where id = $1 and owner_id = $2", [id, owner]);
  res.json({ ok: true });
});
