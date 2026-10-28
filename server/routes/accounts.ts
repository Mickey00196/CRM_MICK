import { Router } from "express";
import { db, tx, type Db } from "../db.js";
import { uid } from "../auth.js";
import { f, pick, idOf, bad, notFound, insertSql, updateSql, normalizeDomain, HttpError, type Spec } from "../validate.js";
import { csvCell, dmy } from "../csv.js";
import { LAST_CONTACT, NEXT_STEP, OPEN_TASK_ORDER, PRIMARY_OFFICE } from "../sql.js";
import {
  ACCOUNT_STATUSES,
  type AccountStatus,
  BUYING_ROLES,
  GROWTH,
  ICP_FIT,
  LANGUAGES,
  SIZE_BANDS,
  TENURES,
  accountStatusLabel,
} from "../../shared/model.js";
import { createTask, parseNext } from "../domain/tasks.js";
import { PENDING_TIMEOUT_MS, aiEnabled, startLookup } from "../domain/enrich.js";
import { setAccountStatus } from "../domain/funnel.js";
import { listOptions } from "./opportunity.js";

const keys = (opts: readonly { key: string }[]) => opts.map((o) => o.key);

const ACCOUNT_SPEC: Spec = {
  name: [f.required(200), "Account name"],
  website: [f.text(300), "Website"],
  industry: [f.text(200), "Industry"],
  size_band: [f.oneOf(keys(SIZE_BANDS)), "Company size"],
  status: [f.oneOf(keys(ACCOUNT_STATUSES), false), "Status"],
  icp_fit: [f.oneOf(keys(ICP_FIT)), "ICP fit"],
  lead_source: [f.text(200), "Lead source"],
  language: [f.oneOf(keys(LANGUAGES), false), "Language"],
  tags: [f.tags(), "Tags"],
  notes: [f.text(20000), "Notes"],
  custom_fields: [f.json(), "Custom fields"],
};

export const OFFICE_SPEC: Spec = {
  is_primary: [f.bool(), "Primary"],
  is_current: [f.bool(), "Current"],
  building_name: [f.text(200), "Building"],
  address: [f.text(300), "Address"],
  postcode: [f.text(20), "Postcode"],
  city: [f.text(100), "City"],
  submarket: [f.text(100), "Area"],
  floors: [f.text(100), "Floors"],
  area_m2: [f.int(0, 1_000_000), "Floor area"],
  workstations: [f.int(0, 100_000), "Workstations"],
  headcount: [f.int(0, 1_000_000), "Headcount"],
  meeting_rooms: [f.int(0, 10_000), "Meeting rooms"],
  parking_spaces: [f.int(0, 100_000), "Parking spaces"],
  hybrid_policy: [f.text(300), "Hybrid policy"],
  fit_out_condition: [f.text(300), "Fit-out condition"],
  tenure: [f.oneOf(keys(TENURES)), "Tenure"],
  landlord: [f.text(200), "Landlord"],
  landlord_agent: [f.text(200), "Landlord's agent"],
  lease_start: [f.date(), "Lease start"],
  lease_end: [f.date(), "Lease end"],
  initial_term_months: [f.int(0, 1200), "Initial term"],
  renewal_options: [f.text(500), "Renewal options"],
  notice_months: [f.int(0, 120), "Notice period"],
  break_dates: [f.dates(), "Break dates"],
  sublet_allowed: [f.boolOrNull(), "Sublet allowed"],
  rent_per_m2: [f.num(), "Rent per m²"],
  annual_rent: [f.num(), "Annual rent"],
  service_charges: [f.num(), "Service charges"],
  parking_rent: [f.num(), "Parking rent"],
  indexation: [f.text(200), "Indexation"],
  rent_free_months: [f.num(), "Rent-free months"],
  fitout_contribution: [f.num(), "Fit-out contribution"],
  guarantee: [f.text(300), "Bank guarantee / deposit"],
  satisfaction: [f.int(1, 5), "Satisfaction"],
  pain_points: [f.text(5000), "Pain points"],
  growth_outlook: [f.oneOf(keys(GROWTH)), "Growth outlook"],
  re_decision_maker: [f.text(300), "Real estate decision maker"],
  notes: [f.text(20000), "Notes"],
  custom_fields: [f.json(), "Custom fields"],
};

export const CONTACT_SPEC: Spec = {
  account_id: [f.uuid(), "Account"],
  name: [f.required(200), "Name"],
  role: [f.text(200), "Role"],
  buying_role: [f.oneOf(keys(BUYING_ROLES)), "Buying role"],
  email: [f.text(300), "Email"],
  phone: [f.text(60), "Phone"],
  linkedin_url: [f.text(500), "LinkedIn"],
  language: [f.oneOf(keys(LANGUAGES)), "Language"],
  do_not_contact: [f.bool(), "Do not contact"],
  lawful_basis: [f.oneOf(["legitimate_interest", "consent", "contract"]), "Lawful basis"],
  notes: [f.text(20000), "Notes"],
  custom_fields: [f.json(), "Custom fields"],
};

function accountCols(body: any, partial: boolean) {
  const cols = pick(body, ACCOUNT_SPEC, partial);
  if (body && "domain" in body && body.domain) cols.domain = normalizeDomain(body.domain, true);
  else if (body && "domain" in body) cols.domain = null;
  else if (!partial) cols.domain = normalizeDomain(body?.website, false);
  return cols;
}

async function duplicateDomain(t: Db, owner: string, domain: unknown, exceptId?: string) {
  if (!domain) return;
  const dup = await t.one(
    `select id, name from accounts where owner_id = $1 and lower(domain) = lower($2) and archived_at is null
     and ($3::uuid is null or id <> $3)`,
    [owner, domain, exceptId ?? null],
  );
  if (dup) throw new HttpError(409, `${dup.name} already uses ${domain}.`, { existing_id: dup.id, existing_name: dup.name });
}

/** Keeps exactly one primary office per account. */
async function setPrimary(t: Db, accountId: string, officeId: string) {
  await t.q("update office_locations set is_primary = false where account_id = $1 and id <> $2 and is_primary", [accountId, officeId]);
  await t.q("update office_locations set is_primary = true where id = $1", [officeId]);
}

const LIST_SQL = `
  select a.id, a.name, a.domain, a.status, a.industry, a.lead_source, a.language, a.tags, a.archived_at, a.created_at,
    po.city as office_city, po.submarket as office_submarket, po.building_name as office_building,
    po.area_m2, po.lease_end,
    case when ns.id is null then null else json_build_object(
      'id', ns.id, 'title', ns.title, 'type', ns.type, 'due_date', ns.due_date, 'due_time', to_char(ns.due_time, 'HH24:MI')
    ) end as next_step,
    lc.last_contact_at
  from accounts a
  ${PRIMARY_OFFICE}
  ${NEXT_STEP}
  ${LAST_CONTACT}`;

export const accounts = Router();

accounts.get("/accounts", async (req, res) => {
  const owner = uid(req);
  const archived = req.query.archived === "1";
  res.json(await db.q(`${LIST_SQL} where a.owner_id = $1 and ($2::boolean or a.archived_at is null) order by lower(a.name)`, [owner, archived]));
});

accounts.get("/accounts/export.csv", async (req, res) => {
  const owner = uid(req);
  const sep = req.query.sep === "comma" ? "," : ";";
  const rows = await db.q(`${LIST_SQL} where a.owner_id = $1 and a.archived_at is null order by lower(a.name)`, [owner]);
  const header = ["Company", "Status", "Domain", "Industry", "Lead source", "Language", "Tags", "City", "Area", "Building", "m²", "Lease end", "Next step", "Next step due", "Last contact"];
  const lines = rows.map((r) =>
    [
      r.name,
      accountStatusLabel(r.status),
      r.domain,
      r.industry,
      r.lead_source,
      r.language?.toUpperCase(),
      (r.tags ?? []).join(", "),
      r.office_city,
      r.office_submarket,
      r.office_building,
      r.area_m2,
      dmy(r.lease_end),
      r.next_step?.title,
      dmy(r.next_step?.due_date ?? null),
      r.last_contact_at ? dmy(new Date(r.last_contact_at).toISOString().slice(0, 10)) : "",
    ]
      .map((v) => csvCell(v, sep))
      .join(sep),
  );
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="accounts-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send("﻿" + [header.join(sep), ...lines].join("\r\n"));
});

/**
 * Create an account, optionally with its primary office, a first contact and a next step.
 * Pass force: true to create it even when an account with the same name exists.
 */
accounts.post("/accounts", async (req, res) => {
  const owner = uid(req);
  const body = { status: "lead", language: "nl", ...req.body };
  const cols = accountCols(body, false);
  const office = body.office ? pick(body.office, OFFICE_SPEC, true) : null;
  const contact = body.contact?.name ? pick(body.contact, CONTACT_SPEC, true) : null;
  const next = parseNext(body);

  const result = await tx(async (t) => {
    if (!body.force) {
      const same = await t.one(
        "select id, name from accounts where owner_id = $1 and lower(name) = lower($2) and archived_at is null",
        [owner, cols.name],
      );
      if (same)
        throw new HttpError(409, `You already have an account called ${same.name}.`, {
          existing_id: same.id,
          existing_name: same.name,
          can_force: true,
        });
    }
    await duplicateDomain(t, owner, cols.domain);
    const ins = insertSql("accounts", { ...cols, owner_id: owner });
    const account = await t.one(ins.text, ins.values);

    if (office && Object.values(office).some((v) => v !== "" && v !== null && !(Array.isArray(v) && !v.length))) {
      const o = insertSql("office_locations", { ...office, is_primary: true, is_current: true, owner_id: owner, account_id: account.id });
      await t.one(o.text, o.values);
    }
    let contactRow = null;
    if (contact) {
      const c = insertSql("contacts", { ...contact, owner_id: owner, account_id: account.id });
      contactRow = await t.one(c.text, c.values);
    }
    if (next) {
      await createTask(t, owner, { ...next, account_id: account.id, contact_id: contactRow?.id ?? null });
    }
    return account;
  });
  // Look the company up from its website in the background; the account page shows it when it's in.
  if (aiEnabled() && (result.website || result.domain)) await startLookup(owner, result.id);
  res.status(201).json(result);
});

/** Run (or rerun) the AI lookup for an account. Returns straight away; the page polls. */
accounts.post("/accounts/:id/lookup", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That account");
  if (!aiEnabled()) throw bad("AI lookup is off. Add ANTHROPIC_API_KEY to the crm service in Railway, then try again.");
  const acc = await db.one<{ website: string; domain: string | null }>(
    "select website, domain from accounts where id = $1 and owner_id = $2 and archived_at is null",
    [id, owner],
  );
  if (!acc) throw notFound("That account");
  if (!acc.website && !acc.domain) throw bad("Add the company's website first.");
  await startLookup(owner, id);
  res.status(202).json({ ai_status: "pending" });
});

accounts.get("/accounts/:id", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That account");
  const account = await db.one("select * from accounts where id = $1 and owner_id = $2", [id, owner]);
  if (!account) throw notFound("That account");
  const [offices, contacts, tasks, lc, projects, options] = await Promise.all([
    db.q(
      `select * from office_locations where account_id = $1 and archived_at is null
       order by is_current desc, is_primary desc, lease_end desc nulls last, created_at`,
      [id],
    ),
    db.q(
      `select c.*, (select max(x.occurred_at) from activities x
                    where x.contact_id = c.id and x.archived_at is null and x.channel not in ('note', 'stage')) as last_contacted_at
       from contacts c where c.account_id = $1 and c.archived_at is null order by c.name`,
      [id],
    ),
    db.q(
      `select t.id, t.title, t.type, t.due_date, t.due_time, t.priority, t.contact_id, t.project_id, p.name as project_name
       from tasks t left join projects p on p.id = t.project_id
       where t.account_id = $1 and t.status = 'open' and t.archived_at is null order by ${OPEN_TASK_ORDER}`,
      [id],
    ),
    db.one(
      `select max(occurred_at) as last_contact_at from activities
       where account_id = $1 and archived_at is null and channel not in ('note', 'stage')`,
      [id],
    ),
    db.q(
      `select p.id, p.name, p.stage, p.waiting_on, p.target_date, p.done_at, p.stage_changed_at from projects p
       where p.account_id = $1 and p.archived_at is null
       order by (p.stage = 'done'), p.stage_changed_at desc`,
      [id],
    ),
    listOptions(db, id),
  ]);
  // A lookup stuck on "pending" (server restarted mid-way) shows as failed so it can be retried.
  if (account.ai_status === "pending" && Date.now() - new Date(account.ai_updated_at).getTime() > PENDING_TIMEOUT_MS) {
    account.ai_status = "failed";
    account.ai_error = "The lookup was interrupted.";
  }
  res.json({ account, ai_enabled: aiEnabled(), offices, contacts, tasks, projects, options, last_contact_at: lc?.last_contact_at ?? null });
});

accounts.patch("/accounts/:id", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That account");
  const { status, ...cols } = accountCols(req.body, true);
  await duplicateDomain(db, owner, cols.domain, id);
  const row = await tx(async (t) => {
    // A status change goes through setAccountStatus so it shows up in the log.
    if (status !== undefined && (await setAccountStatus(t, owner, id, status as AccountStatus)) === null) return null;
    if (!Object.keys(cols).length) return t.one("select * from accounts where id = $1 and owner_id = $2", [id, owner]);
    const { text, values } = updateSql("accounts", id, owner, cols);
    return t.one(text, values);
  });
  if (!row) throw notFound("That account");
  res.json(row);
});

accounts.post("/accounts/bulk", async (req, res) => {
  const owner = uid(req);
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((v: unknown) => idOf(v, "An account")) : [];
  if (!ids.length) throw bad("Select at least one account.");
  if (req.body.action === "archive") {
    await db.q("update accounts set archived_at = now() where owner_id = $1 and id = any($2::uuid[]) and archived_at is null", [owner, ids]);
  } else if (req.body.action === "status") {
    const status = f.oneOf(keys(ACCOUNT_STATUSES), false)(req.body.status, "Status") as AccountStatus;
    await tx(async (t) => {
      for (const one of ids) await setAccountStatus(t, owner, one, status);
    });
  } else {
    throw bad("Unknown bulk action.");
  }
  res.json({ ok: true, count: ids.length });
});

accounts.delete("/accounts/:id", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That account");
  await db.q("update accounts set archived_at = now() where id = $1 and owner_id = $2", [id, owner]);
  res.json({ ok: true });
});

accounts.post("/accounts/:id/restore", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That account");
  await db.q("update accounts set archived_at = null where id = $1 and owner_id = $2", [id, owner]);
  res.json({ ok: true });
});

// ---------- office locations ----------

accounts.post("/accounts/:id/offices", async (req, res) => {
  const owner = uid(req);
  const accountId = idOf(req.params.id, "That account");
  const cols = pick({ is_current: true, ...req.body }, OFFICE_SPEC, true);
  const row = await tx(async (t) => {
    const account = await t.one("select id from accounts where id = $1 and owner_id = $2 and archived_at is null", [accountId, owner]);
    if (!account) throw notFound("That account");
    const hasPrimary = await t.one(
      "select 1 from office_locations where account_id = $1 and is_primary and archived_at is null",
      [accountId],
    );
    const makePrimary = cols.is_primary === true || !hasPrimary;
    const ins = insertSql("office_locations", { ...cols, is_primary: false, owner_id: owner, account_id: accountId });
    const office = await t.one(ins.text, ins.values);
    if (makePrimary) await setPrimary(t, accountId, office.id);
    return t.one("select * from office_locations where id = $1", [office.id]);
  });
  res.status(201).json(row);
});

accounts.patch("/offices/:id", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That office");
  const cols = pick(req.body, OFFICE_SPEC, true);
  const row = await tx(async (t) => {
    const office = await t.one("select account_id from office_locations where id = $1 and owner_id = $2 and archived_at is null", [id, owner]);
    if (!office) throw notFound("That office");
    const { is_primary, ...rest } = cols;
    if (Object.keys(rest).length) {
      const { text, values } = updateSql("office_locations", id, owner, rest);
      await t.one(text, values);
    }
    if (is_primary === true) await setPrimary(t, office.account_id, id);
    return t.one("select * from office_locations where id = $1", [id]);
  });
  res.json(row);
});

accounts.delete("/offices/:id", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That office");
  await db.q("update office_locations set archived_at = now(), is_primary = false where id = $1 and owner_id = $2", [id, owner]);
  res.json({ ok: true });
});
