import { Router } from "express";
import { db, tx } from "../db.js";
import { uid } from "../auth.js";
import { pick, idOf, notFound } from "../validate.js";
import { LAST_CONTACT, OPEN_TASK_ORDER, todayISO } from "../sql.js";
import { ACTIVE_ACCOUNT_STATUSES, CLOSED_DEAL_STAGES, type TodoRow } from "../../shared/model.js";
import { TASK_SPEC, completeTask, createTask, updateTask } from "../domain/tasks.js";

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
  res.status(201).json(await tx((t) => createTask(t, owner, cols)));
});

tasks.patch("/tasks/:id", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That to-do");
  res.json(await tx((t) => updateTask(t, owner, id, req.body)));
});

/** "How did it go?": completes the to-do, logs the communication and creates the next step in one go. */
tasks.post("/tasks/:id/complete", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That to-do");
  res.json(await tx((t) => completeTask(t, owner, id, req.body ?? {})));
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
