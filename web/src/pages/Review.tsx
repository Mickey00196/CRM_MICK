import { Link } from "react-router-dom";
import type { ProjectRow, TodoList, TodoRow } from "@shared/model";
import { useApi } from "@/lib/api";
import { addDays, daysBetween, relative, todayISO } from "@/lib/format";
import { useUI } from "@/components/ui-context";
import { TodoItem } from "@/components/TodoItem";
import { Skeleton } from "@/components/Skeleton";

/**
 * Weekly review: the five-minute check that nothing is quietly stuck.
 * Built from the to-do list and the board; nothing extra is stored.
 */
export function Review() {
  const todos = useApi<TodoList>("/todos");
  const projects = useApi<ProjectRow[]>("/projects");
  const ui = useUI();

  if (!todos.data || !projects.data) return <Skeleton />;

  const today = todayISO();
  const weekAgo = addDays(today, -7);
  const lastTouch = (p: ProjectRow) => (p.last_activity_at ?? p.stage_changed_at).slice(0, 10);

  const stalled = todos.data.no_next_step;
  const waiting = projects.data.filter((p) => p.stage === "waiting" && p.stage_changed_at.slice(0, 10) <= weekAgo);
  const stalledIds = new Set(todos.data.no_next_step.map((p) => p.id));
  const quiet = projects.data.filter(
    (p) => (p.stage === "todo" || p.stage === "active") && !stalledIds.has(p.id) && daysBetween(lastTouch(p), today) >= 14,
  );
  const longOverdue = todos.data.overdue.filter((t) => t.due_date && t.due_date < weekAgo);
  const all = [...todos.data.overdue, ...todos.data.due_today, ...todos.data.upcoming];
  const avoided = all.filter((t) => (t.snooze_count ?? 0) >= 3);
  const total = stalled.length + waiting.length + quiet.length + longOverdue.length + avoided.length;

  const addStep = (p: { id: string; name: string; account_id: string | null; account_name: string | null }) =>
    ui.openCapture("todo", {
      project: { id: p.id, name: p.name, account_id: p.account_id, account_name: p.account_name },
      account: p.account_id ? { id: p.account_id, name: p.account_name ?? "" } : null,
    });

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-10">
        <h1 className="title text-2xl">Weekly review</h1>
        <p className="mt-1 text-sm text-muted">
          {total === 0 ? "All clear. Nothing is stuck." : `${total} ${total === 1 ? "thing needs" : "things need"} a decision. Five minutes keeps every project moving.`}
        </p>
      </header>

      <Group label="No next step" hint="Add what moves it forward, or mark it done.">
        {stalled.map((p) => (
          <ProjectLine key={p.id} id={p.id} name={p.name} meta={[p.account_name, p.last_activity_at && `last update ${relative(p.last_activity_at)}`]}>
            <ActionButton onClick={() => addStep(p)}>+ Next step</ActionButton>
          </ProjectLine>
        ))}
      </Group>

      <Group label="Waiting for more than a week" hint="Chase it, or move it back to Active.">
        {waiting.map((p) => (
          <ProjectLine key={p.id} id={p.id} name={p.name} meta={[p.waiting_on && `waiting on ${p.waiting_on}`, `since ${relative(p.stage_changed_at)}`]}>
            <ActionButton onClick={() => addStep(p)}>+ Follow up</ActionButton>
          </ProjectLine>
        ))}
      </Group>

      <Group label="Quiet for two weeks or more" hint="Nothing logged lately. Still alive?">
        {quiet.map((p) => (
          <ProjectLine key={p.id} id={p.id} name={p.name} meta={[p.account_name, `last update ${relative(lastTouch(p))}`]}>
            <ActionButton onClick={() => addStep(p)}>+ To-do</ActionButton>
          </ProjectLine>
        ))}
      </Group>

      <TodoGroup label="Overdue by more than a week" hint="Do it, move it, or delete it." rows={longOverdue} />
      <TodoGroup label="Pushed back three times or more" hint="Worth asking why. Break it down or let it go." rows={avoided} />
    </div>
  );
}

function Group({ label, hint, children }: { label: string; hint: string; children: React.ReactNode[] }) {
  if (!children.length) return null;
  return (
    <section className="mb-10">
      <h2 className="label">
        {label} <span className="ml-1 font-normal text-faint">{children.length}</span>
      </h2>
      <p className="mb-1 mt-0.5 text-[13px] text-faint">{hint}</p>
      <ul>{children}</ul>
    </section>
  );
}

function TodoGroup({ label, hint, rows }: { label: string; hint: string; rows: TodoRow[] }) {
  return (
    <Group label={label} hint={hint}>
      {rows.map((r) => (
        <TodoItem key={r.id} todo={r} context={r.project_name ?? r.account_name} showType />
      ))}
    </Group>
  );
}

function ProjectLine({ id, name, meta, children }: { id: string; name: string; meta: (string | null | false | undefined)[]; children?: React.ReactNode }) {
  const parts = meta.filter(Boolean);
  return (
    <li className="flex items-center justify-between gap-4 border-b border-line py-3">
      <Link to={`/projects/${id}`} className="min-w-0 truncate hover:underline">
        {name}
        {parts.length > 0 && <span className="text-sm text-muted"> · {parts.join(" · ")}</span>}
      </Link>
      {children}
    </li>
  );
}

function ActionButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="shrink-0 rounded-md px-2 py-1 text-[13px] font-medium text-muted hover:bg-hover hover:text-fg">
      {children}
    </button>
  );
}
