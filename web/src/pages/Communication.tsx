import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/Panel";
import { CHANNELS, OUTCOMES, type ActivityRow, type Channel } from "@shared/model";
import { api, useApi } from "@/lib/api";
import { addDays, dmy, todayISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Timeline } from "@/components/Timeline";
import { AccountPicker, type PickedAccount } from "@/components/Pickers";
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

  const { data: items, error } = useApi<ActivityRow[]>(`/activities?${qs}`);
  const { data: weekly } = useApi<WeekCount[]>(`/activities/weekly?weeks=${WEEKS}`);

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
    <div className="rise mx-auto max-w-4xl">
      <PageHeader
        title="Log"
        subtitle="Calls, emails, meetings and notes, newest first."
        actions={
          <Button onClick={() => ui.openCapture("log")}>
            <Plus /> Log something
          </Button>
        }
      />

      <section className="card mb-8 overflow-x-auto">
        <table className="data min-w-[520px]">
          <thead>
            <tr>
              <th>Week of</th>
              {COUNTED.map((c) => (
                <th key={c} className="text-right">
                  {CHANNELS.find((x) => x.key === c)?.label}
                </th>
              ))}
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w, i) => {
              const total = COUNTED.reduce((s, c) => s + count(w, c), 0);
              const current = i === weeks.length - 1;
              return (
                <tr key={w} className={current ? "bg-subtle/70" : undefined}>
                  <td className={current ? "font-medium" : "mono text-[12.5px] text-muted"}>{current ? "This week" : dmy(w)}</td>
                  {COUNTED.map((c) => {
                    const n = count(w, c);
                    return (
                      <td key={c} className="text-right">
                        <span
                          className={`mono inline-grid min-w-7 place-items-center rounded-md px-1.5 py-0.5 text-[12.5px] ${n ? "font-medium" : "text-faint"}`}
                          style={n ? { background: `color-mix(in srgb, var(--fg) ${Math.min(22, 6 + n * 4)}%, transparent)` } : undefined}
                        >
                          {n}
                        </span>
                      </td>
                    );
                  })}
                  <td className="mono text-right text-[12.5px] font-medium">{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_9rem_9rem]">
        <AccountPicker value={account} onChange={setAccount} placeholder="All companies" />
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
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-auto text-[13px]" aria-label="From" />
        <span>to</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-auto text-[13px]" aria-label="To" />
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
      {items && (
        <div className="card px-4 py-1">
          <Timeline items={items} showAccount showProject empty={filtered ? "Nothing matches these filters." : "Nothing logged yet."} />
        </div>
      )}
    </div>
  );
}
