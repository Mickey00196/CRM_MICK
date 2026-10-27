import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Plus } from "lucide-react";
import { projectStageLabel, type TodoList, type TodoRow } from "@shared/model";
import { api, DATA_CHANGED } from "@/lib/api";
import { addDays, longDate, relative, weekday } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TASK_DONE, useUI } from "@/components/ui-context";
import { TodoItem } from "@/components/TodoItem";
import { StageIcon } from "@/components/Stage";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/Panel";

// Last list, so coming back to this page is instant.
let lastList: TodoList | null = null;

/** Start page: what needs doing, nothing else. */
export function Todos() {
  const [data, setData] = useState<TodoList | null>(lastList);
  const [error, setError] = useState<string | null>(null);
  const [fading, setFading] = useState<Set<string>>(new Set());
  const fadingRef = useRef<Set<string>>(new Set());
  const ui = useUI();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let seq = 0;
    const load = () => {
      const n = ++seq;
      return api<TodoList>("/todos")
        .then((d) => {
          if (n !== seq) return;
          lastList = d;
          setData(d);
          setError(null);
          fadingRef.current = new Set();
          setFading(new Set());
        })
        .catch((e) => setError(e.message));
    };
    // Give a finished row a moment to fade before the list refreshes.
    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(load, fadingRef.current.size ? 300 : 0);
    };
    const onDone = (e: Event) => {
      fadingRef.current.add((e as CustomEvent<string>).detail);
      setFading(new Set(fadingRef.current));
    };
    load();
    window.addEventListener(DATA_CHANGED, onChange);
    window.addEventListener(TASK_DONE, onDone);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(DATA_CHANGED, onChange);
      window.removeEventListener(TASK_DONE, onDone);
    };
  }, []);

  if (error && !data) return <p className="text-sm text-late-text">{error}</p>;
  if (!data) return null;

  const empty = !data.overdue.length && !data.due_today.length && !data.upcoming.length;
  const groups = groupUpcoming(data.upcoming, data.today);
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="rise mx-auto max-w-3xl">
      <PageHeader
        eyebrow={longDate(data.today)}
        title="To-dos"
        actions={
          <Button onClick={() => ui.openCapture("todo")} className="hidden md:inline-flex">
            <Plus /> New to-do <kbd className="mono ml-1 text-[11px] opacity-60">N</kbd>
          </Button>
        }
      />

      <div className="card mb-10 grid grid-cols-2 sm:grid-cols-4">
        <Stat label="Overdue" value={data.overdue.length} late onClick={() => jump("overdue")} />
        <Stat label="Today" value={data.due_today.length} onClick={() => jump("today")} />
        <Stat label="Coming up" value={data.upcoming.length} onClick={() => jump("upcoming")} />
        <Stat label="No next step" value={data.no_next_step.length} onClick={() => jump("stalled")} />
      </div>

      {empty && (
        <div className="card dot-grid flex flex-col items-center px-6 py-16 text-center">
          <span className="grid size-10 place-items-center rounded-full border border-line bg-surface">
            <Check className="size-4" />
          </span>
          <p className="title mt-4 text-[15px]">Nothing due</p>
          <p className="mt-1 text-[13px] text-muted">Press N to add a to-do or P to start a project.</p>
        </div>
      )}

      <div className="grid gap-9">
        {data.overdue.length > 0 && (
          <Panel id="overdue" title="Overdue" tone="!text-late-text" count={data.overdue.length}>
            <Rows rows={data.overdue} fading={fading} />
          </Panel>
        )}

        {data.due_today.length > 0 && (
          <Panel id="today" title="Today" count={data.due_today.length}>
            <Rows rows={data.due_today} fading={fading} timeOnly />
          </Panel>
        )}

        {groups.length > 0 && (
          <Panel id="upcoming" title="Coming up" count={data.upcoming.length}>
            {groups.map((g) => (
              <div key={g.key}>
                <h3 className="flex items-baseline justify-between border-b border-line bg-subtle/60 px-4 py-1.5 [div:not(:first-child)>&]:border-t">
                  <span className="text-[12.5px] font-medium">{g.label}</span>
                  {g.sub && <span className="mono text-[11.5px] text-faint">{g.sub}</span>}
                </h3>
                <Rows rows={g.rows} fading={fading} timeOnly={g.byDay} />
              </div>
            ))}
          </Panel>
        )}

        {data.no_next_step.length > 0 && (
          <Panel id="stalled" title="No next step" count={data.no_next_step.length}>
            <ul>
              {data.no_next_step.map((p) => (
                <li key={p.id} className="group/row pl-4 transition-colors hover:bg-hover">
                  <Link to={`/projects/${p.id}`} className="flex items-center gap-3 border-b border-line py-2.5 pr-4 group-last/row:border-b-0">
                    <StageIcon stage={p.stage} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px]">{p.name}</span>
                      <span className="block truncate text-[12.5px] text-muted">
                        {[p.account_name, projectStageLabel(p.stage)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {p.last_activity_at && <span className="mono shrink-0 text-[12px] text-faint">{relative(p.last_activity_at)}</span>}
                    <ArrowRight className="size-3.5 shrink-0 text-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}

/** One number in the summary strip. */
function Stat({ label, value, late, onClick }: { label: string; value: number; late?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!value}
      className="flex flex-col gap-1 border-line px-4 py-3.5 text-left transition-colors enabled:hover:bg-hover disabled:cursor-default [&:nth-child(n+3)]:border-t sm:border-l sm:first:border-l-0 sm:[&:nth-child(n+3)]:border-t-0 [&:nth-child(even)]:border-l"
    >
      <span className="label">{label}</span>
      <span className={cn("mono text-[24px] font-medium leading-none tracking-tight", value ? (late ? "text-late-text" : "text-fg") : "text-faint")}>
        {String(value).padStart(2, "0")}
      </span>
    </button>
  );
}

function Rows({ rows, fading, timeOnly }: { rows: TodoRow[]; fading: Set<string>; timeOnly?: boolean }) {
  return (
    <ul>
      {rows.map((r) => (
        <TodoItem
          key={r.id}
          todo={r}
          context={r.project_name ?? r.account_name}
          stage={r.project_stage}
          fading={fading.has(r.id)}
          timeOnly={timeOnly}
        />
      ))}
    </ul>
  );
}

interface Group {
  key: string;
  label: string;
  sub?: string;
  byDay: boolean;
  rows: TodoRow[];
}

/** Tomorrow and the rest of this week by day, then "Later", then undated. */
function groupUpcoming(rows: TodoRow[], today: string): Group[] {
  const weekEnd = addDays(today, 6);
  const byDay = new Map<string, TodoRow[]>();
  const later: TodoRow[] = [];
  const undated: TodoRow[] = [];
  for (const r of rows) {
    if (!r.due_date) undated.push(r);
    else if (r.due_date <= weekEnd) byDay.set(r.due_date, [...(byDay.get(r.due_date) ?? []), r]);
    else later.push(r);
  }
  const groups: Group[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, rs]) => ({
      key: d,
      label: d === addDays(today, 1) ? "Tomorrow" : weekday(d, "long"),
      sub: shortDate(d).toUpperCase(),
      byDay: true,
      rows: rs,
    }));
  if (later.length) groups.push({ key: "later", label: "Later", byDay: false, rows: later });
  if (undated.length) groups.push({ key: "undated", label: "No date", byDay: false, rows: undated });
  return groups;
}

function shortDate(iso: string) {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });
}
