import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plus } from "lucide-react";
import { projectStageLabel, type TodoList, type TodoRow } from "@shared/model";
import { api, DATA_CHANGED } from "@/lib/api";
import { addDays, longDate, partOfDay, relative, weekday } from "@/lib/format";
import { firstName } from "@/lib/session";
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

  const name = firstName();

  return (
    <div className="rise mx-auto max-w-3xl">
      <PageHeader
        eyebrow={longDate(data.today)}
        title={`Good ${partOfDay()}${name ? `, ${name}` : ""}.`}
        actions={
          <Button onClick={() => ui.openCapture("todo")} className="hidden md:inline-flex">
            <Plus /> New to-do
          </Button>
        }
      />

      <div className="mb-14 grid grid-cols-2 border-y border-line sm:grid-cols-4">
        <Stat label="Overdue" value={data.overdue.length} late onClick={() => jump("overdue")} />
        <Stat label="Due today" value={data.due_today.length} onClick={() => jump("today")} />
        <Stat label="Coming up" value={data.upcoming.length} onClick={() => jump("upcoming")} />
        <Stat label="No next step" value={data.no_next_step.length} onClick={() => jump("stalled")} />
      </div>

      {empty && <p className="serif mb-14 text-[24px] italic text-muted">Nothing due. A clear day.</p>}

      <div className="grid gap-14">
        {data.overdue.length > 0 && (
          <Panel id="overdue" title="Overdue" tone="text-late-text" count={data.overdue.length}>
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
            {groups.map((g, i) => (
              <div key={g.key}>
                <h3 className={cn("flex items-baseline gap-2 pb-1 text-[12.5px]", i === 0 ? "pt-4" : "border-t border-line pt-5")}>
                  <span className="font-medium text-fg">{g.label}</span>
                  {g.sub && <span className="text-faint">{g.sub}</span>}
                </h3>
                <Rows rows={g.rows} fading={fading} timeOnly={g.byDay} />
              </div>
            ))}
          </Panel>
        )}

        {data.no_next_step.length > 0 && (
          <Panel id="stalled" title="No next step" count={data.no_next_step.length}>
            <ul className="stagger">
              {data.no_next_step.map((p) => (
                <li key={p.id} className="group/row">
                  <Link to={`/projects/${p.id}`} className="flex items-center gap-3.5 border-b border-line py-3 group-last/row:border-b-0">
                    <StageIcon stage={p.stage} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px]">{p.name}</span>
                      <span className="mt-0.5 block truncate text-[12.5px] text-muted">
                        {[p.account_name, projectStageLabel(p.stage)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {p.last_activity_at && <span className="mono shrink-0 text-[12.5px] text-faint">{relative(p.last_activity_at)}</span>}
                    <ArrowRight className="size-3.5 shrink-0 text-faint transition-transform duration-200 group-hover/row:translate-x-0.5" />
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

/** One figure in the summary row: a serif number over a quiet label. */
function Stat({ label, value, late, onClick }: { label: string; value: number; late?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!value}
      className="group flex flex-col gap-1.5 border-line py-5 text-left disabled:cursor-default sm:px-6 sm:first:pl-0 [&:nth-child(even)]:border-l [&:nth-child(even)]:pl-6 [&:nth-child(n+3)]:border-t sm:[&:nth-child(n+2)]:border-l sm:[&:nth-child(n+3)]:border-t-0 sm:[&:nth-child(3)]:pl-6"
    >
      <span className={cn("display text-[44px] leading-none", value ? (late ? "text-late-text" : "text-fg") : "text-faint")}>{value}</span>
      <span className="text-[13px] text-muted transition-colors group-enabled:group-hover:text-fg">{label}</span>
    </button>
  );
}

function Rows({ rows, fading, timeOnly }: { rows: TodoRow[]; fading: Set<string>; timeOnly?: boolean }) {
  return (
    <ul className="stagger">
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
      sub: shortDate(d),
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
