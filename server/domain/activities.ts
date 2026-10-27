// Communication logging workflow.
import type { Db } from "../db.js";
import { f, pick, bad, notFound, updateSql, type Spec } from "../validate.js";
import { businessDaysFromNow } from "../sql.js";
import { CHANNELS } from "../../shared/model.js";
import { resolveLinks } from "./links.js";
import { createTask, parseNext, validateOutcome } from "./tasks.js";

export const CHANNEL_KEYS = CHANNELS.map((c) => c.key);
/** Business days to wait for a reply before it counts as overdue. */
export const REPLY_DAYS = 5;

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

/**
 * Logs a call, email, meeting, note… Optionally closes the open to-do it takes care of
 * (complete_task_id) and creates the next step. All or nothing; call it inside a transaction.
 */
export async function logActivity(t: Db, owner: string, body: any) {
  const input = { direction: "outbound", ...body };
  const cols = pick(input, ACTIVITY_SPEC, false);
  cols.outcome = validateOutcome(cols.channel as string, input.outcome);
  cols.source = f.oneOf(["manual", "quick_capture"])(input.source, "Source") ?? "manual";
  if (!cols.occurred_at) delete cols.occurred_at;
  if (cols.channel === "note") cols.direction = "outbound";
  if (cols.channel === "note" && !cols.summary) throw bad("Write something in the note.");
  if (cols.expect_reply && cols.direction === "outbound") {
    const from = cols.occurred_at ? new Date(cols.occurred_at as string) : new Date();
    cols.reply_due_at = businessDaysFromNow(REPLY_DAYS, from).toISOString();
  } else {
    cols.expect_reply = false;
  }
  const next = parseNext(input);
  const completeTaskId = f.uuid()(input.complete_task_id, "To-do") as string | null;

  Object.assign(
    cols,
    await resolveLinks(t, owner, {
      account_id: cols.account_id as string,
      contact_id: cols.contact_id as string | null,
      deal_id: cols.deal_id as string | null,
    }),
  );

  if (completeTaskId) {
    const open = await t.one(
      `select id from tasks where id = $1 and owner_id = $2 and account_id = $3 and status = 'open' and archived_at is null for update`,
      [completeTaskId, owner, cols.account_id],
    );
    if (!open) throw bad("That to-do is no longer open.");
    cols.task_id = completeTaskId;
  }

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
  // An inbound message clears anything waiting on a reply from this account.
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
}

export async function updateActivity(t: Db, owner: string, id: string, body: any) {
  const existing = await t.one(
    "select account_id, contact_id, deal_id, channel from activities where id = $1 and owner_id = $2 and archived_at is null",
    [id, owner],
  );
  if (!existing) throw notFound("That log entry");
  const { account_id: _accountIsFixed, ...spec } = ACTIVITY_SPEC;
  const cols = pick(body, spec, true);
  if (body && "outcome" in body) cols.outcome = validateOutcome((cols.channel as string) ?? existing.channel, body.outcome);
  if ("contact_id" in cols || "deal_id" in cols) {
    const links = await resolveLinks(t, owner, {
      account_id: existing.account_id,
      contact_id: "contact_id" in cols ? (cols.contact_id as string | null) : existing.contact_id,
      deal_id: "deal_id" in cols ? (cols.deal_id as string | null) : existing.deal_id,
    });
    cols.contact_id = links.contact_id;
    cols.deal_id = links.deal_id;
  }
  const { text, values } = updateSql("activities", id, owner, cols);
  return t.one(text, values);
}
