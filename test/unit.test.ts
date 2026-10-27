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
