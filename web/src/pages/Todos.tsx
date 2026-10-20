import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { accountStatusLabel, type TodoList, type TodoRow } from "@shared/model";
import { api, DATA_CHANGED } from "@/lib/api";
import { daysBetween, dmy, longDate, relative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TASK_DONE, useUI } from "@/components/ui-context";

/** Calm list of what to follow up. Rows show only the account (or title) and the due date. */
export function Todos() {
  const [data, setData] = useState<TodoList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fading, setFading] = useState<Set<string>>(new Set());
  const [showStalled, setShowStalled] = useState(false);
  const fadingRef = useRef<Set<string>>(new Set());
  const ui = useUI();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () =>
      api<TodoList>("/todos")
        .then((d) => {
          setData(d);
          setError(null);
          fadingRef.current = new Set();
          setFading(new Set());
        })
        .catch((e) => setError(e.message));

    // Wait a beat so a just-finished row can fade before the list refreshes.
    const onChange = () =>
      setTimeout(() => {
        clearTimeout(timer);
        timer = setTimeout(load, fadingRef.current.size ? 300 : 0);
      }, 0);
    const onDone = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      fadingRef.current.add(id);
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

  if (error) return <p className="text-sm text-late">{error}</p>;
  if (!data) return null;

  const empty = !data.overdue.length && !data.due_today.length && !data.upcoming.length;

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-10 flex items-baseline justify-between gap-4">
        <h1 className="title text-2xl">{longDate(data.today)}</h1>
        <button onClick={() => ui.openCapture("todo")} className="text-sm text-muted transition-colors hover:text-fg">
          + Add
        </button>
      </header>

      {empty && (
        <p className="py-10 text-muted">
          Nothing to follow up. Press <kbd className="rounded border border-line px-1 text-xs">⌘K</kbd> to add a to-do.
        </p>
      )}

      <Section label="Overdue" rows={data.overdue} today={data.today} fading={fading} />
      <Section label="Today" rows={data.due_today} today={data.today} fading={fading} />
      <Section label="Upcoming" rows={data.upcoming} today={data.today} fading={fading} />

      {data.no_next_step.length > 0 && (
        <div className="mt-14 text-[13px]">
          <button onClick={() => setShowStalled((v) => !v)} className="text-muted hover:text-fg" aria-expanded={showStalled}>
            No next step ({data.no_next_step.length})
          </button>
          {showStalled && (
            <ul className="mt-3">
              {data.no_next_step.map((a) => (
                <li key={a.id} className="flex items-baseline justify-between gap-4 border-t border-line py-3 first:border-t-0">
                  <Link to={`/accounts/${a.id}`} className="text-sm text-fg hover:text-accent">
                    {a.name}
                  </Link>
                  <span className="text-[13px] text-faint">
                    {accountStatusLabel(a.status)} · {a.last_contact_at ? `last contact ${relative(a.last_contact_at)}` : "never contacted"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ label, rows, today, fading }: { label: string; rows: TodoRow[]; today: string; fading: Set<string> }) {
  const ui = useUI();
  if (!rows.length) return null;
  return (
    <section className="mb-10">
      <h2 className="label mb-1">{label}</h2>
      <ul>
        {rows.map((r) => (
          <li key={r.id} className={cn("border-b border-line", fading.has(r.id) && "fade-out")}>
            <div className="flex items-center gap-4 py-4">
              <button
                onClick={() => ui.openTask(r.id, "complete")}
                className="group grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] border-line-strong transition-colors hover:border-fg"
                aria-label={`Complete ${r.title}`}
              >
                <span className="size-2 rounded-full bg-fg opacity-0 transition-opacity group-hover:opacity-30" />
              </button>
              <button onClick={() => ui.openTask(r.id)} className="flex min-w-0 flex-1 items-baseline justify-between gap-4 text-left">
                <span className="truncate">{r.account_name ?? r.title}</span>
                <span className={cn("shrink-0 text-sm", r.due_date && r.due_date < today ? "text-late" : "text-muted")}>
                  {dueLabel(r.due_date, r.due_time, today)}
                </span>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function dueLabel(due: string | null, time: string | null, today: string): string {
  if (!due) return "";
  // Today's rows show just the time (the section already says Today).
  if (due === today) return time ?? "";
  return time && daysBetween(today, due) < 7 ? `${dmy(due)} ${time}` : dmy(due);
}
