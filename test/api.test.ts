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
  let aProject: string;
  let bProject: string;

  before(async () => {
    aAccount = await account(a, { name: "A Corp", contact: { name: "Ann" } });
    aTask = (await a.post("/tasks", { title: "A's task", account_id: aAccount })).data.id;
    aProject = (await a.post("/projects", { name: "A's project" })).data.id;
    bProject = (await b.post("/projects", { name: "B's project" })).data.id;
  });

  test("another user can't read, list or change my records", async () => {
    assert.equal((await b.get(`/accounts/${aAccount}`)).status, 404);
    assert.equal((await b.get(`/tasks/${aTask}`)).status, 404);
    assert.equal((await b.get(`/projects/${aProject}`)).status, 404);
    assert.equal((await b.patch(`/tasks/${aTask}`, { title: "hijacked" })).status, 404);
    assert.equal((await b.patch(`/projects/${aProject}`, { stage: "done" })).status, 404);
    assert.equal((await b.post(`/tasks/${aTask}/complete`, {})).status, 404);
    assert.ok(!(await b.get("/accounts")).data.some((x: any) => x.id === aAccount));
    assert.ok(!(await b.get("/projects")).data.some((x: any) => x.id === aProject));
    assert.equal((await b.get("/search?q=A%20Corp")).data.length, 0);
  });

  test("another user can't attach records to my company or project", async () => {
    assert.equal((await b.post("/tasks", { title: "x", account_id: aAccount })).status, 404);
    assert.equal((await b.post("/tasks", { title: "x", project_id: aProject })).status, 404);
    assert.equal((await b.post("/activities", { account_id: aAccount, channel: "call" })).status, 404);
    assert.equal((await b.post("/projects", { name: "x", account_id: aAccount })).status, 404);
  });

  test("I can't link someone else's project to my to-do", async () => {
    assert.equal((await a.patch(`/tasks/${aTask}`, { project_id: bProject })).status, 404);
  });
});

describe("link integrity", () => {
  test("a contact from another account can't be logged on this account", async () => {
    const acme = await account(a, { name: "Acme", contact: { name: "Alice" } });
    const beta = await account(a, { name: "Beta", contact: { name: "Bob" } });
    const bob = await contactOf(beta);
    const r = await a.post("/activities", { account_id: acme, channel: "call", contact_id: bob });
    assert.equal(r.status, 400);
    assert.match(r.data.error, /Bob works at a different company/);
    const t = await a.post("/tasks", { title: "x", account_id: acme, contact_id: bob });
    assert.equal(t.status, 400);
  });

  test("a to-do can't be on a project and a different company", async () => {
    const acme = await account(a, { name: "Acme 2" });
    const beta = await account(a, { name: "Beta 2" });
    const project = (await a.post("/projects", { name: "Acme move", account_id: acme })).data.id;
    const r = await a.post("/tasks", { title: "x", project_id: project, account_id: beta });
    assert.equal(r.status, 400);
    assert.match(r.data.error, /different company/);
    const ok = (await a.post("/tasks", { title: "y", project_id: project })).data;
    assert.equal(ok.account_id, acme, "the project's company is filled in");
  });
});

describe("accounts and follow-ups", () => {
  test("a logged viewing moves a lead or early opportunity to Viewing", async () => {
    const id = await account(a, { name: "Viewing Co" });
    const status = async () => (await a.get(`/accounts/${id}`)).data.account.status;
    assert.equal(await status(), "lead", "new accounts start as Lead");

    const call = await a.post("/activities", { account_id: id, channel: "call", outcome: "reached" });
    assert.equal(call.data.moved, null, "a call doesn't move it");
    await a.patch(`/accounts/${id}`, { status: "overview_sent" });

    const t = await a.post("/tasks", { title: "Viewing Herengracht", type: "viewing", account_id: id, due_date: "2026-11-03" });
    const done = await a.post(`/tasks/${t.data.id}/complete`, { outcome: "held" });
    assert.equal(done.status, 200, JSON.stringify(done.data));
    assert.deepEqual([done.data.moved.from, done.data.moved.to, done.data.moved.account_name], ["overview_sent", "viewing", "Viewing Co"]);

    await a.patch(`/accounts/${id}`, { status: "proposal" });
    const later = await a.post("/activities", { account_id: id, channel: "viewing", outcome: "held" });
    assert.equal(later.data.moved, null, "never backwards");
    assert.equal(await status(), "proposal");
  });

  test("an account you're working with nothing planned asks for a follow-up", async () => {
    const id = await account(a, { name: "Follow-up Co", status: "lead" });
    let todos = (await a.get("/todos")).data;
    assert.ok(todos.no_follow_up.some((x: any) => x.id === id), "a new lead needs a first follow-up");

    const t = await a.post("/tasks", { title: "Intro call", type: "call", account_id: id, due_date: "2026-11-03" });
    assert.equal(t.status, 201, JSON.stringify(t.data));
    todos = (await a.get("/todos")).data;
    assert.ok(!todos.no_follow_up.some((x: any) => x.id === id));
    const row = [...todos.overdue, ...todos.due_today, ...todos.upcoming].find((r: any) => r.id === t.data.id);
    assert.equal(row.account_name, "Follow-up Co");

    assert.equal((await a.post(`/tasks/${t.data.id}/complete`, {})).status, 200);
    todos = (await a.get("/todos")).data;
    assert.ok(todos.no_follow_up.some((x: any) => x.id === id), "done with the last follow-up: ask again");

    await a.patch(`/accounts/${id}`, { status: "proposal" });
    todos = (await a.get("/todos")).data;
    assert.ok(todos.no_follow_up.some((x: any) => x.id === id), "opportunities need a follow-up too");
    await a.patch(`/accounts/${id}`, { status: "invoicing" });
    todos = (await a.get("/todos")).data;
    assert.ok(!todos.no_follow_up.some((x: any) => x.id === id), "invoicing: nothing to chase");
    await a.patch(`/accounts/${id}`, { status: "not_now" });
    todos = (await a.get("/todos")).data;
    assert.ok(!todos.no_follow_up.some((x: any) => x.id === id), "not now: nothing to chase");
    assert.ok(!(await b.get("/todos")).data.no_follow_up.some((x: any) => x.id === id), "other users never see it");
  });
});

describe("projects", () => {
  test("a project with a first to-do shows up on the board and the to-do list", async () => {
    const r = await a.post("/projects", { name: "Q4 market update", stage: "active", next: { title: "Draft outline", due_date: "2026-11-03" } });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    const board = (await a.get("/projects")).data.find((p: any) => p.id === r.data.id);
    assert.equal(board.stage, "active");
    assert.equal(board.next_step.title, "Draft outline");
    assert.equal(board.open_tasks, 1);
    const todos = (await a.get("/todos")).data;
    const row = [...todos.overdue, ...todos.due_today, ...todos.upcoming].find((t: any) => t.title === "Draft outline");
    assert.equal(row.project_name, "Q4 market update");
  });

  test("moving to Done records when, moving back clears it", async () => {
    const p = (await a.post("/projects", { name: "Stage test" })).data;
    assert.equal(p.stage, "todo");
    const done = (await a.patch(`/projects/${p.id}`, { stage: "done" })).data;
    assert.ok(done.done_at);
    const back = (await a.patch(`/projects/${p.id}`, { stage: "waiting", waiting_on: "Landlord" })).data;
    assert.equal(back.done_at, null);
    assert.equal(back.waiting_on, "Landlord");
    assert.equal((await a.patch(`/projects/${p.id}`, { stage: "archived" })).status, 400);
  });

  test("a project without a company can still have notes and calls logged", async () => {
    const p = (await a.post("/projects", { name: "Side project" })).data;
    const note = await a.post("/activities", { project_id: p.id, channel: "note", summary: "Idea for the scraper" });
    assert.equal(note.status, 201, JSON.stringify(note.data));
    assert.equal(note.data.activity.account_id, null);
    const detail = (await a.get(`/projects/${p.id}`)).data;
    assert.equal(detail.activities.length, 1);
    const nothing = await a.post("/activities", { channel: "note", summary: "About nothing" });
    assert.equal(nothing.status, 400);
  });

  test("a plain to-do on a project completes without a log entry; a call logs on the project", async () => {
    const p = (await a.post("/projects", { name: "Logging test" })).data;
    const todo = (await a.post("/tasks", { title: "Book room", project_id: p.id })).data;
    const r1 = await a.post(`/tasks/${todo.id}/complete`, {});
    assert.equal(r1.data.activity, null);
    const call = (await a.post("/tasks", { title: "Call landlord", type: "call", project_id: p.id })).data;
    const r2 = await a.post(`/tasks/${call.id}/complete`, { outcome: "reached", note: "Agreed on viewing" });
    assert.equal(r2.data.activity.project_id, p.id);
  });

  test("moving to Waiting can add a follow-up to-do in the same step", async () => {
    const p = (await a.post("/projects", { name: "Waiting flow" })).data;
    const r = await a.patch(`/projects/${p.id}`, {
      stage: "waiting",
      waiting_on: "Landlord's counter-offer",
      follow_up: { title: "Follow up: Landlord's counter-offer", due_date: "2026-11-05" },
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const detail = (await a.get(`/projects/${p.id}`)).data;
    assert.equal(detail.tasks.length, 1);
    assert.equal(detail.tasks[0].due_date, "2026-11-05");
    // A bad follow-up rolls the whole change back.
    const bad = await a.patch(`/projects/${p.id}`, { stage: "active", follow_up: { title: "", due_date: "2026-11-05" } });
    assert.equal(bad.status, 400);
    assert.equal((await a.get(`/projects/${p.id}`)).data.project.stage, "waiting");
  });

  test("moving to Done can close open to-dos and log an outcome", async () => {
    const p = (await a.post("/projects", { name: "Done flow", next: { title: "Last step", due_date: "2026-11-03" } })).data;
    await a.post("/tasks", { title: "Call landlord", type: "call", project_id: p.id });
    const r = await a.patch(`/projects/${p.id}`, { stage: "done", close_open_tasks: true, outcome_note: "Signed for 5 years" });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const detail = (await a.get(`/projects/${p.id}`)).data;
    assert.equal(detail.tasks.length, 0, "no open to-dos left");
    assert.equal(detail.done_tasks.length, 2);
    assert.equal(detail.activities.length, 1, "only the outcome is logged, not fake calls");
    assert.equal(detail.activities[0].summary, "Signed for 5 years");
  });

  test("snoozing counts how often a to-do was pushed back", async () => {
    const task = (await a.post("/tasks", { title: "Avoided task", due_date: "2030-11-02" })).data;
    await a.patch(`/tasks/${task.id}`, { snooze_until: "2030-11-03" });
    await a.patch(`/tasks/${task.id}`, { snooze_until: "2030-11-04" });
    await a.patch(`/tasks/${task.id}`, { title: "Avoided task (renamed)" });
    const row = (await a.get("/todos")).data.upcoming.find((t: any) => t.id === task.id);
    assert.equal(row.snooze_count, 2);
    assert.equal(row.due_date, "2030-11-04");
  });

  test("giving a project a company moves its to-dos along", async () => {
    const p = (await a.post("/projects", { name: "Needs a company", next: { title: "Step", due_date: "2026-11-03" } })).data;
    const co = await account(a, { name: "Later Co" });
    await a.patch(`/projects/${p.id}`, { account_id: co });
    const [task] = await env.q("select account_id from tasks where project_id = $1", [p.id]);
    assert.equal(task.account_id, co);
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
