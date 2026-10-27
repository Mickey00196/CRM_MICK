// End-to-end API tests against a real Postgres. Needs TEST_DATABASE_URL (or the local default in helpers).
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { Client, USERS, start, type Env } from "./helpers.js";

let env: Env;
let a: Client;
let b: Client;

before(async () => {
  env = await start();
  a = await new Client(env.base).login(USERS.a);
  b = await new Client(env.base).login(USERS.b);
});
after(() => env.close());

async function account(c: Client, body: Record<string, unknown>) {
  const r = await c.post("/accounts", body);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data.id as string;
}

async function contactOf(accountId: string) {
  const [row] = await env.q<{ id: string }>("select id from contacts where account_id = $1 order by created_at limit 1", [accountId]);
  return row.id;
}

describe("authentication and request hygiene", () => {
  test("API requires a session", async () => {
    const anon = new Client(env.base);
    assert.equal((await anon.get("/todos")).status, 401);
  });

  test("wrong password is rejected with a neutral message", async () => {
    const r = await new Client(env.base).post("/login", { email: USERS.a.email, password: "nope" });
    assert.equal(r.status, 401);
    assert.match(r.data.error, /don't match/);
  });

  test("writes without the app header are refused (CSRF defence)", async () => {
    const r = await a.req("POST", "/tasks", { title: "x" }, { appHeader: false });
    assert.equal(r.status, 403);
    const login = await new Client(env.base).req("POST", "/login", USERS.a, { appHeader: false });
    assert.equal(login.status, 403);
  });

  test("reads work without the header, so download links keep working", async () => {
    const r = await a.req("GET", "/accounts/export.csv", undefined, { appHeader: false });
    assert.equal(r.status, 200);
  });

  test("security headers are set", async () => {
    const r = await a.get("/me");
    assert.match(r.headers.get("content-security-policy") ?? "", /script-src 'self'/);
    assert.equal(r.headers.get("x-frame-options"), "DENY");
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  });

  test("log out on all devices revokes every session", async () => {
    const phone = await new Client(env.base).login(USERS.b);
    const laptop = await new Client(env.base).login(USERS.b);
    assert.equal((await phone.get("/todos")).status, 200);
    assert.equal((await laptop.post("/logout-everywhere")).status, 200);
    assert.equal((await phone.get("/todos")).status, 401);
    b = await new Client(env.base).login(USERS.b);
    assert.equal((await b.get("/todos")).status, 200);
  });
});

describe("tenant isolation", () => {
  let aAccount: string;
  let aTask: string;
  let bDeal: string;

  before(async () => {
    aAccount = await account(a, { name: "A Corp", contact: { name: "Ann" } });
    aTask = (await a.post("/tasks", { title: "A's task", account_id: aAccount })).data.id;
    const bAccount = await account(b, { name: "B Corp" });
    const [bUser] = await env.q("select id from users where email = $1", [USERS.b.email]);
    [{ id: bDeal }] = await env.q("insert into deals (owner_id, account_id, name) values ($1, $2, 'B deal') returning id", [
      bUser.id,
      bAccount,
    ]);
  });

  test("another user can't read, list or change my records", async () => {
    assert.equal((await b.get(`/accounts/${aAccount}`)).status, 404);
    assert.equal((await b.get(`/tasks/${aTask}`)).status, 404);
    assert.equal((await b.patch(`/tasks/${aTask}`, { title: "hijacked" })).status, 404);
    assert.equal((await b.post(`/tasks/${aTask}/complete`, {})).status, 404);
    const list = await b.get("/accounts");
    assert.ok(!list.data.some((x: any) => x.id === aAccount));
    const search = await b.get("/search?q=A%20Corp");
    assert.equal(search.data.length, 0);
  });

  test("another user can't attach records to my account", async () => {
    assert.equal((await b.post("/tasks", { title: "x", account_id: aAccount })).status, 404);
    assert.equal((await b.post("/activities", { account_id: aAccount, channel: "call" })).status, 404);
  });

  test("I can't link someone else's deal to my to-do", async () => {
    const r = await a.patch(`/tasks/${aTask}`, { deal_id: bDeal });
    assert.equal(r.status, 404);
  });
});

describe("link integrity", () => {
  test("a contact from another account can't be logged on this account", async () => {
    const acme = await account(a, { name: "Acme", contact: { name: "Alice" } });
    const beta = await account(a, { name: "Beta", contact: { name: "Bob" } });
    const bob = await contactOf(beta);
    const r = await a.post("/activities", { account_id: acme, channel: "call", contact_id: bob });
    assert.equal(r.status, 400);
    assert.match(r.data.error, /Bob is a contact at a different account/);
    const t = await a.post("/tasks", { title: "x", account_id: acme, contact_id: bob });
    assert.equal(t.status, 400);
  });
});

describe("to-do completion flow", () => {
  let acc: string;
  let contact: string;

  before(async () => {
    acc = await account(a, { name: "Northwind", contact: { name: "Sanne" }, office: { area_m2: "850", lease_end: "2028-03-31" } });
    contact = await contactOf(acc);
  });

  test("completing a call logs the outcome and creates the next step in one go", async () => {
    const task = (await a.post("/tasks", { title: "Intro call", type: "call", account_id: acc, contact_id: contact })).data;
    const r = await a.post(`/tasks/${task.id}/complete`, {
      outcome: "no_answer",
      note: "Voicemail full",
      next: { type: "call", title: "Call again", due_date: "2026-11-02" },
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.activity.channel, "call");
    assert.equal(r.data.activity.outcome, "no_answer");
    assert.equal(r.data.activity.contact_id, contact);
    assert.equal(r.data.next_task.title, "Call again");
    assert.equal(r.data.next_task.contact_id, contact);
    const [done] = await env.q("select status, completion_activity_id from tasks where id = $1", [task.id]);
    assert.equal(done.status, "done");
    assert.equal(done.completion_activity_id, r.data.activity.id);
    assert.equal((await a.post(`/tasks/${task.id}/complete`, {})).status, 400);
  });

  test("an outcome that doesn't fit the channel is rejected", async () => {
    const task = (await a.post("/tasks", { title: "Call", type: "call", account_id: acc })).data;
    const r = await a.post(`/tasks/${task.id}/complete`, { outcome: "shortlisted" });
    assert.equal(r.status, 400);
  });

  test("a failure late in the flow rolls everything back", async () => {
    const other = await account(a, { name: "Other", contact: { name: "Olaf" } });
    const olaf = await contactOf(other);
    const task = (await a.post("/tasks", { title: "Call", type: "call", account_id: acc })).data;
    const countBefore = await env.q("select count(*)::int as n from activities");
    // The next step points at a contact from another account: fails after the activity was written.
    const r = await a.post(`/tasks/${task.id}/complete`, {
      outcome: "reached",
      next: { type: "email", title: "Follow up", due_date: "2026-11-02", contact_id: olaf },
    });
    assert.equal(r.status, 400);
    const countAfter = await env.q("select count(*)::int as n from activities");
    assert.equal(countAfter[0].n, countBefore[0].n);
    const [still] = await env.q("select status from tasks where id = $1", [task.id]);
    assert.equal(still.status, "open");
  });

  test("logging a call can close the matching open to-do", async () => {
    const task = (await a.post("/tasks", { title: "Call back", type: "call", account_id: acc })).data;
    const r = await a.post("/activities", { account_id: acc, channel: "call", outcome: "reached", complete_task_id: task.id });
    assert.equal(r.status, 201);
    const [row] = await env.q("select status, completion_activity_id from tasks where id = $1", [task.id]);
    assert.equal(row.status, "done");
    assert.equal(row.completion_activity_id, r.data.activity.id);
  });

  test("an inbound message clears the waiting-for-reply flag", async () => {
    const sent = (await a.post("/activities", { account_id: acc, channel: "email", outcome: "sent", expect_reply: true })).data.activity;
    assert.ok(sent.reply_due_at);
    await a.post("/activities", { account_id: acc, channel: "email", direction: "inbound", outcome: "replied" });
    const [row] = await env.q("select replied_at from activities where id = $1", [sent.id]);
    assert.ok(row.replied_at);
  });

  test("an account with a next step leaves the no-next-step list", async () => {
    const lonely = await account(a, { name: "Lonely BV", status: "prospect" });
    let todos = (await a.get("/todos")).data;
    assert.ok(todos.no_next_step.some((x: any) => x.id === lonely));
    await a.post("/tasks", { title: "Intro", account_id: lonely, due_date: "2026-11-02" });
    todos = (await a.get("/todos")).data;
    assert.ok(!todos.no_next_step.some((x: any) => x.id === lonely));
  });
});

describe("accounts", () => {
  test("duplicates by name and domain are caught", async () => {
    await account(a, { name: "Dupe Co", website: "https://www.dupe.nl" });
    const byName = await a.post("/accounts", { name: "dupe co" });
    assert.equal(byName.status, 409);
    assert.equal(byName.data.can_force, true);
    const byDomain = await a.post("/accounts", { name: "Dupe Holding", website: "dupe.nl" });
    assert.equal(byDomain.status, 409);
  });

  test("Dutch number formats are stored correctly", async () => {
    const id = await account(a, { name: "Numbers BV", office: { area_m2: "1.200", rent_per_m2: "245,50" } });
    const [o] = await env.q("select area_m2, rent_per_m2 from office_locations where account_id = $1", [id]);
    assert.equal(o.area_m2, 1200);
    assert.equal(o.rent_per_m2, 245.5);
  });

  test("CSV export neutralises formula cells", async () => {
    await account(a, { name: '=HYPERLINK("http://evil","x")' });
    const r = await a.get("/accounts/export.csv");
    assert.ok(r.data.includes(`"'=HYPERLINK(""http://evil"",""x"")"`));
  });
});

describe("reminder email scheduling", () => {
  test("only one send per day, failures retried up to three times", async () => {
    const { claimToday, finishDay } = await import("../server/digest.js");
    const day = "2030-01-07";
    assert.equal(await claimToday(day), 1);
    assert.equal(await claimToday(day), null, "a second instance must not send too");
    await finishDay(day, "failed", 1);
    assert.equal(await claimToday(day), 2);
    await finishDay(day, "failed", 2);
    assert.equal(await claimToday(day), 3);
    await finishDay(day, "failed", 3);
    assert.equal(await claimToday(day), null, "gives up after three attempts");
    const ok = "2030-01-08";
    assert.equal(await claimToday(ok), 1);
    await finishDay(ok, "sent", 1);
    assert.equal(await claimToday(ok), null);
  });
});
