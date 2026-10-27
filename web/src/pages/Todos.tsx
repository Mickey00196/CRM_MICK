import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronDown, Plus } from "lucide-react";
import { projectStageLabel, type TodoList, type TodoRow } from "@shared/model";
import { api, DATA_CHANGED } from "@/lib/api";
import { addDays, dmy, longDate, partOfDay, relative, weekday } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TASK_DONE, useUI } from "@/components/ui-context";
import { TodoItem } from "@/components/TodoItem";
import { StageDot } from "@/components/Stage";
import { Button } from "@/components/ui/button";

// Last list, so coming back to this page is instant.
let lastList: TodoList | null = null;

/** Start page: what needs doing, nothing else. */
export function Todos() {
  const [data, setData] = useState<TodoList | null>(lastList);
  const [error, setError] = useState<string | null>(null);
  const [fading, setFading] = useState<Set<string>>(new Set());
  const [showStalled, setShowStalled] = useState(false);
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

  if (error && !data) return <p className="text-sm text-late">{error}</p>;
  if (!data) return null;

  const empty = !data.overdue.length && !data.due_today.length && !data.upcoming.length;
  const groups = groupUpcoming(data.upcoming, data.today);

  return (
    <div className="rise mx-auto max-w-3xl">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label mb-2">Good {partOfDay()}</p>
          <h1 className="display text-[28px] sm:text-[34px]">{longDate(data.today)}</h1>
        </div>
        <Button variant="accent" onClick={() => ui.openCapture("todo")} className="hidden md:inline-flex">
          <Plus className="size-4" /> Add to-do
        </Button>
      </header>

      <WeekStrip data={data} />

      {data.no_next_step.length > 0 && (
        <div className="mb-8 overflow-hidden rounded-[14px] border border-[color-mix(in_srgb,var(--missing)_25%,transparent)] bg-missing-soft">
          <button
            onClick={() => setShowStalled((v) => !v)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm sm:px-5"
            aria-expanded={showStalled}
          >
            <AlertTriangle className="size-4 shrink-0 text-missing" />
            <span className="flex-1">
              <span className="font-semibold text-fg">
                {data.no_next_step.length} {data.no_next_step.length === 1 ? "project has" : "projects have"} no next step
              </span>
              <span className="hidden text-muted sm:inline"> · add a to-do so they don't stall</span>
            </span>
            <ChevronDown className={cn("size-4 text-muted transition-transform", showStalled && "rotate-180")} />
          </button>
          {showStalled && (
            <ul className="border-t border-[color-mix(in_srgb,var(--missing)_20%,transparent)] bg-surface/60">
              {data.no_next_step.map((p) => (
                <li key={p.id} className="border-b border-line last:border-b-0">
                  <Link
                    to={`/projects/${p.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm transition-colors hover:bg-surface sm:px-5"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <StageDot stage={p.stage} />
                      <span className="truncate font-medium">{p.name}</span>
                      {p.account_name && <span className="truncate text-muted">· {p.account_name}</span>}
                    </span>
                    <span className="shrink-0 text-[13px] text-faint">
                      {projectStageLabel(p.stage)}
                      {p.last_activity_at && <span className="hidden sm:inline"> · last update {relative(p.last_activity_at)}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {empty && (
        <div className="card flex flex-col items-center px-6 py-14 text-center">
          <CheckCircle2 className="mb-3 size-9 text-accent" strokeWidth={1.5} />
          <p className="title text-lg">All clear</p>
          <p className="mt-1 text-sm text-muted">
            Press <kbd className="rounded border border-line bg-subtle px-1 text-xs">N</kbd> to add a to-do or{" "}
            <kbd className="rounded border border-line bg-subtle px-1 text-xs">P</kbd> to start a project.
          </p>
        </div>
      )}

      <Section id="overdue" label="Overdue" tone="late" rows={data.overdue} fading={fading} />
      <Section id="today" label="Today" tone="brass" rows={data.due_today} fading={fading} timeOnly />

      {groups.length > 0 && (
        <section className="mb-8">
          <SectionLabel label="Coming up" count={data.upcoming.length} />
          <div className="card overflow-hidden">
            {groups.map((g) => (
              <div key={g.key} id={g.anchor}>
                <div className="flex items-baseline justify-between border-b border-line bg-subtle/60 px-4 py-1.5 sm:px-5">
                  <span className="text-[12.5px] font-semibold text-muted">{g.label}</span>
                  {g.sub && <span className="text-[12px] text-faint">{g.sub}</span>}
                </div>
                <ul>
                  {g.rows.map((r) => (
                    <TodoItem
                      key={r.id}
                      todo={r}
                      context={r.project_name ?? r.account_name}
                      stage={r.project_stage}
                      fading={fading.has(r.id)}
                      timeOnly={Boolean(g.anchor)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Today plus the next six days, with how much is due on each. The overdue count sits in front. */
function WeekStrip({ data }: { data: TodoList }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(data.today, i));
  const count = (d: string) =>
    d === data.today ? data.due_today.length : data.upcoming.filter((r) => r.due_date === d).length;
  const max = Math.max(1, ...days.map(count));
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="mb-8 flex gap-1.5 sm:gap-2">
      {data.overdue.length > 0 && (
        <button
          onClick={() => jump("overdue")}
          className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-late-soft px-1 py-2.5 text-late transition-transform hover:-translate-y-0.5 sm:w-16"
          title="Overdue"
        >
          <span className="title text-xl leading-none">{data.overdue.length}</span>
          <span className="mt-1 text-[11px] font-semibold uppercase tracking-wide">Late</span>
        </button>
      )}
      <div className="grid flex-1 grid-cols-7 gap-1.5 sm:gap-2">
        {days.map((d) => {
          const n = count(d);
          const isToday = d === data.today;
          const weekend = [0, 6].includes(new Date(d + "T12:00:00Z").getUTCDay());
          return (
            <button
              key={d}
              disabled={!n}
              onClick={() => jump(isToday ? "today" : `day-${d}`)}
              title={n ? `${n} due ${isToday ? "today" : dmy(d)}` : "Nothing due"}
              className={cn(
                "flex flex-col items-center rounded-xl border px-0.5 pb-2 pt-2 transition-all enabled:hover:-translate-y-0.5 enabled:hover:shadow-[var(--shadow-lift)]",
                isToday ? "border-transparent bg-brass text-brass-fg shadow-[var(--shadow-card)]" : "border-line bg-surface shadow-[var(--shadow-card)]",
                !isToday && weekend && "bg-subtle/70",
                !n && !isToday && "cursor-default",
              )}
            >
              <span className={cn("text-[10.5px] font-semibold uppercase tracking-wide", isToday ? "text-brass-fg/75" : "text-faint")}>
                {weekday(d)}
              </span>
              <span className="title text-lg leading-tight sm:text-xl">{Number(d.slice(8))}</span>
              <span className="mt-1.5 flex h-1.5 w-full items-center justify-center px-2">
                {n > 0 ? (
                  <span
                    className={cn("h-1.5 rounded-full", isToday ? "bg-brass-fg/70" : "bg-accent")}
                    style={{ width: `${Math.max(18, (n / max) * 100)}%` }}
                  />
                ) : (
                  <span className={cn("size-1 rounded-full", isToday ? "bg-brass-fg/30" : "bg-line-strong")} />
                )}
              </span>
              <span className={cn("mt-1 text-[11px] tabular-nums", isToday ? "font-semibold" : n ? "text-muted" : "text-transparent")}>
                {n || "·"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SectionLabel({ label, count, tone }: { label: string; count: number; tone?: "late" | "brass" }) {
  return (
    <h2 className="mb-2.5 flex items-center gap-2 px-1">
      <span className={cn("label", tone === "late" && "text-late")}>{label}</span>
      <span
        className={cn(
          "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
          tone === "late" ? "bg-late-soft text-late" : tone === "brass" ? "bg-brass-soft text-fg" : "bg-subtle text-muted",
        )}
      >
        {count}
      </span>
    </h2>
  );
}

function Section({
  id,
  label,
  tone,
  rows,
  fading,
  timeOnly,
}: {
  id: string;
  label: string;
  tone?: "late" | "brass";
  rows: TodoRow[];
  fading: Set<string>;
  timeOnly?: boolean;
}) {
  if (!rows.length) return null;
  return (
    <section id={id} className="mb-8 scroll-mt-6">
      <SectionLabel label={label} count={rows.length} tone={tone} />
      <ul
        className={cn(
          "card overflow-hidden",
          tone === "late" && "border-l-[3px] border-l-late",
          tone === "brass" && "border-l-[3px] border-l-brass",
        )}
      >
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
    </section>
  );
}

interface Group {
  key: string;
  anchor?: string;
  label: string;
  sub?: string;
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
      anchor: `day-${d}`,
      label: d === addDays(today, 1) ? "Tomorrow" : weekday(d, "long"),
      sub: dmy(d),
      rows: rs,
    }));
  if (later.length) groups.push({ key: "later", label: "Later", rows: later });
  if (undated.length) groups.push({ key: "undated", label: "No date", rows: undated });
  return groups;
}
