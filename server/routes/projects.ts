import { Router } from "express";
import { db, tx } from "../db.js";
import { uid } from "../auth.js";
import { f, pick, idOf, notFound, insertSql, updateSql, type Spec } from "../validate.js";
import { OPEN_TASK_ORDER } from "../sql.js";
import { PROJECT_STAGES } from "../../shared/model.js";
import { resolveLinks } from "../domain/links.js";
import { createTask, parseNext } from "../domain/tasks.js";
import { logActivity } from "../domain/activities.js";

const PROJECT_SPEC: Spec = {
  name: [f.required(200), "Project name"],
  stage: [f.oneOf(PROJECT_STAGES.map((s) => s.key), false), "Stage"],
  account_id: [f.uuid(), "Company"],
  contact_id: [f.uuid(), "Contact"],
  waiting_on: [f.text(300), "Waiting on"],
  target_date: [f.date(), "Target date"],
  notes: [f.text(20000), "Notes"],
};

const LIST_SQL = `
  select p.id, p.name, p.stage, p.account_id, a.name as account_name, p.waiting_on, p.target_date,
         p.stage_changed_at, p.done_at, p.updated_at,
         case when ns.id is null then null else json_build_object(
           'id', ns.id, 'title', ns.title, 'type', ns.type, 'due_date', ns.due_date, 'due_time', to_char(ns.due_time, 'HH24:MI')
         ) end as next_step,
         coalesce(oc.n, 0) as open_tasks,
         la.last_activity_at
  from projects p
  left join accounts a on a.id = p.account_id
  left join lateral (
    select t.id, t.title, t.type, t.due_date, t.due_time from tasks t
    where t.project_id = p.id and t.status = 'open' and t.archived_at is null
    order by ${OPEN_TASK_ORDER} limit 1
  ) ns on true
  left join lateral (
    select count(*)::int as n from tasks t where t.project_id = p.id and t.status = 'open' and t.archived_at is null
  ) oc on true
  left join lateral (
    select max(x.occurred_at) as last_activity_at from activities x where x.project_id = p.id and x.archived_at is null
  ) la on true`;

export const projects = Router();

/** All projects. Done ones only from the last 30 days unless ?all=1. */
projects.get("/projects", async (req, res) => {
  const owner = uid(req);
  const all = req.query.all === "1";
  const accountId = typeof req.query.account_id === "string" && req.query.account_id ? idOf(req.query.account_id) : null;
  res.json(
    await db.q(
      `${LIST_SQL}
       where p.owner_id = $1 and p.archived_at is null
         and ($2::boolean or p.stage <> 'done' or p.done_at > now() - interval '30 days')
         and ($3::uuid is null or p.account_id = $3)
       order by p.stage_changed_at desc`,
      [owner, all, accountId],
    ),
  );
});

/** Create a project, optionally with its first to-do. */
projects.post("/projects", async (req, res) => {
  const owner = uid(req);
  const cols = pick({ stage: "todo", ...req.body }, PROJECT_SPEC, false);
  const next = parseNext(req.body);
  const project = await tx(async (t) => {
    const links = await resolveLinks(t, owner, { account_id: cols.account_id as string | null, contact_id: cols.contact_id as string | null });
    const done = cols.stage === "done" ? { done_at: new Date().toISOString() } : {};
    const { text, values } = insertSql("projects", { ...cols, ...links, ...done, owner_id: owner });
    const row = await t.one(text, values);
    if (next) await createTask(t, owner, { ...next, project_id: row.id });
    return row;
  });
  res.status(201).json(project);
});

projects.get("/projects/:id", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That project");
  const project = await db.one(
    `select p.*, a.name as account_name from projects p left join accounts a on a.id = p.account_id
     where p.id = $1 and p.owner_id = $2`,
    [id, owner],
  );
  if (!project) throw notFound("That project");
  const [tasks, done_tasks, activities, contacts] = await Promise.all([
    db.q(
      `select t.id, t.title, t.type, t.due_date, t.due_time, t.priority, t.contact_id, t.project_id from tasks t
       where t.project_id = $1 and t.status = 'open' and t.archived_at is null order by ${OPEN_TASK_ORDER}`,
      [id],
    ),
    db.q(
      `select t.id, t.title, t.type, t.due_date, t.due_time, t.priority, t.contact_id, t.project_id, t.completed_at from tasks t
       where t.project_id = $1 and t.status = 'done' and t.archived_at is null order by t.completed_at desc limit 50`,
      [id],
    ),
    db.q(
      `select x.*, c.name as contact_name, a.name as account_name from activities x
       left join contacts c on c.id = x.contact_id left join accounts a on a.id = x.account_id
       where x.project_id = $1 and x.archived_at is null order by x.occurred_at desc limit 200`,
      [id],
    ),
    project.account_id
      ? db.q(
          `select id, name, role, email, phone, linkedin_url, do_not_contact from contacts
           where account_id = $1 and archived_at is null order by name`,
          [project.account_id],
        )
      : Promise.resolve([]),
  ]);
  res.json({ project, tasks, done_tasks, activities, contacts });
});

projects.patch("/projects/:id", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That project");
  const row = await tx(async (t) => {
    const existing = await t.one<{ stage: string; account_id: string | null; contact_id: string | null }>(
      "select stage, account_id, contact_id from projects where id = $1 and owner_id = $2 and archived_at is null for update",
      [id, owner],
    );
    if (!existing) throw notFound("That project");
    const cols = pick(req.body, PROJECT_SPEC, true);
    if ("account_id" in cols || "contact_id" in cols) {
      const links = await resolveLinks(t, owner, {
        account_id: "account_id" in cols ? (cols.account_id as string | null) : existing.account_id,
        contact_id: "contact_id" in cols ? (cols.contact_id as string | null) : existing.contact_id,
      });
      cols.account_id = links.account_id ?? null;
      cols.contact_id = links.contact_id ?? null;
      // Keep the project's to-dos and log on the same company.
      if (cols.account_id !== existing.account_id) {
        await t.q("update tasks set account_id = $2 where project_id = $1", [id, cols.account_id]);
        await t.q("update activities set account_id = coalesce($2, account_id) where project_id = $1", [id, cols.account_id]);
      }
    }
    if (cols.stage && cols.stage !== existing.stage) {
      cols.stage_changed_at = new Date().toISOString();
      cols.done_at = cols.stage === "done" ? new Date().toISOString() : null;
    }
    // Optional extras that come with a stage change, all in the same transaction.
    const outcome = f.text(5000)(req.body?.outcome_note, "Outcome") as string;
    const followUp = req.body?.follow_up ? parseNext({ next: req.body.follow_up }) : null;
    const { text, values } = updateSql("projects", id, owner, cols);
    const updated = await t.one(text, values);
    if (req.body?.close_open_tasks === true) {
      await t.q(
        "update tasks set status = 'done', completed_at = now() where project_id = $1 and owner_id = $2 and status <> 'done' and archived_at is null",
        [id, owner],
      );
    }
    if (outcome) await logActivity(t, owner, { project_id: id, channel: "note", summary: outcome });
    if (followUp) await createTask(t, owner, { ...followUp, project_id: id });
    return updated;
  });
  res.json(row);
});

/** Archive. Its open to-dos leave the to-do list with it. */
projects.delete("/projects/:id", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That project");
  await db.q("update projects set archived_at = now() where id = $1 and owner_id = $2", [id, owner]);
  res.json({ ok: true });
});
