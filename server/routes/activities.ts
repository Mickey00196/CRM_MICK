import { Router } from "express";
import { db, tx } from "../db.js";
import { uid } from "../auth.js";
import { f, idOf } from "../validate.js";
import { TIMEZONE } from "../time.js";
import { CHANNEL_KEYS, logActivity, updateActivity } from "../domain/activities.js";

const SELECT = `
  select x.*, a.name as account_name, p.name as project_name, c.name as contact_name
  from activities x
  left join accounts a on a.id = x.account_id
  left join projects p on p.id = x.project_id
  left join contacts c on c.id = x.contact_id`;

export const activities = Router();

activities.get("/activities", async (req, res) => {
  const owner = uid(req);
  const where = ["x.owner_id = $1", "x.archived_at is null", "(a.id is null or a.archived_at is null)", "(p.id is null or p.archived_at is null)"];
  const params: unknown[] = [owner];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replace("?", `$${params.length}`));
  };
  const qs = req.query;
  if (typeof qs.channel === "string" && CHANNEL_KEYS.includes(qs.channel as any)) add("x.channel = ?", qs.channel);
  if (typeof qs.outcome === "string" && qs.outcome) add("x.outcome = ?", qs.outcome);
  if (typeof qs.account_id === "string" && qs.account_id) add("x.account_id = ?", idOf(qs.account_id, "That account"));
  if (typeof qs.contact_id === "string" && qs.contact_id) add("x.contact_id = ?", idOf(qs.contact_id, "That contact"));
  if (typeof qs.project_id === "string" && qs.project_id) add("x.project_id = ?", idOf(qs.project_id, "That project"));
  if ((typeof qs.from === "string" && qs.from) || (typeof qs.to === "string" && qs.to)) params.push(TIMEZONE);
  const tz = `$${params.length}`;
  if (typeof qs.from === "string" && qs.from) add(`x.occurred_at >= (?::date)::timestamp at time zone ${tz}`, f.date()(qs.from, "From"));
  if (typeof qs.to === "string" && qs.to) add(`x.occurred_at < ((?::date) + 1)::timestamp at time zone ${tz}`, f.date()(qs.to, "To"));
  if (typeof qs.before === "string" && qs.before) add("x.occurred_at < ?", f.timestamp()(qs.before, "Before"));
  const limit = Math.min(Math.max(Number(qs.limit) || 100, 1), 500);
  const rows = await db.q(`${SELECT} where ${where.join(" and ")} order by x.occurred_at desc, x.id desc limit ${limit}`, params);
  res.json(rows);
});

/** Counts per ISO week (Monday start, local time) and channel, for the last N weeks. */
activities.get("/activities/weekly", async (req, res) => {
  const owner = uid(req);
  const weeks = Math.min(Math.max(Number(req.query.weeks) || 8, 1), 52);
  const rows = await db.q(
    `select to_char(date_trunc('week', x.occurred_at at time zone $2), 'YYYY-MM-DD') as week,
            x.channel, count(*)::int as n
     from activities x left join accounts a on a.id = x.account_id
     where x.owner_id = $1 and x.archived_at is null and (a.id is null or a.archived_at is null)
       and x.occurred_at at time zone $2 >= date_trunc('week', now() at time zone $2) - make_interval(weeks => $3)
     group by 1, 2 order by 1`,
    [owner, TIMEZONE, weeks - 1],
  );
  res.json(rows);
});

activities.post("/activities", async (req, res) => {
  const owner = uid(req);
  res.status(201).json(await tx((t) => logActivity(t, owner, req.body)));
});

activities.patch("/activities/:id", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That log entry");
  res.json(await tx((t) => updateActivity(t, owner, id, req.body)));
});

activities.delete("/activities/:id", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That log entry");
  await db.q("update activities set archived_at = now() where id = $1 and owner_id = $2", [id, owner]);
  res.json({ ok: true });
});
