// Pure logic: no database needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { addMonthsISO, leaseInfo } from "../shared/lease.js";
import { suggestNextStep, channelForTaskType } from "../shared/model.js";
import { parseNumber, normalizeDomain } from "../server/validate.js";
import { businessDaysFromNow } from "../server/sql.js";
import { csvCell } from "../server/csv.js";

test("addMonthsISO clamps to the end of shorter months", () => {
  assert.equal(addMonthsISO("2028-03-31", -1), "2028-02-29");
  assert.equal(addMonthsISO("2027-03-31", -1), "2027-02-28");
  assert.equal(addMonthsISO("2028-03-31", -12), "2027-03-31");
  assert.equal(addMonthsISO("2026-10-15", 24), "2028-10-15");
});

test("leaseInfo: notice deadline, next key date and decision window", () => {
  const office = { lease_end: "2028-03-31", notice_months: 12, break_dates: ["2027-03-31"] };
  const info = leaseInfo(office, "2026-10-20");
  assert.equal(info.noticeDeadline, "2027-03-31");
  // Break notice (2026-03-31) has passed; the break itself is next.
  assert.deepEqual(info.nextKeyDate, { date: "2027-03-31", label: "Break option" });
  // Window opens 24 months before the first exit still ahead (the break).
  assert.equal(info.decisionWindowOpens, "2025-03-31");
  assert.equal(info.inDecisionWindow, true);
  assert.equal(info.remainingMonths, 17);
});

test("leaseInfo without dates returns nothing to show", () => {
  const info = leaseInfo({ lease_end: null, notice_months: null, break_dates: [] }, "2026-10-20");
  assert.equal(info.nextKeyDate, null);
  assert.equal(info.decisionWindowOpens, null);
  assert.equal(info.inDecisionWindow, false);
});

test("suggestNextStep maps outcomes to sensible follow-ups", () => {
  assert.deepEqual(suggestNextStep("call", "no_answer"), { type: "call", title: "Call again", days: 2, pickDate: undefined });
  assert.equal(suggestNextStep("call", "meeting_booked")?.pickDate, true);
  assert.equal(suggestNextStep("email", "sent")?.type, "email");
  assert.equal(suggestNextStep("email", "sent")?.days, 5);
  assert.equal(suggestNextStep("whatsapp", "sent")?.type, "todo");
  assert.equal(suggestNextStep("call", "not_interested")?.days, 182);
  assert.equal(suggestNextStep("viewing", "shortlisted")?.title, "Prepare proposal");
  assert.equal(suggestNextStep("call", null), null);
  assert.equal(suggestNextStep("note", "anything"), null);
});

test("only communication to-dos log a channel", () => {
  assert.equal(channelForTaskType("call"), "call");
  assert.equal(channelForTaskType("viewing"), "viewing");
  assert.equal(channelForTaskType("todo"), null);
});

test("parseNumber understands Dutch and English number formats", () => {
  assert.equal(parseNumber("1.200", "x"), 1200);
  assert.equal(parseNumber("1.250.000", "x"), 1250000);
  assert.equal(parseNumber("245,50", "x"), 245.5);
  assert.equal(parseNumber("1.234,56", "x"), 1234.56);
  assert.equal(parseNumber("245.50", "x"), 245.5);
  assert.equal(parseNumber("€ 22.000", "x"), 22000);
  assert.equal(parseNumber("850 m²", "x"), 850);
  assert.equal(parseNumber("", "x"), null);
  assert.equal(parseNumber(12, "x"), 12);
  assert.throws(() => parseNumber("abc", "Floor area"), /Floor area must be a number/);
});

test("normalizeDomain strips protocol, www and paths", () => {
  assert.equal(normalizeDomain("https://www.Northwind.nl/about?x=1", true), "northwind.nl");
  assert.equal(normalizeDomain("sub.example.co.uk", true), "sub.example.co.uk");
  assert.equal(normalizeDomain("not a domain", false), null);
  assert.throws(() => normalizeDomain("not a domain", true), /Domain doesn't look right/);
});

test("businessDaysFromNow skips weekends", () => {
  const friday = new Date("2026-10-23T09:00:00Z");
  assert.equal(businessDaysFromNow(1, friday).toISOString().slice(0, 10), "2026-10-26");
  assert.equal(businessDaysFromNow(5, friday).toISOString().slice(0, 10), "2026-10-30");
});

test("csvCell neutralises formulas and quotes separators", () => {
  assert.equal(csvCell("=HYPERLINK(1)", ";"), "'=HYPERLINK(1)");
  assert.equal(csvCell("+31 6 1234", ";"), "'+31 6 1234");
  assert.equal(csvCell("a;b", ";"), '"a;b"');
  assert.equal(csvCell('say "hi"', ";"), '"say ""hi"""');
  assert.equal(csvCell(null, ";"), "");
  assert.equal(csvCell(850, ";"), "850");
});

// ---------- acquisition funnel ----------
import { FLOW, advanceStatus, nextStatus, phaseOf } from "../shared/model.js";

test("the flow: lead, seven opportunity steps, invoicing", () => {
  assert.deepEqual(FLOW, ["lead", "overview_sent", "viewing", "rfp", "proposal", "negotiation", "terms_agreed", "agreement", "invoicing"]);
  assert.equal(nextStatus("lead"), "overview_sent", "starting an opportunity begins with the overview");
  assert.equal(nextStatus("agreement"), "invoicing");
  assert.equal(nextStatus("invoicing"), null);
  assert.equal(nextStatus("not_now"), null);
  assert.equal(phaseOf("rfp"), "opportunity");
  assert.equal(phaseOf("lead"), "lead");
});

test("only a viewing that happened moves an account on its own", () => {
  assert.equal(advanceStatus("lead", "viewing", "held"), "viewing");
  assert.equal(advanceStatus("overview_sent", "viewing", "shortlisted"), "viewing");
  assert.equal(advanceStatus("overview_sent", "viewing", "no_show"), null);
  assert.equal(advanceStatus("proposal", "viewing", "held"), null, "never backwards");
  assert.equal(advanceStatus("lead", "call", "meeting_booked"), null, "everything else is your call");
  assert.equal(advanceStatus("not_now", "viewing", "held"), null);
});

// ---------- AI company lookup ----------
import { parseProfile, researchCompany } from "../server/domain/research.js";

test("parseProfile keeps clean, bounded fields from the AI reply", () => {
  const reply = 'Here you go:\n```json\n' + JSON.stringify({
    summary: "  Builds route-planning software for European hauliers.  ",
    industry: "Logistics software",
    employees: "200-500",
    headquarters: { city: "Amsterdam", country: "Netherlands" },
    offices: [
      { city: "Amsterdam", country: "Netherlands" },
      { city: "amsterdam", country: "netherlands" },
      { city: "London", country: "United Kingdom" },
      { foo: 1 },
    ],
    sources: ["https://example.com/about", "javascript:alert(1)", "not a url"],
  }) + "\n```";
  const p = parseProfile(reply);
  assert.equal(p.summary, "Builds route-planning software for European hauliers.");
  assert.deepEqual(p.offices, [{ city: "Amsterdam", country: "Netherlands" }, { city: "London", country: "United Kingdom" }], "deduped, junk dropped");
  assert.deepEqual(p.sources, ["https://example.com/about"], "only http(s) links survive");
  assert.deepEqual(p.headquarters, { city: "Amsterdam", country: "Netherlands" });
  assert.throws(() => parseProfile("Sorry, I couldn't find anything."), /no summary/);
  assert.throws(() => parseProfile('{"summary": ""}'), /enough/);
});

test("researchCompany calls Claude with web search and fetch, and carries on after a pause", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const calls: any[] = [];
  const reply = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  const fake = (async (_url: string, init: RequestInit) => {
    calls.push(JSON.parse(String(init.body)));
    return calls.length === 1
      ? reply({ stop_reason: "pause_turn", content: [{ type: "server_tool_use", id: "s1", name: "web_fetch", input: { url: "https://acme.example" } }] })
      : reply({ stop_reason: "end_turn", content: [{ type: "text", text: '{"summary": "Acme makes anvils.", "offices": [{"city": "Utrecht", "country": "Netherlands"}]}' }] });
  }) as unknown as typeof fetch;
  try {
    const p = await researchCompany("acme.example", "Acme", fake);
    assert.equal(p.summary, "Acme makes anvils.");
    assert.equal(calls.length, 2, "continued after pause_turn");
    assert.deepEqual(calls[0].tools.map((t: any) => t.name), ["web_fetch", "web_search"]);
    assert.match(calls[0].messages[0].content, /https:\/\/acme\.example/, "adds https:// to a bare domain");
    assert.equal(calls[1].messages[1].role, "assistant", "the paused turn is sent back as is");
  } finally {
    delete process.env.ANTHROPIC_API_KEY;
  }
});

// ---------- readable dates and one-line capture ----------
import { dueParts, dueText } from "../shared/dates.js";
import { parseQuick } from "../shared/quick.js";

test("dueText says when, the way you'd say it", () => {
  const today = "2026-10-27"; // a Tuesday
  assert.equal(dueText("2026-10-27", null, today), "Today");
  assert.equal(dueText("2026-10-27", "14:00", today), "14:00");
  assert.equal(dueText("2026-10-28", null, today), "Tomorrow");
  assert.equal(dueText("2026-10-28", "09:30", today), "Tomorrow 09:30");
  assert.equal(dueText("2026-10-29", null, today), "Thu");
  assert.equal(dueText("2026-11-03", null, today), "Tue 3 Nov");
  assert.equal(dueText("2027-01-05", null, today), "Tue 5 Jan 2027");
  assert.equal(dueText("2026-10-26", null, today), "Yesterday");
  assert.equal(dueText("2026-10-24", null, today), "3 days late");
  assert.equal(dueText("2026-10-06", null, today), "3 weeks late");
  assert.equal(dueText(null, null, today), "");
  assert.deepEqual(dueParts("2026-10-27", "14:00", today), { day: "Today", time: "14:00" });
  assert.deepEqual(dueParts("2026-10-28", "09:30", today), { day: "Tomorrow", time: "09:30" });
  assert.deepEqual(dueParts("2026-10-24", "09:30", today), { day: "3 days late", time: null });
  assert.deepEqual(dueParts(null, null, today), { day: "", time: null });
});

test("parseQuick reads type, date and time from one line (EN and NL)", () => {
  const today = "2026-10-27"; // a Tuesday
  assert.deepEqual(parseQuick("Call Sanne tomorrow 10:00 about break option", today), {
    title: "Call Sanne about break option", due_date: "2026-10-28", due_time: "10:00", type: "call",
  });
  assert.deepEqual(parseQuick("Bel Sanne morgen om 10 over break optie", today), {
    title: "Bel Sanne over break optie", due_date: "2026-10-28", due_time: "10:00", type: "call",
  });
  assert.deepEqual(parseQuick("Email Pieter on friday", today), { title: "Email Pieter", due_date: "2026-10-30", due_time: null, type: "email" });
  assert.deepEqual(parseQuick("Lunch met Eva volgende week", today), { title: "Lunch met Eva", due_date: "2026-11-02", due_time: null, type: "meeting" });
  assert.deepEqual(parseQuick("Viewing Vondelstraat 3pm", today), { title: "Viewing Vondelstraat", due_date: null, due_time: "15:00", type: "viewing" });
  assert.equal(parseQuick("Call back tuesday", today).due_date, "2026-11-03", "same weekday means next week");
  assert.equal(parseQuick("Send contract 28/10", today).due_date, "2026-10-28");
  assert.equal(parseQuick("Send contract 3 nov", today).due_date, "2026-11-03");
  assert.equal(parseQuick("Renewal deadline 1 jan", today).due_date, "2027-01-01", "past day/month rolls to next year");
  assert.equal(parseQuick("Fix scraper in 3 days", today).due_date, "2026-10-30");
  assert.equal(parseQuick("Mail Joost over 2 weken", today).due_date, "2026-11-10");
  const plain = parseQuick("Update LinkedIn headline", today);
  assert.deepEqual(plain, { title: "Update LinkedIn headline", due_date: null, due_time: null, type: null });
  assert.equal(parseQuick("Send 2 brochures", today).title, "Send 2 brochures", "plain numbers stay in the title");
});

// ---------- opportunity data ----------
import { coercePatch, offerMetrics, stageChecks, suggestedFee, toNumber, FieldError, OPPORTUNITY_FIELDS, type OptionRow } from "../shared/opportunity.js";
import { brochureSlug, buildingToOption } from "../server/domain/brochure.js";

const option = (data: OptionRow["data"], extra: Partial<OptionRow> = {}): OptionRow => ({
  id: "o",
  account_id: "a",
  status: "overview",
  position: 0,
  source_id: null,
  data,
  terms: {},
  created_at: "",
  updated_at: "",
  ...extra,
});

test("toNumber reads Dutch and English formats", () => {
  assert.equal(toNumber("1.200", "x"), 1200);
  assert.equal(toNumber("1 200", "x"), 1200);
  assert.equal(toNumber("245,50", "x"), 245.5);
  assert.equal(toNumber("€ 1.234,5", "x"), 1234.5);
  assert.equal(toNumber("2.5", "x"), 2.5);
  assert.equal(toNumber("", "x"), null);
  assert.throws(() => toNumber("lots", "Size"), /Size must be a number/);
});

test("coercePatch validates per field type and refuses unknown fields", () => {
  const out = coercePatch(
    { size_min_m2: "1.500", req_type: "relocation", mandate_signed: true, move_in_ideal: "2027-09-01", areas: "  Zuidas ", fitout_budget: "" },
    OPPORTUNITY_FIELDS,
  );
  assert.deepEqual(out, { size_min_m2: 1500, req_type: "relocation", mandate_signed: true, move_in_ideal: "2027-09-01", areas: "Zuidas", fitout_budget: null });
  assert.throws(() => coercePatch({ req_type: "castle" }, OPPORTUNITY_FIELDS), FieldError);
  assert.throws(() => coercePatch({ move_in_ideal: "next spring" }, OPPORTUNITY_FIELDS), /must be a date/);
  assert.throws(() => coercePatch({ overview_link: "javascript:alert(1)" }, OPPORTUNITY_FIELDS), /web link/);
  assert.throws(() => coercePatch({ adopted_office_id: "x" }, OPPORTUNITY_FIELDS), /Unknown field/);
});

test("offerMetrics: net effective rent and all-in cost of an offer", () => {
  // 1,000 m² at €300 for 5 years, 6 months rent-free, €50/m² fit-out, €60/m² service, 10 spaces at €2,000.
  const m = offerMetrics(
    { offer_area_m2: 1000, offer_rent_m2: 300, offer_term_years: 5, offer_rent_free_months: 6, offer_fitout_m2: 50, offer_service_m2: 60, offer_parking_spaces: 10, offer_parking_rate: 2000 },
    80,
  )!;
  assert.equal(m.rentYear, 300_000);
  assert.equal(m.incentives, 150_000 + 50_000);
  assert.equal(m.nerM2, 300 - 200_000 / 5000); // 260
  assert.equal(m.incentivePct, 200_000 / 1_500_000);
  assert.equal(m.totalYear, (1_500_000 - 200_000 + 80_000 * 5) / 5); // 340,000
  assert.equal(m.perWorkstationYear, 340_000 / 80);
  assert.equal(offerMetrics({ offer_rent_m2: 300 }), null, "needs area, rent and term");
  assert.equal(offerMetrics({ area_m2: 800, offer_rent_m2: 250, offer_term_years: 5 })!.area, 800, "falls back to the listed area");
});

test("suggestedFee: % of first-year rent, or the fixed fee", () => {
  assert.equal(suggestedFee({ fee_basis: "pct", fee_pct: 15, rent_year: 300_000 }), 45_000);
  const chosen = option({ offer_area_m2: 1000, offer_rent_m2: 200, offer_term_years: 5 }, { status: "chosen" });
  assert.equal(suggestedFee({ fee_pct: 10 }, chosen), 20_000, "uses the chosen offer without a signed rent");
  assert.equal(suggestedFee({ fee_basis: "fixed", fee_fixed: 25_000, fee_pct: 10, rent_year: 1 }), 25_000);
  assert.equal(suggestedFee({}), null);
});

test("stageChecks reflect what's been filled in", () => {
  const ctx = { opp: {}, options: [], contacts: 0, hasCurrentLease: false };
  assert.ok(stageChecks("overview_sent", ctx).every((c) => !c.done));
  const full = stageChecks("overview_sent", {
    ...ctx,
    opp: { size_min_m2: 800, areas: "Zuidas", budget_rent_m2: 400, move_in_latest: "2027-06-01", overview_sent_at: "2026-10-01" },
    options: [option({ name: "Atrium" })],
  });
  assert.ok(full.every((c) => c.done), JSON.stringify(full));
  const dropped = stageChecks("overview_sent", { ...ctx, options: [option({ name: "X" }, { status: "dropped" })] });
  assert.equal(dropped.find((c) => c.label.startsWith("Buildings"))!.done, false, "dropped buildings don't count");
  const viewing = stageChecks("viewing", { ...ctx, options: [option({ name: "A", viewing_score: 8 }, { status: "viewed" }), option({ name: "B" })] });
  assert.ok(viewing.every((c) => c.done), JSON.stringify(viewing));
});

test("brochure links: only /s/<slug> on any host, mapped to a building", () => {
  assert.equal(brochureSlug("https://office-shortlist.up.railway.app/s/acme-2026"), "acme-2026");
  assert.equal(brochureSlug("https://x.nl/s/abc/"), "abc");
  assert.equal(brochureSlug("https://x.nl/admin/s/abc"), null);
  assert.equal(brochureSlug("https://x.nl/s/../../etc"), null);
  assert.equal(brochureSlug("not a link"), null);
  const o = buildingToOption(
    {
      building_id: "b1",
      name: "The Atrium",
      address: "Strawinskylaan 3",
      city: "Amsterdam",
      submarket: "Zuidas",
      energy_label: "A",
      photos: ["/local.jpg", "https://img.example/a.jpg"],
      units: [
        { available_area_m2: 600, rent_eur_per_m2_year: 425, service_charge_eur_per_m2_year: 70, availability: "Q2 2027" },
        { available_area_m2: 400, rent_eur_per_m2_year: 410, service_charge_eur_per_m2_year: 70 },
      ],
    },
    "https://x.nl/s/acme",
  );
  assert.equal(o.source_id, "brochure:b1");
  assert.deepEqual(o.data, {
    name: "The Atrium",
    address: "Strawinskylaan 3",
    city: "Amsterdam",
    submarket: "Zuidas",
    energy_label: "A",
    area_m2: 1000,
    asking_rent_m2: 410,
    service_m2: 70,
    available_from: "Q2 2027",
    link: "https://x.nl/s/acme",
    photo: "https://img.example/a.jpg",
  });
});
