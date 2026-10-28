import { Router } from "express";
import { db } from "../db.js";
import { uid } from "../auth.js";
import { sendDigest, digestEnabled } from "../digest.js";
import { channelLabel, taskTypeLabel } from "../../shared/model.js";

export const misc = Router();

function snippet(text: string, term: string, size = 80): string {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  const at = flat.toLowerCase().indexOf(term.toLowerCase());
  if (flat.length <= size) return flat;
  const start = at < 0 ? 0 : Math.max(0, at - 25);
  return (start > 0 ? "…" : "") + flat.slice(start, start + size) + (start + size < flat.length ? "…" : "");
}

misc.get("/search", async (req, res) => {
  const owner = uid(req);
  const term = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (term.length < 2) return res.json([]);
  const like = `%${term.replace(/[\\%_]/g, "\\$&")}%`;

  const [accounts, contacts, acts, tasks] = await Promise.all([
    db.q(
      `select distinct on (a.id) a.id, a.name, a.status, o.city, o.submarket
       from accounts a left join office_locations o on o.account_id = a.id and o.archived_at is null
       where a.owner_id = $1 and a.archived_at is null
         and (a.name ilike $2 or a.domain ilike $2 or a.industry ilike $2 or array_to_string(a.tags, ' ') ilike $2
              or o.city ilike $2 or o.submarket ilike $2 or o.building_name ilike $2 or o.address ilike $2)
       order by a.id, o.is_primary desc limit 10`,
      [owner, like],
    ),
    db.q(
      `select c.id, c.name, c.role, c.email, c.account_id, a.name as account_name
       from contacts c left join accounts a on a.id = c.account_id
       where c.owner_id = $1 and c.archived_at is null
         and (c.name ilike $2 or c.email ilike $2 or c.role ilike $2 or c.phone ilike $2)
       order by c.name limit 10`,
      [owner, like],
    ),
    db.q(
      `select x.id, x.account_id, x.project_id, x.channel, x.summary, x.occurred_at,
              coalesce(a.name, p.name) as subject_name
       from activities x left join accounts a on a.id = x.account_id left join projects p on p.id = x.project_id
       where x.owner_id = $1 and x.archived_at is null and (a.id is null or a.archived_at is null)
         and (p.id is null or p.archived_at is null) and x.summary ilike $2
       order by x.occurred_at desc limit 8`,
      [owner, like],
    ),
    db.q(
      `select t.id, t.title, t.type, t.account_id, t.project_id, coalesce(a.name, p.name) as subject_name
       from tasks t left join accounts a on a.id = t.account_id left join projects p on p.id = t.project_id
       where t.owner_id = $1 and t.archived_at is null and t.status = 'open' and t.title ilike $2
       order by t.due_date nulls last limit 8`,
      [owner, like],
    ),
  ]);

  res.json([
    ...accounts.map((a) => ({
      kind: "account",
      id: a.id,
      account_id: a.id,
      project_id: null,
      title: a.name,
      subtitle: [a.submarket, a.city].filter(Boolean).join(", "),
    })),
    ...contacts.map((c) => ({
      kind: "contact",
      id: c.id,
      account_id: c.account_id,
      project_id: null,
      title: c.name,
      subtitle: [c.role, c.account_name].filter(Boolean).join(" · "),
    })),
    ...tasks.map((t) => ({
      kind: "task",
      id: t.id,
      account_id: t.account_id,
      project_id: t.project_id,
      title: t.title,
      subtitle: [taskTypeLabel(t.type), t.subject_name].filter(Boolean).join(" · "),
    })),
    ...acts.map((x) => ({
      kind: "activity",
      id: x.id,
      account_id: x.account_id,
      project_id: x.project_id,
      title: snippet(x.summary, term),
      subtitle: [channelLabel(x.channel), x.subject_name].filter(Boolean).join(" · "),
    })),
  ]);
});

/** Everything you've stored, as one JSON file. */
misc.get("/export.json", async (req, res) => {
  const owner = uid(req);
  const tables = ["accounts", "office_locations", "contacts", "projects", "tasks", "activities", "options", "documents", "custom_field_definitions"];
  const out: Record<string, unknown> = { exported_at: new Date().toISOString() };
  for (const t of tables) out[t] = await db.q(`select * from ${t} where owner_id = $1 order by created_at`, [owner]);
  res.setHeader("Content-Disposition", `attachment; filename="crm-export-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(out);
});

misc.get("/settings", (_req, res) => {
  res.json({ reminders: digestEnabled, reminder_to: digestEnabled ? process.env.DIGEST_TO : null });
});

misc.post("/digest/test", async (_req, res) => {
  res.json(await sendDigest({ force: true }));
});
