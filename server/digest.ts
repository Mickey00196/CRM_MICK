// Weekday-morning reminder email: overdue, due today, and active accounts without a next step.
// Runs only when RESEND_API_KEY and DIGEST_TO are set.
import { q, one, setMeta } from "./db.js";
import { todayISO, localParts } from "./time.js";
import { ACTIVE_ACCOUNT_STATUSES, accountStatusLabel, taskTypeLabel } from "../shared/model.js";

const apiKey = process.env.RESEND_API_KEY || "";
const to = process.env.DIGEST_TO || "";
const from = process.env.DIGEST_FROM || "CRM <onboarding@resend.dev>";
const sendAt = /^\d{2}:\d{2}$/.test(process.env.DIGEST_TIME || "") ? process.env.DIGEST_TIME! : "07:30";
const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");

export const digestEnabled = Boolean(apiKey && to);

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const dmy = (iso: string) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;

async function ownerId(): Promise<string | undefined> {
  const email = (process.env.APP_EMAIL || "").toLowerCase();
  const row = email
    ? await one<{ id: string }>("select id from users where lower(email) = $1", [email])
    : await one<{ id: string }>("select id from users order by created_at limit 1");
  return row?.id;
}

interface Due {
  title: string;
  type: string;
  due_date: string;
  account_id: string | null;
  account_name: string | null;
}

async function build(owner: string) {
  const today = todayISO();
  const due = await q<Due>(
    `select t.title, t.type, t.due_date, t.account_id, a.name as account_name
     from tasks t left join accounts a on a.id = t.account_id
     where t.owner_id = $1 and t.status = 'open' and t.archived_at is null and t.due_date <= $2
       and (a.id is null or a.archived_at is null)
     order by t.due_date, t.due_time nulls last`,
    [owner, today],
  );
  const stalled = await q<{ id: string; name: string; status: string }>(
    `select a.id, a.name, a.status from accounts a
     where a.owner_id = $1 and a.archived_at is null and a.status = any($2::text[])
       and not exists (select 1 from tasks t where t.account_id = a.id and t.status = 'open' and t.archived_at is null)
     order by a.name`,
    [owner, ACTIVE_ACCOUNT_STATUSES],
  );
  return { overdue: due.filter((d) => d.due_date < today), today: due.filter((d) => d.due_date === today), stalled };
}

function html(d: Awaited<ReturnType<typeof build>>): string {
  const link = (id: string | null, text: string) =>
    appUrl && id ? `<a href="${appUrl}/accounts/${id}" style="color:#1f4ed8;text-decoration:none">${esc(text)}</a>` : esc(text);
  const row = (t: Due, late: boolean) =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #eceae6">${t.account_name ? link(t.account_id, t.account_name) : esc(t.title)}
     <div style="color:#6b6b6b;font-size:13px">${esc(taskTypeLabel(t.type))} · ${esc(t.title)}</div></td>
     <td style="padding:8px 0;border-bottom:1px solid #eceae6;text-align:right;white-space:nowrap;color:${late ? "#b4443a" : "#6b6b6b"};font-size:13px">${dmy(t.due_date)}</td></tr>`;
  const section = (title: string, body: string) =>
    `<p style="margin:24px 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6b6b6b">${title}</p>${body}`;
  let out = `<div style="font:15px/1.5 -apple-system,Segoe UI,Arial,sans-serif;color:#1c1c1c;max-width:560px">`;
  if (d.overdue.length) out += section("Overdue", `<table width="100%" cellspacing="0">${d.overdue.map((t) => row(t, true)).join("")}</table>`);
  if (d.today.length) out += section("Today", `<table width="100%" cellspacing="0">${d.today.map((t) => row(t, false)).join("")}</table>`);
  if (d.stalled.length)
    out += section(
      "No next step",
      `<table width="100%" cellspacing="0">${d.stalled
        .map((a) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eceae6">${link(a.id, a.name)} <span style="color:#6b6b6b;font-size:13px">· ${accountStatusLabel(a.status)}</span></td></tr>`)
        .join("")}</table>`,
    );
  if (!d.overdue.length && !d.today.length && !d.stalled.length) out += `<p>Nothing due today.</p>`;
  if (appUrl) out += `<p style="margin-top:28px"><a href="${appUrl}" style="color:#1f4ed8">Open your to-dos</a></p>`;
  return out + "</div>";
}

export async function sendDigest({ force = false } = {}): Promise<{ sent: boolean; reason?: string }> {
  if (!digestEnabled) return { sent: false, reason: "Set RESEND_API_KEY and DIGEST_TO to turn on the reminder email." };
  const owner = await ownerId();
  if (!owner) return { sent: false, reason: "No login exists yet." };
  const d = await build(owner);
  if (!force && !d.overdue.length && !d.today.length && !d.stalled.length) return { sent: false, reason: "Nothing due today." };

  const parts = [d.overdue.length && `${d.overdue.length} overdue`, d.today.length && `${d.today.length} today`].filter(Boolean);
  const subject = parts.length ? `To-dos: ${parts.join(", ")}` : d.stalled.length ? `${d.stalled.length} accounts without a next step` : "Nothing due today";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: to.split(",").map((s) => s.trim()), subject, html: html(d) }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Reminder email failed:", res.status, text);
    return { sent: false, reason: `The email service returned ${res.status}: ${text.slice(0, 200)}` };
  }
  return { sent: true };
}

const MAX_ATTEMPTS = 3;

/**
 * Claims today's send so only one instance sends, at most once. A failed send is released for a retry
 * on the next tick, up to MAX_ATTEMPTS. A crash mid-send leaves the claim in place: better one missed
 * reminder than a duplicate.
 */
export async function claimToday(day: string): Promise<number | null> {
  const row = await one<{ value: string }>(
    `insert into meta (key, value) values ($1, 'sending:1')
     on conflict (key) do update set value = 'sending:' || (split_part(meta.value, ':', 2)::int + 1)
       where meta.value like 'failed:%' and split_part(meta.value, ':', 2)::int < $2
     returning value`,
    [`digest:${day}`, MAX_ATTEMPTS],
  );
  return row ? Number(row.value.split(":")[1]) : null;
}

export async function finishDay(day: string, outcome: "sent" | "skipped" | "failed", attempt: number) {
  await setMeta(`digest:${day}`, outcome === "failed" ? `failed:${attempt}` : outcome);
}

/** Runs one check: on weekdays between DIGEST_TIME and noon, sends today's reminder if nobody has yet. */
export async function digestTick(now = new Date()): Promise<void> {
  const { weekday, hhmm } = localParts(now);
  if (weekday === 0 || weekday === 6 || hhmm < sendAt || hhmm >= "12:00") return;
  const day = todayISO(now);
  const attempt = await claimToday(day);
  if (attempt === null) return;
  try {
    const result = await sendDigest();
    await finishDay(day, result.sent ? "sent" : result.reason === "Nothing due today." ? "skipped" : "failed", attempt);
    console.log(`Reminder email (attempt ${attempt}):`, result.sent ? "sent" : result.reason);
  } catch (err) {
    await finishDay(day, "failed", attempt);
    console.error(`Reminder email attempt ${attempt} failed:`, err);
  }
}

/** Checks once a minute. Returns a function that stops the schedule. */
export function startDigestSchedule(): () => void {
  if (!digestEnabled) {
    console.log("Reminder email is off (set RESEND_API_KEY and DIGEST_TO to turn it on).");
    return () => {};
  }
  console.log(`Reminder email on: weekdays at ${sendAt}.`);
  const tick = () => digestTick().catch((err) => console.error("Reminder email check failed:", err));
  const timer = setInterval(tick, 60_000);
  tick();
  return () => clearInterval(timer);
}
