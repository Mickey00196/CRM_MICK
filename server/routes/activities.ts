import { Router } from "express";
import { db, tx } from "../db.js";
import { uid } from "../auth.js";
import { f, pick, idOf, bad, notFound, updateSql, type Spec } from "../validate.js";
import { assertOwned, businessDaysFromNow } from "../sql.js";
import { TIMEZONE } from "../time.js";
import { CHANNELS } from "../../shared/model.js";
import { createTask, parseNext, validateOutcome } from "./tasks.js";

const CHANNEL_KEYS = CHANNELS.map((c) => c.key);
const REPLY_DAYS = 5;

const ACTIVITY_SPEC: Spec = {
  account_id: [f.uuid(false), "Account"],
  contact_id: [f.uuid(), "Contact"],
  deal_id: [f.uuid(), "Deal"],
  channel: [f.oneOf(CHANNEL_KEYS, false), "Channel"],
  direction: [f.oneOf(["outbound", "inbound"], false), "Direction"],
  summary: [f.text(20000), "Summary"],
  occurred_at: [f.timestamp(), "Date"],
  expect_reply: [f.bool(), "Expect reply"],
};

const SELECT = `
  select x.*, a.name as account_name, c.name as contact_name
  from activities x
  join accounts a on a.id = x.account_id
  left join contacts c on c.id = x.contact_id`;

export const activities = Router();

activities.get("/activities", async (req, res) => {
  const owner = uid(req);
  const where = ["x.owner_id = $1", "x.archived_at is null", "a.archived_at is null"];
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
  if (typeof qs.from === "string" && qs.from) add(`x.occurred_at >= (?::date)::timestamp at time zone '${TIMEZONE}'`, f.date()(qs.from, "From"));
  if (typeof qs.to === "string" && qs.to) add(`x.occurred_at < ((?::date) + 1)::timestamp at time zone '${TIMEZONE}'`, f.date()(qs.to, "To"));
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
     from activities x join accounts a on a.id = x.account_id
     where x.owner_id = $1 and x.archived_at is null and a.archived_at is null
       and x.occurred_at at time zone $2 >= date_trunc('week', now() at time zone $2) - make_interval(weeks => $3)
     group by 1, 2 order by 1`,
    [owner, TIMEZONE, weeks - 1],
  );
  res.json(rows);
});

activities.post("/activities", async (req, res) => {
  const owner = uid(req);
  const body = { direction: "outbound", ...req.body };
  const cols = pick(body, ACTIVITY_SPEC, false);
  cols.outcome = validateOutcome(cols.channel as string, body.outcome);
  cols.source = f.oneOf(["manual", "quick_capture"])(body.source, "Source") ?? "manual";
  if (!cols.occurred_at) delete cols.occurred_at;
  if (cols.channel === "note" && !cols.summary) throw bad("Write something in the note.");
  if (cols.expect_reply) {
    const from = cols.occurred_at ? new Date(cols.occurred_at as string) : new Date();
    cols.reply_due_at = businessDaysFromNow(REPLY_DAYS, from).toISOString();
  }
  const next = parseNext(body);
  const completeTaskId = f.uuid()(body.complete_task_id, "To-do") as string | null;

  const result = await tx(async (t) => {
    await assertOwned(t, "accounts", cols.account_id as string, owner, "That account");
    if (completeTaskId) {
      const open = await t.one(
        `select id from tasks where id = $1 and owner_id = $2 and account_id = $3 and status = 'open' and archived_at is null`,
        [completeTaskId, owner, cols.account_id],
      );
      if (!open) throw bad("That to-do is no longer open.");
      cols.task_id = completeTaskId;
    }
    await assertOwned(t, "contacts", cols.contact_id as string, owner, "That contact");
    await assertOwned(t, "deals", cols.deal_id as string, owner, "That deal");
    const keys = Object.keys(cols);
    const activity = await t.one(
      `insert into activities (owner_id, ${keys.join(", ")}) values ($1, ${keys.map((_, i) => `$${i + 2}`).join(", ")}) returning *`,
      [owner, ...Object.values(cols)],
    );
    if (completeTaskId) {
      await t.q("update tasks set status = 'done', completed_at = now(), completion_activity_id = $2 where id = $1", [
        completeTaskId,
        activity.id,
      ]);
    }
    // An inbound reply clears anything waiting on a reply from this account.
    if (cols.direction === "inbound" && cols.channel !== "note") {
      await t.q(
        `update activities set replied_at = $3
         where owner_id = $1 and account_id = $2 and expect_reply and replied_at is null and occurred_at <= $3`,
        [owner, cols.account_id, activity.occurred_at],
      );
    }
    const next_task = next
      ? await createTask(t, owner, {
          ...next,
          account_id: cols.account_id,
          deal_id: cols.deal_id,
          contact_id: next.contact_id ?? cols.contact_id,
        })
      : null;
    return { activity, next_task };
  });
  res.status(201).json(result);
});

activities.patch("/activities/:id", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That log entry");
  const existing = await db.one("select channel from activities where id = $1 and owner_id = $2 and archived_at is null", [id, owner]);
  if (!existing) throw notFound("That log entry");
  const { account_id: _ignore, ...spec } = ACTIVITY_SPEC;
  const cols = pick(req.body, spec, true);
  if ("outcome" in (req.body ?? {})) cols.outcome = validateOutcome((cols.channel as string) ?? existing.channel, req.body.outcome);
  await assertOwned(db, "contacts", cols.contact_id as string, owner, "That contact");
  const { text, values } = updateSql("activities", id, owner, cols);
  res.json(await db.one(text, values));
});

activities.delete("/activities/:id", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That log entry");
  await db.q("update activities set archived_at = now() where id = $1 and owner_id = $2", [id, owner]);
  res.json({ ok: true });
});
