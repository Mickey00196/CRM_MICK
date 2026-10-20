import { Router } from "express";
import { db } from "../db.js";
import { uid } from "../auth.js";
import { pick, idOf, bad, notFound, insertSql, updateSql } from "../validate.js";
import { OPEN_TASK_ORDER, assertOwned } from "../sql.js";
import { CONTACT_SPEC } from "./accounts.js";

const LAST_CONTACTED = `(select max(x.occurred_at) from activities x
  where x.contact_id = c.id and x.archived_at is null and x.channel <> 'note') as last_contacted_at`;

export const contacts = Router();

contacts.get("/contacts", async (req, res) => {
  const owner = uid(req);
  res.json(
    await db.q(
      `select c.*, a.name as account_name, ${LAST_CONTACTED}
       from contacts c left join accounts a on a.id = c.account_id
       where c.owner_id = $1 and c.archived_at is null and (a.id is null or a.archived_at is null)
       order by lower(c.name)`,
      [owner],
    ),
  );
});

contacts.post("/contacts", async (req, res) => {
  const owner = uid(req);
  const cols = pick(req.body, CONTACT_SPEC, false);
  await assertOwned(db, "accounts", cols.account_id as string, owner, "That account");
  if (cols.do_not_contact) cols.opt_out_at = new Date().toISOString();
  const { text, values } = insertSql("contacts", { ...cols, owner_id: owner });
  res.status(201).json(await db.one(text, values));
});

contacts.get("/contacts/:id", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That contact");
  const contact = await db.one(
    `select c.*, a.name as account_name, ${LAST_CONTACTED}
     from contacts c left join accounts a on a.id = c.account_id
     where c.id = $1 and c.owner_id = $2 and c.archived_at is null`,
    [id, owner],
  );
  if (!contact) throw notFound("That contact");
  const [activities, tasks] = await Promise.all([
    db.q(
      `select x.*, a.name as account_name, c.name as contact_name
       from activities x join accounts a on a.id = x.account_id left join contacts c on c.id = x.contact_id
       where x.contact_id = $1 and x.archived_at is null order by x.occurred_at desc limit 200`,
      [id],
    ),
    db.q(
      `select t.id, t.title, t.type, t.due_date, t.due_time, t.priority, t.contact_id from tasks t
       where t.contact_id = $1 and t.status = 'open' and t.archived_at is null order by ${OPEN_TASK_ORDER}`,
      [id],
    ),
  ]);
  res.json({ contact, activities, tasks });
});

contacts.patch("/contacts/:id", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That contact");
  const cols = pick(req.body, CONTACT_SPEC, true);
  if ("name" in cols && !cols.name) throw bad("Name is required.");
  await assertOwned(db, "accounts", cols.account_id as string, owner, "That account");
  // Opting out records when it happened; opting back in clears it.
  if (cols.do_not_contact === true) {
    const current = await db.one("select opt_out_at from contacts where id = $1 and owner_id = $2", [id, owner]);
    if (current && !current.opt_out_at) cols.opt_out_at = new Date().toISOString();
  } else if (cols.do_not_contact === false) {
    cols.opt_out_at = null;
  }
  const { text, values } = updateSql("contacts", id, owner, cols);
  const row = await db.one(text, values);
  if (!row) throw notFound("That contact");
  res.json(row);
});

contacts.delete("/contacts/:id", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That contact");
  await db.q("update contacts set archived_at = now() where id = $1 and owner_id = $2", [id, owner]);
  res.json({ ok: true });
});
