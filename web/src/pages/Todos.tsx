import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { accountStatusLabel, type TodoList, type TodoRow } from "@shared/model";
import { api, DATA_CHANGED } from "@/lib/api";
import { addDays, longDate, relative } from "@/lib/format";
import { TASK_DONE, useUI } from "@/components/ui-context";
import { TodoItem } from "@/components/TodoItem";
import { Skeleton } from "@/components/Skeleton";
import { cn } from "@/lib/utils";
import { Building2, ListTodo, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";

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
  if (!data) return <Skeleton />;

  const empty = !data.overdue.length && !data.due_today.length && !data.upcoming.length;
  const weekEnd = addDays(data.today, 7);
  const nextWeek = data.upcoming.filter((r) => r.due_date && r.due_date <= weekEnd);
  const later = data.upcoming.filter((r) => r.due_date && r.due_date > weekEnd);
  const undated = data.upcoming.filter((r) => !r.due_date);
  const stalled = data.no_follow_up;
  const shownStalled = showStalled ? stalled : stalled.slice(0, 3);

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8 flex items-center justify-between gap-4">
        <h1 className="title text-2xl">{longDate(data.today)}</h1>
        {!empty && (
          <div className="hidden items-center gap-4 text-sm sm:flex">
            <Link to="/review" className="text-muted transition-colors hover:text-fg">
              Weekly review
            </Link>
            <Button onClick={() => ui.openCapture("todo")} title="New to-do (N)">
              <Plus /> New to-do
            </Button>
          </div>
        )}
      </header>

      {stalled.length > 0 && (
        <section className="mb-10 rounded-lg border border-missing/30 bg-missing/[0.06] px-4 pb-1 pt-3" aria-labelledby="stalled-title">
          <h2 id="stalled-title" className="text-sm font-medium text-missing">
            {stalled.length === 1 ? "1 account has" : `${stalled.length} accounts have`} no follow-up planned
          </h2>
          <ul className="mt-1">
            {shownStalled.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 border-t border-missing/15 py-2.5 first:border-t-0">
                <Link to={`/accounts/${a.id}`} className="min-w-0 truncate text-sm hover:underline">
                  {a.name}
                  <span className="text-muted">
                    {` · ${accountStatusLabel(a.status)}`}
                    {a.city && ` · ${a.city}`}
                    {a.last_contact_at ? ` · last contact ${relative(a.last_contact_at)}` : " · not contacted yet"}
                  </span>
                </Link>
                <button
                  onClick={() => ui.openCapture("todo", { account: { id: a.id, name: a.name } })}
                  className="shrink-0 rounded-md px-2 py-1 text-[13px] font-medium text-missing hover:bg-missing/10"
                >
                  + Follow-up
                </button>
              </li>
            ))}
          </ul>
          {stalled.length > 3 && (
            <button onClick={() => setShowStalled((v) => !v)} className="mb-2 text-[13px] text-muted hover:text-fg" aria-expanded={showStalled}>
              {showStalled ? "Show fewer" : `Show all ${stalled.length}`}
            </button>
          )}
        </section>
      )}

      {empty && (
        <EmptyState
          icon={ListTodo}
          title="Nothing on your list"
          text={<>Plan your next follow-up. Type it the way you'd say it, like “Call Sanne tomorrow 10:00”, link it to an account, and the date and time fill themselves in.</>}
        >
          <Button size="lg" onClick={() => ui.openCapture("todo")}>
            <Plus /> New to-do
          </Button>
          <Button size="lg" variant="outline" onClick={() => ui.openCapture("account")}>
            <Building2 /> New account
          </Button>
        </EmptyState>
      )}

      <Section label="Overdue" rows={data.overdue} fading={fading} />
      <Section label="Today" rows={data.due_today} fading={fading} highlight />
      <Section label="Next 7 days" rows={nextWeek} fading={fading} />
      <Section label="Later" rows={later} fading={fading} />
      <Section label="No date" rows={undated} fading={fading} />
    </div>
  );
}

function Section({ label, rows, fading, highlight }: { label: string; rows: TodoRow[]; fading: Set<string>; highlight?: boolean }) {
  if (!rows.length) return null;
  return (
    <section className="mb-10">
      <h2 className={cn("label mb-1 flex items-center gap-2", highlight && "text-accent-text")}>
        {highlight && <span className="size-1.5 rounded-full bg-accent shadow-[0_0_0_3px_var(--accent-soft)]" aria-hidden="true" />}
        {label} <span className="font-normal text-faint">{rows.length}</span>
      </h2>
      <ul>
        {rows.map((r) => (
          <TodoItem key={r.id} todo={r} context={r.account_name ?? r.project_name} fading={fading.has(r.id)} showType />
        ))}
      </ul>
    </section>
  );
}
