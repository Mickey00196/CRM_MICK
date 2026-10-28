// Per-stage data of an account (the brief, RFP, heads of terms, lease, fee) and its buildings ("options").
import { Router } from "express";
import { db, tx, type Db } from "../db.js";
import { uid } from "../auth.js";
import { bad, idOf, notFound } from "../validate.js";
import {
  OPPORTUNITY_FIELDS,
  OPTION_FIELD_MAP,
  OPTION_STATUSES,
  FieldError,
  coercePatch,
  coerceTerms,
  offerMetrics,
  type OptionRow,
  type OptionStatus,
  type Terms,
} from "../../shared/opportunity.js";
import { fetchShortlist, buildingToOption } from "../domain/brochure.js";

export const opportunity = Router();

type Values = Record<string, string | number | boolean | null>;

/** A validated patch as "set these" and "clear those". */
function split(values: Values) {
  const set: Values = {};
  const remove: string[] = [];
  for (const [k, v] of Object.entries(values)) {
    if (v === null) remove.push(k);
    else set[k] = v;
  }
  return { set, remove };
}

async function ownAccount(t: Db, owner: string, id: string, lock = false) {
  const row = await t.one<{ id: string; name: string; status: string; opportunity: Values }>(
    `select id, name, status, opportunity from accounts where id = $1 and owner_id = $2 and archived_at is null${lock ? " for update" : ""}`,
    [id, owner],
  );
  if (!row) throw notFound("That account");
  return row;
}

async function ownOption(t: Db, owner: string, id: string, lock = false) {
  const row = await t.one<OptionRow>(
    `select * from options where id = $1 and owner_id = $2 and archived_at is null${lock ? " for update" : ""}`,
    [id, owner],
  );
  if (!row) throw notFound("That building");
  return row;
}

/** A line in the account's log, filed under the stage it's at. */
async function logNote(t: Db, owner: string, accountId: string, summary: string) {
  await t.q(
    `insert into activities (owner_id, account_id, channel, summary, stage, source)
     select $1, $2, 'note', $3, status, 'manual' from accounts where id = $2`,
    [owner, accountId, summary],
  );
}

const STATUS_KEYS = OPTION_STATUSES.map((s) => s.key) as string[];
function optionStatus(v: unknown): OptionStatus {
  if (typeof v !== "string" || !STATUS_KEYS.includes(v)) throw new FieldError("That isn't a building status.");
  return v as OptionStatus;
}

export function listOptions(t: Db, accountId: string) {
  return t.q<OptionRow>("select * from options where account_id = $1 and archived_at is null order by position, created_at", [accountId]);
}

// ---------- the account's stage data ----------

opportunity.patch("/accounts/:id/opportunity", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That account");
  const { set, remove } = split(coercePatch(req.body, OPPORTUNITY_FIELDS));
  const row = await db.one<{ opportunity: Values }>(
    `update accounts set opportunity = (opportunity || $3::jsonb) - $4::text[]
     where id = $1 and owner_id = $2 and archived_at is null returning opportunity`,
    [id, owner, JSON.stringify(set), remove],
  );
  if (!row) throw notFound("That account");
  res.json(row.opportunity);
});

// ---------- buildings ----------

opportunity.post("/accounts/:id/options", async (req, res) => {
  const owner = uid(req);
  const accountId = idOf(req.params.id, "That account");
  const { set } = split(coercePatch(req.body?.data ?? {}, OPTION_FIELD_MAP));
  if (!set.name) throw bad("Give the building a name.");
  const status = req.body?.status === undefined ? "overview" : optionStatus(req.body.status);
  const row = await tx(async (t) => {
    await ownAccount(t, owner, accountId, true);
    return t.one<OptionRow>(
      `insert into options (owner_id, account_id, status, position, data)
       values ($1, $2, $3, (select coalesce(max(position) + 1, 0) from options where account_id = $2), $4)
       returning *`,
      [owner, accountId, status, JSON.stringify(set)],
    );
  });
  res.status(201).json(row);
});

opportunity.patch("/options/:id", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That building");
  const body = req.body ?? {};
  const data = body.data === undefined ? null : split(coercePatch(body.data, OPTION_FIELD_MAP));
  const status = body.status === undefined ? null : optionStatus(body.status);
  const terms = body.terms === undefined ? null : coerceTerms(body.terms);
  const position = body.position === undefined ? null : Number(body.position);
  if (position !== null && (!Number.isInteger(position) || position < 0 || position > 10_000)) throw bad("That position isn't valid.");
  if (data?.remove.includes("name")) throw bad("A building needs a name.");

  const row = await tx(async (t) => {
    const cur = await ownOption(t, owner, id, true);
    const nextData = data ? { ...Object.fromEntries(Object.entries(cur.data).filter(([k]) => !data.remove.includes(k))), ...data.set } : cur.data;
    let nextTerms: Terms = cur.terms ?? {};
    if (terms) {
      nextTerms = { ...nextTerms };
      for (const [k, sides] of Object.entries(terms)) {
        const merged = { ...(nextTerms[k] ?? {}), ...sides };
        if (Object.values(merged).every((v) => !v)) delete nextTerms[k];
        else nextTerms[k] = merged;
      }
    }
    // One building is the chosen one; choosing another puts the previous back into negotiation.
    if (status === "chosen" && cur.status !== "chosen") {
      await t.q(
        "update options set status = 'negotiating' where account_id = $1 and id <> $2 and status = 'chosen' and archived_at is null",
        [cur.account_id, id],
      );
    }
    return t.one<OptionRow>(
      `update options set data = $2, terms = $3, status = coalesce($4, status), position = coalesce($5, position)
       where id = $1 returning *`,
      [id, JSON.stringify(nextData), JSON.stringify(nextTerms), status, position],
    );
  });
  res.json(row);
});

opportunity.delete("/options/:id", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That building");
  const row = await db.one("update options set archived_at = now() where id = $1 and owner_id = $2 and archived_at is null returning id", [id, owner]);
  if (!row) throw notFound("That building");
  res.json({ ok: true });
});

/**
 * Pulls the buildings from a live shortlist link into the opportunity. New buildings are added; ones
 * already here get any missing details filled in, never overwritten. Buildings you removed stay removed.
 */
opportunity.post("/accounts/:id/options/import", async (req, res) => {
  const owner = uid(req);
  const accountId = idOf(req.params.id, "That account");
  const link = typeof req.body?.url === "string" ? req.body.url.trim() : "";
  if (!link) throw bad("Paste the live link of the shortlist.");
  await ownAccount(db, owner, accountId);

  let shortlist;
  try {
    shortlist = await fetchShortlist(link);
  } catch (e) {
    throw bad((e as Error).message);
  }
  const incoming = shortlist.buildings.slice(0, 100).map((b) => buildingToOption(b, link));

  const result = await tx(async (t) => {
    const acc = await ownAccount(t, owner, accountId, true);
    let added = 0;
    let updated = 0;
    let skipped = 0;
    for (const o of incoming) {
      const data = Object.fromEntries(Object.entries(o.data).filter(([, v]) => v !== null && v !== ""));
      const existing = await t.one<{ id: string; archived_at: string | null }>(
        "select id, archived_at from options where account_id = $1 and source_id = $2 order by archived_at nulls first limit 1",
        [accountId, o.source_id],
      );
      if (existing?.archived_at) {
        skipped++;
      } else if (existing) {
        await t.q("update options set data = $2::jsonb || data where id = $1", [existing.id, JSON.stringify(data)]);
        updated++;
      } else {
        await t.q(
          `insert into options (owner_id, account_id, status, position, source_id, data)
           values ($1, $2, 'overview', (select coalesce(max(position) + 1, 0) from options where account_id = $2), $3, $4)`,
          [owner, accountId, o.source_id, JSON.stringify(data)],
        );
        added++;
      }
    }
    if (!acc.opportunity?.overview_link) {
      await t.q("update accounts set opportunity = opportunity || $2::jsonb where id = $1", [accountId, JSON.stringify({ overview_link: link })]);
    }
    if (added) await logNote(t, owner, accountId, `Added ${added} building${added === 1 ? "" : "s"} from the shortlist "${shortlist.display_name}".`);
    return { added, updated, skipped };
  });
  res.json({ ...result, name: shortlist.display_name, options: await listOptions(db, accountId) });
});

/** The signed building becomes the account's current office, with the lease details from the agreement. */
opportunity.post("/options/:id/adopt", async (req, res) => {
  const owner = uid(req);
  const id = idOf(req.params.id, "That building");
  const office = await tx(async (t) => {
    const opt = await ownOption(t, owner, id, true);
    const acc = await ownAccount(t, owner, opt.account_id, true);
    const opp = acc.opportunity ?? {};
    if (typeof opp.adopted_office_id === "string") {
      const still = await t.one("select 1 from office_locations where id = $1 and archived_at is null", [opp.adopted_office_id]);
      if (still) throw bad("A building from this deal is already the current office. Edit it on the Offices tab.");
    }
    const d = opt.data;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    const area = num(d.offer_area_m2) ?? num(d.area_m2);
    const m = offerMetrics(d);
    const serviceYear = area && num(d.offer_service_m2) ? num(d.offer_service_m2)! * area : null;
    const parkingYear = num(d.offer_parking_spaces) && num(d.offer_parking_rate) ? num(d.offer_parking_spaces)! * num(d.offer_parking_rate)! : null;
    const fitout = area && num(d.offer_fitout_m2) ? num(d.offer_fitout_m2)! * area : null;

    // The old office is no longer where they are.
    await t.q("update office_locations set is_current = false, is_primary = false where account_id = $1 and archived_at is null", [acc.id]);
    const row = await t.one<{ id: string }>(
      `insert into office_locations (owner_id, account_id, is_current, is_primary, building_name, address, city, submarket,
         area_m2, headcount, parking_spaces, tenure, landlord, landlord_agent, lease_start, lease_end, notice_months, break_dates,
         rent_per_m2, annual_rent, service_charges, parking_rent, indexation, rent_free_months, fitout_contribution, guarantee)
       values ($1, $2, true, true, $3, $4, $5, $6, $7, $8, $9, 'lease', $10, $11, $12, $13, $14, $15,
         $16, $17, $18, $19, $20, $21, $22, $23)
       returning id`,
      [
        owner,
        acc.id,
        str(d.name).slice(0, 200),
        str(d.address).slice(0, 300),
        str(d.city).slice(0, 100),
        str(d.submarket).slice(0, 100),
        area === null ? null : Math.round(area),
        num(opp.headcount_now) === null ? null : Math.round(num(opp.headcount_now)!),
        num(d.offer_parking_spaces) === null ? null : Math.round(num(d.offer_parking_spaces)!),
        str(d.landlord).slice(0, 200),
        str(d.agent).slice(0, 200),
        str(opp.lease_start) || str(d.offer_start) || null,
        str(opp.lease_end) || null,
        num(opp.notice_months) === null ? null : Math.round(num(opp.notice_months)!),
        str(opp.first_break) ? [str(opp.first_break)] : [],
        num(d.offer_rent_m2),
        num(opp.rent_year) ?? m?.rentYear ?? null,
        serviceYear,
        parkingYear,
        str(d.offer_indexation).slice(0, 200),
        num(d.offer_rent_free_months),
        fitout,
        str(d.offer_guarantee).slice(0, 300),
      ],
    );
    await t.q("update options set status = 'negotiating' where account_id = $1 and id <> $2 and status = 'chosen' and archived_at is null", [acc.id, id]);
    await t.q("update options set status = 'chosen' where id = $1", [id]);
    await t.q("update accounts set opportunity = opportunity || $2::jsonb where id = $1", [acc.id, JSON.stringify({ adopted_office_id: row!.id })]);
    await logNote(t, owner, acc.id, `${str(d.name) || "The new building"} is now the current office.`);
    return t.one("select * from office_locations where id = $1", [row!.id]);
  });
  res.status(201).json(office);
});
