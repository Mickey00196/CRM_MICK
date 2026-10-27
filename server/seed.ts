// Demo data so the screens have something to show. Only runs on an empty CRM.
// Usage: npm run seed   (uses DATABASE_URL and APP_EMAIL)
import { migrate, one, pool, tx, type Db } from "./db.js";
import { setupAuth } from "./auth.js";
import { todayISO, addDays } from "./time.js";
import { insertSql } from "./validate.js";

const today = todayISO();
const d = (n: number) => addDays(today, n);
const ts = (n: number, hh = 10) => new Date(`${d(n)}T${String(hh).padStart(2, "0")}:00:00+02:00`).toISOString();

const ACCOUNTS = [
  {
    name: "Northwind Logistics",
    website: "northwind-logistics.example",
    status: "contacted",
    industry: "Logistics",
    office: { building_name: "Atrium", city: "Amsterdam", submarket: "Zuidas", area_m2: 850, headcount: 70, lease_start: "2021-04-01", lease_end: "2028-03-31", notice_months: 12, break_dates: ["2027-03-31"], tenure: "lease", rent_per_m2: 395 },
    contacts: [{ name: "Sanne de Vries", role: "Office manager", email: "sanne@northwind-logistics.example", phone: "+31 6 1234 5678" }],
    tasks: [{ title: "Call about break option", type: "call", due: -2 }],
    log: [{ channel: "linkedin", outcome: "replied", direction: "inbound", summary: "Open to a chat after the summer; growing to ~90 FTE.", at: -9 }],
  },
  {
    name: "Halden & Roe",
    website: "haldenroe.example",
    status: "won",
    industry: "Legal",
    office: { city: "Amsterdam", submarket: "Museumkwartier", area_m2: 520, lease_end: "2027-06-30", notice_months: 6, tenure: "lease" },
    contacts: [
      { name: "Pieter Bakker", role: "COO", buying_role: "decision_maker", email: "pieter@haldenroe.example" },
      { name: "Lisa Jansen", role: "Office manager", buying_role: "champion" },
    ],
    tasks: [{ title: "Send shortlist", type: "email", due: 0 }],
    log: [
      { channel: "meeting", outcome: "held", summary: "Requirement: 450–550 m², Zuid or Centrum, move-in Q3 2027.", at: -3 },
      { channel: "viewing", outcome: "shortlisted", summary: "Viewed Vondelstraat 12; liked the light, worried about meeting rooms.", at: -1 },
    ],
  },
  {
    name: "Verity Health",
    website: "verityhealth.example",
    status: "in_talks",
    industry: "Healthcare",
    office: { city: "Amsterdam", submarket: "Sloterdijk", area_m2: 1400, lease_end: "2027-12-31", notice_months: 12, tenure: "lease" },
    contacts: [{ name: "Mark Visser", role: "Facility manager" }],
    tasks: [{ title: "Follow up on proposal", type: "call", due: 0 }],
    log: [{ channel: "email", outcome: "sent", summary: "Sent proposal for search mandate.", at: -6, expect_reply: true }],
  },
  {
    name: "Stellar Freight",
    website: "stellarfreight.example",
    status: "target",
    industry: "Logistics",
    office: { city: "Schiphol", submarket: "Schiphol-Rijk", area_m2: 300, lease_end: "2028-09-30", tenure: "flex" },
    contacts: [],
    tasks: [{ title: "Intro call", type: "call", due: 2 }],
    log: [],
  },
  {
    name: "Lumen Studio",
    website: "lumenstudio.example",
    status: "contacted",
    industry: "Creative agency",
    office: { city: "Amsterdam", submarket: "Noord", area_m2: 260, lease_end: "2027-10-31", tenure: "lease" },
    contacts: [{ name: "Eva Smit", role: "Founder", buying_role: "decision_maker" }],
    tasks: [],
    log: [{ channel: "call", outcome: "no_answer", summary: "", at: -14 }],
  },
  {
    name: "Brightwater Capital",
    website: "brightwater.example",
    status: "target",
    industry: "Finance",
    office: { city: "Amsterdam", submarket: "Zuidas", area_m2: 1100, lease_end: "2029-01-31" },
    contacts: [],
    tasks: [{ title: "Find the right contact", type: "linkedin", due: 6 }],
    log: [],
  },
  {
    name: "Canal Ventures",
    website: "canalventures.example",
    status: "target",
    industry: "Venture capital",
    office: { city: "Amsterdam", submarket: "Grachtengordel", area_m2: 380, lease_end: "2027-12-31", tenure: "lease" },
    contacts: [],
    tasks: [],
    log: [],
  },
  {
    name: "Amstel Media",
    website: "amstelmedia.example",
    status: "not_now",
    industry: "Media",
    office: { city: "Amsterdam", submarket: "Amstel", area_m2: 700, lease_end: "2031-06-30", tenure: "lease" },
    contacts: [],
    tasks: [],
    log: [{ channel: "meeting", outcome: "held", summary: "Lease signed at Amstelplein; deal closed.", at: -40 }],
  },
];

function ins(t: Db, table: string, cols: Record<string, unknown>) {
  const { text, values } = insertSql(table, cols);
  return t.one(text, values);
}

async function main() {
  await migrate();
  await setupAuth();
  const user = await one<{ id: string }>("select id from users order by created_at limit 1");
  if (!user) throw new Error("Set APP_EMAIL and APP_PASSWORD first.");
  const existing = await one<{ n: number }>("select count(*)::int as n from accounts where owner_id = $1", [user.id]);
  if (existing?.n) {
    console.log("CRM already has accounts; skipping demo data.");
    return;
  }
  await tx(async (t) => {
    for (const a of ACCOUNTS) {
      const acc = await ins(t, "accounts", {
        owner_id: user.id, name: a.name, website: a.website, domain: a.website, status: a.status, industry: a.industry, tags: ["demo"],
      });
      await ins(t, "office_locations", { owner_id: user.id, account_id: acc.id, is_primary: true, ...a.office });
      const contactIds: string[] = [];
      for (const c of a.contacts) {
        const row = await ins(t, "contacts", { owner_id: user.id, account_id: acc.id, lawful_basis: "legitimate_interest", ...c });
        contactIds.push(row.id);
      }
      for (const l of a.log) {
        await ins(t, "activities", {
          owner_id: user.id, account_id: acc.id, contact_id: contactIds[0] ?? null, channel: l.channel, outcome: l.outcome,
          direction: (l as any).direction ?? "outbound", summary: l.summary, occurred_at: ts(l.at), expect_reply: Boolean((l as any).expect_reply),
        });
      }
      for (const k of a.tasks) {
        await ins(t, "tasks", {
          owner_id: user.id, account_id: acc.id, contact_id: contactIds[0] ?? null, title: k.title, type: k.type, due_date: d(k.due),
        });
      }
    }
    // A to-do of your own, not tied to an account.
    await t.q("insert into tasks (owner_id, title, type, due_date) values ($1, 'Update LinkedIn headline', 'todo', $2)", [user.id, d(4)]);
  });
  console.log(`Added ${ACCOUNTS.length} demo accounts (tagged "demo").`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
