import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, CalendarDays, ChevronRight, CircleAlert, CircleCheck, FolderX, Plus } from "lucide-react";
import { projectStageLabel, type TodoList, type TodoRow } from "@shared/model";
import { api, DATA_CHANGED } from "@/lib/api";
import { addDays, longDate, relative, weekday } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TASK_DONE, useUI } from "@/components/ui-context";
import { TodoItem } from "@/components/TodoItem";
import { StageDot } from "@/components/Stage";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, PanelHead } from "@/components/Panel";

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
            <Plus /> New To-do
          </Button>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Today" count={data.due_today.length} icon={CalendarDays} tone="bg-accent" onClick={() => jump("today")} />
        <Tile label="Overdue" count={data.overdue.length} icon={CircleAlert} tone="bg-late" onClick={() => jump("overdue")} />
        <Tile label="Coming up" count={data.upcoming.length} icon={CalendarClock} tone="bg-orange" onClick={() => jump("upcoming")} />
        <Tile label="No next step" count={data.no_next_step.length} icon={FolderX} tone="bg-gray" onClick={() => jump("stalled")} />
      </div>

      {empty && (
        <div className="card flex flex-col items-center px-6 py-14 text-center">
          <CircleCheck className="mb-3 size-12 text-green" strokeWidth={1.5} />
          <p className="title text-[20px]">All done</p>
          <p className="mt-1 text-[15px] text-muted">Nothing due. Press N to add a to-do or P to start a project.</p>
        </div>
      )}

      <div className="grid gap-8">
        {data.overdue.length > 0 && (
          <Panel id="overdue" title="Overdue" tone="text-late-text" count={data.overdue.length}>
            <Rows rows={data.overdue} fading={fading} />
          </Panel>
        )}

        {data.due_today.length > 0 && (
          <Panel id="today" title="Today" tone="text-accent" count={data.due_today.length}>
            <Rows rows={data.due_today} fading={fading} timeOnly />
          </Panel>
        )}

        {groups.length > 0 && (
          <section id="upcoming" className="scroll-mt-20">
            <PanelHead title="Coming up" count={data.upcoming.length} />
            <div className="grid gap-4">
              {groups.map((g) => (
                <div key={g.key}>
                  <h3 className="mb-1.5 flex items-baseline gap-2 px-1 text-[13px]">
                    <span className="font-semibold uppercase tracking-[0.02em] text-muted">{g.label}</span>
                    {g.sub && <span className="text-faint">{g.sub}</span>}
                  </h3>
                  <div className="card overflow-hidden">
                    <Rows rows={g.rows} fading={fading} timeOnly={g.byDay} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.no_next_step.length > 0 && (
          <Panel id="stalled" title="Needs a next step" tone="text-missing" count={data.no_next_step.length}>
            <ul>
              {data.no_next_step.map((p) => (
                <li key={p.id} className="group/row pl-4 transition-colors hover:bg-hover">
                  <Link
                    to={`/projects/${p.id}`}
                    className="flex items-center gap-3 border-b border-line py-2.5 pr-3 group-last/row:border-b-0"
                  >
                    <StageDot stage={p.stage} className="size-2.5" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px]">{p.name}</span>
                      <span className="block truncate text-[13px] text-muted">
                        {[p.account_name, projectStageLabel(p.stage), p.last_activity_at && `updated ${relative(p.last_activity_at)}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-faint" />
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

/** A smart-list tile, like the ones at the top of Reminders. */
function Tile({
  label,
  count,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  icon: typeof CalendarDays;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!count}
      className="card flex flex-col justify-between gap-3 p-3.5 text-left transition-transform enabled:active:scale-[0.98] disabled:cursor-default"
    >
      <span className="flex w-full items-start justify-between">
        <span className={cn("grid size-8 place-items-center rounded-full text-white", tone)}>
          <Icon className="size-[17px]" strokeWidth={2.2} />
        </span>
        <span className={cn("display text-[28px] leading-none tabular-nums", !count && "text-faint")}>{count}</span>
      </span>
      <span className="text-[15px] font-semibold text-muted">{label}</span>
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
