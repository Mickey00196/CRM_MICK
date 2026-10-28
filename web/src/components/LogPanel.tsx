import { useMemo, useState } from "react";
import { Eye, Mail, Phone, SlidersHorizontal, StickyNote, Users } from "lucide-react";
import { accountStatusLabel, type AccountStatus, type ActivityRow, type Channel } from "@shared/model";
import { api, useApi } from "@/lib/api";
import { dmy, dmyTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { StatusDot } from "./Brand";
import { Timeline } from "./Timeline";
import { useUI } from "./ui-context";
import { toast, toastMove } from "./Toast";

const QUICK: { key: Channel; label: string; icon: typeof Phone }[] = [
  { key: "note", label: "Note", icon: StickyNote },
  { key: "call", label: "Call", icon: Phone },
  { key: "email", label: "Email", icon: Mail },
  { key: "meeting", label: "Meeting", icon: Users },
  { key: "viewing", label: "Viewing", icon: Eye },
];

interface Group {
  stage: AccountStatus | null;
  entries: ActivityRow[];
  /** The "moved to this stage" entry, shown at the bottom of its group. */
  started: ActivityRow | null;
}

/**
 * The account's log, always beside the page: write what happened, and read it back per stage.
 * Newest first. Each stage is a section, from the current one down to where it started.
 */
export function LogPanel({ account, className }: { account: { id: string; name: string; status: AccountStatus }; className?: string }) {
  const { data: items } = useApi<ActivityRow[]>(`/activities?account_id=${account.id}&limit=300`);
  const [channel, setChannel] = useState<Channel>("note");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ui = useUI();

  async function save() {
    const summary = text.trim();
    if (!summary || busy) return;
    setBusy(true);
    try {
      const res = await api("/activities", "POST", { account_id: account.id, channel, summary, direction: "outbound" });
      toastMove(res);
      setText("");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const entryCount = (items ?? []).filter((x) => x.channel !== "stage").length;

  const groups = useMemo(() => {
    const out: Group[] = [];
    for (const x of items ?? []) {
      const stage = x.stage;
      let g = out[out.length - 1];
      // A new section whenever the stage changes, or after the entry that started the previous one.
      if (!g || g.stage !== stage || g.started) {
        g = { stage, entries: [], started: null };
        out.push(g);
      }
      if (x.channel === "stage") g.started = x;
      else g.entries.push(x);
    }
    // The current stage always comes first, even before anything is logged in it.
    if (out[0]?.stage !== account.status) out.unshift({ stage: account.status, entries: [], started: null });
    return out;
  }, [items, account.status]);

  return (
    <aside
      className={cn("flex max-h-[85vh] min-h-[28rem] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgb(15_20_26/0.04)]", className)}
      aria-label="Log"
    >
      <header className="flex min-h-12 items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h2 className="label flex items-center gap-2">
          Log <span className="num font-normal text-faint">{entryCount || ""}</span>
        </h2>
        <span className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-[12px] text-muted">
          <StatusDot status={account.status} /> at {accountStatusLabel(account.status)}
        </span>
      </header>

      {/* Write */}
      <div className="border-b border-line bg-subtle/40 p-4">
        <Textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              save();
            }
          }}
          placeholder="What happened? Write it down while it's fresh."
          aria-label="New log entry"
          className="resize-none bg-surface text-[14px] leading-relaxed"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex gap-0.5" role="radiogroup" aria-label="Type">
            {QUICK.map((q) => (
              <button
                key={q.key}
                type="button"
                role="radio"
                aria-checked={channel === q.key}
                onClick={() => setChannel(q.key)}
                title={q.label}
                className={cn(
                  "grid size-8 place-items-center rounded-md transition-colors",
                  channel === q.key ? "bg-accent-soft text-accent-text" : "text-faint hover:bg-hover hover:text-fg",
                )}
              >
                <q.icon className="size-4" />
                <span className="sr-only">{q.label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => ui.openLog({ account: { id: account.id, name: account.name }, channel })}
              title="More: outcome, contact, date and next follow-up"
              aria-label="Log with more detail"
            >
              <SlidersHorizontal />
            </Button>
            <Button size="sm" onClick={save} disabled={!text.trim() || busy} title="Save (⌘↵)">
              Save
            </Button>
          </div>
        </div>
      </div>

      {/* Read, per stage */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {!items ? (
          <div className="grid animate-pulse gap-2 pt-5">
            <div className="h-3 w-1/3 rounded bg-subtle" />
            <div className="h-3 w-5/6 rounded bg-subtle" />
            <div className="h-3 w-2/3 rounded bg-subtle" />
          </div>
        ) : (
          groups.map((g, i) => (
            <section key={g.started?.id ?? `${g.stage}-${i}`} className="pt-5">
              <h3 className="sticky top-0 z-[1] -mx-4 flex items-center gap-2 bg-surface/95 px-4 py-1.5 backdrop-blur">
                {g.stage ? <StatusDot status={g.stage} /> : null}
                <span className={cn("label text-[10.5px]", i === 0 && "text-accent-text")}>{g.stage ? accountStatusLabel(g.stage) : "Earlier"}</span>
                <span className="num text-[11px] text-faint">{g.entries.length || ""}</span>
                <span className="h-px flex-1 bg-line" />
              </h3>
              {g.entries.length > 0 ? (
                <Timeline items={g.entries} compact empty="" />
              ) : (
                <p className="py-3 text-[13px] text-faint">{i === 0 ? `Nothing logged at ${accountStatusLabel(account.status)} yet.` : "Nothing logged at this stage."}</p>
              )}
              {g.started && (
                <p className="mt-1 text-[12px] text-faint" title={dmyTime(g.started.occurred_at)}>
                  Moved here <span className="num">{dmy(g.started.occurred_at)}</span>
                  {g.started.summary.includes("→") && ` from ${g.started.summary.split("→")[0].trim()}`}
                </p>
              )}
            </section>
          ))
        )}
      </div>
    </aside>
  );
}
