import { useMemo, useState } from "react";
import { CHANNELS, OUTCOMES, type ActivityRow, type Channel } from "@shared/model";
import { api, useLoad } from "@/lib/api";
import { addDays, dmy, todayISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Timeline } from "@/components/Timeline";
import { AccountPicker, type PickedAccount } from "@/components/AccountPicker";
import { useUI } from "@/components/ui-context";

interface WeekCount {
  week: string;
  channel: string;
  n: number;
}

const COUNTED: Channel[] = ["call", "email", "linkedin", "meeting", "viewing"];
const WEEKS = 6;

/** All logged communication, with weekly counts per channel. */
export function Communication() {
  const [channel, setChannel] = useState("");
  const [outcome, setOutcome] = useState("");
  const [account, setAccount] = useState<PickedAccount | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const ui = useUI();

  const qs = useMemo(() => {
    const p = new URLSearchParams({ limit: "300" });
    if (channel) p.set("channel", channel);
    if (outcome) p.set("outcome", outcome);
    if (account) p.set("account_id", account.id);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p.toString();
  }, [channel, outcome, account, from, to]);

  const { data: items, error } = useLoad(() => api<ActivityRow[]>(`/activities?${qs}`), [qs]);
  const { data: weekly } = useLoad(() => api<WeekCount[]>(`/activities/weekly?weeks=${WEEKS}`), []);

  const weeks = useMemo(() => {
    // Monday of the current week, then the previous WEEKS-1 Mondays.
    const today = todayISO();
    const dow = (new Date(today + "T12:00:00Z").getUTCDay() + 6) % 7;
    const monday = addDays(today, -dow);
    return Array.from({ length: WEEKS }, (_, i) => addDays(monday, -7 * (WEEKS - 1 - i)));
  }, []);
  const count = (week: string, ch: string) => weekly?.find((w) => w.week === week && w.channel === ch)?.n ?? 0;

  const outcomeOptions = channel ? OUTCOMES[channel as Channel] : [];
  const filtered = Boolean(channel || outcome || account || from || to);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="title text-2xl">Communication</h1>
        <Button variant="ghost" size="sm" onClick={() => ui.openCapture("log")}>
          + Log communication
        </Button>
      </header>

      <section className="mb-12 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-[13px] text-muted">
              <th className="pb-2 pr-4 font-normal">Week of</th>
              {COUNTED.map((c) => (
                <th key={c} className="pb-2 pr-4 text-right font-normal">
                  {CHANNELS.find((x) => x.key === c)?.label}
                </th>
              ))}
              <th className="pb-2 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w, i) => {
              const total = COUNTED.reduce((s, c) => s + count(w, c), 0);
              const current = i === weeks.length - 1;
              return (
                <tr key={w} className="border-t border-line">
                  <td className={`py-2.5 pr-4 ${current ? "font-medium" : "text-muted"}`}>{current ? "This week" : dmy(w)}</td>
                  {COUNTED.map((c) => (
                    <td key={c} className={`py-2.5 pr-4 text-right ${count(w, c) ? "" : "text-faint"}`}>
                      {count(w, c)}
                    </td>
                  ))}
                  <td className={`py-2.5 text-right ${current ? "font-medium" : ""}`}>{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_9rem_9rem]">
        <AccountPicker value={account} onChange={setAccount} placeholder="All accounts" />
        <Select
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value);
            setOutcome("");
          }}
          aria-label="Channel"
        >
          <option value="">All channels</option>
          {CHANNELS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </Select>
        <Select value={outcome} onChange={(e) => setOutcome(e.target.value)} disabled={!outcomeOptions.length} aria-label="Outcome">
          <option value="">All outcomes</option>
          {outcomeOptions.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-2 text-[13px] text-muted">
        <span>From</span>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-auto text-[13px]" aria-label="From" />
        <span>to</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-auto text-[13px]" aria-label="To" />
        {filtered && (
          <button
            className="ml-2 hover:text-fg"
            onClick={() => {
              setChannel("");
              setOutcome("");
              setAccount(null);
              setFrom("");
              setTo("");
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {error && <p className="text-sm text-late">{error}</p>}
      {items && <Timeline items={items} showAccount empty={filtered ? "Nothing matches these filters." : "Nothing logged yet."} />}
    </div>
  );
}
