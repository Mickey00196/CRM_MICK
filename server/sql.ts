import type { Db } from "./db.js";
import { notFound } from "./validate.js";
import { todayISO } from "./time.js";

// Reusable lateral joins. Each expects the account to be aliased "a".

export const NEXT_STEP = `
  left join lateral (
    select t.id, t.title, t.type, t.due_date, t.due_time from tasks t
    where t.account_id = a.id and t.status = 'open' and t.archived_at is null
    order by t.due_date asc nulls last, t.due_time asc nulls last, t.created_at asc
    limit 1
  ) ns on true`;

export const LAST_CONTACT = `
  left join lateral (
    select max(x.occurred_at) as last_contact_at from activities x
    where x.account_id = a.id and x.archived_at is null and x.channel not in ('note', 'stage')
  ) lc on true`;

export const PRIMARY_OFFICE = `
  left join lateral (
    select o.id, o.building_name, o.city, o.submarket, o.area_m2, o.lease_end, o.notice_months, o.break_dates
    from office_locations o
    where o.account_id = a.id and o.archived_at is null and o.is_current
    order by o.is_primary desc, o.created_at asc
    limit 1
  ) po on true`;

export const OPEN_TASK_ORDER = `t.due_date asc nulls last, t.due_time asc nulls last, (t.priority = 'high') desc, t.created_at asc`;

/** Throws 404 unless the row exists, belongs to the owner and isn't archived. */
export async function assertOwned(db: Db, table: string, id: string | null | undefined, owner: string, what: string) {
  if (!id) return;
  const row = await db.one(`select 1 from ${table} where id = $1 and owner_id = $2 and archived_at is null`, [id, owner]);
  if (!row) throw notFound(what);
}

/** Moves a date that lands on a weekend to the Monday after. */
export function skipWeekend(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  const day = d.getUTCDay();
  if (day === 6) d.setUTCDate(d.getUTCDate() + 2);
  if (day === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Adds n business days to today. */
export function businessDaysFromNow(n: number, from = new Date()): Date {
  const d = new Date(from);
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) left--;
  }
  return d;
}

export { todayISO };
