import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { projectStageLabel, type TodoList, type TodoRow } from "@shared/model";
import { api, DATA_CHANGED } from "@/lib/api";
import { longDate, relative } from "@/lib/format";
import { TASK_DONE, useUI } from "@/components/ui-context";
import { TodoItem } from "@/components/TodoItem";

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
          Nothing to do. Press <kbd className="rounded border border-line px-1 text-xs">N</kbd> to add a to-do or{" "}
          <kbd className="rounded border border-line px-1 text-xs">P</kbd> to start a project.
        </p>
      )}

      <Section label="Overdue" rows={data.overdue} fading={fading} />
      <Section label="Today" rows={data.due_today} fading={fading} />
      <Section label="Upcoming" rows={data.upcoming} fading={fading} />

      {data.no_next_step.length > 0 && (
        <div className="mt-14 text-[13px]">
          <button onClick={() => setShowStalled((v) => !v)} className="text-muted hover:text-fg" aria-expanded={showStalled}>
            Projects without a next step ({data.no_next_step.length})
          </button>
          {showStalled && (
            <ul className="mt-3">
              {data.no_next_step.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-4 border-t border-line py-3 first:border-t-0">
                  <Link to={`/projects/${p.id}`} className="min-w-0 truncate text-sm text-fg hover:text-accent">
                    {p.name}
                    {p.account_name && <span className="text-muted"> · {p.account_name}</span>}
                  </Link>
                  <span className="shrink-0 text-[13px] text-faint">
                    {projectStageLabel(p.stage)}
                    {p.last_activity_at && ` · last update ${relative(p.last_activity_at)}`}
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

function Section({ label, rows, fading }: { label: string; rows: TodoRow[]; fading: Set<string> }) {
  if (!rows.length) return null;
  return (
    <section className="mb-10">
      <h2 className="label mb-1">{label}</h2>
      <ul>
        {rows.map((r) => (
          <TodoItem key={r.id} todo={r} context={r.project_name ?? r.account_name} fading={fading.has(r.id)} showType hideToday />
        ))}
      </ul>
    </section>
  );
}
