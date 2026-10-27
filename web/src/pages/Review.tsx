import { Link } from "react-router-dom";
import { FOLLOW_UP_STATUSES, accountStatusLabel, type AccountRow, type TodoList, type TodoRow } from "@shared/model";
import { useApi } from "@/lib/api";
import { addDays, daysBetween, relative, todayISO } from "@/lib/format";
import { useUI } from "@/components/ui-context";
import { TodoItem } from "@/components/TodoItem";
import { Skeleton } from "@/components/Skeleton";

/**
 * Weekly review: the five-minute check that no account goes cold.
 * Built from the to-do list and the accounts; nothing extra is stored.
 */
export function Review() {
  const todos = useApi<TodoList>("/todos");
  const accounts = useApi<AccountRow[]>("/accounts");
  const ui = useUI();

  if (!todos.data || !accounts.data) return <Skeleton />;

  const today = todayISO();
  const weekAgo = addDays(today, -7);

  const stalled = todos.data.no_follow_up;
  const stalledIds = new Set(stalled.map((a) => a.id));
  // Being worked, something is planned, but nobody has spoken to them in two weeks.
  const lastTouch = (a: AccountRow) => (a.last_contact_at ?? a.created_at).slice(0, 10);
  const quiet = accounts.data.filter(
    (a) => FOLLOW_UP_STATUSES.includes(a.status) && !stalledIds.has(a.id) && daysBetween(lastTouch(a), today) >= 14,
  );
  const longOverdue = todos.data.overdue.filter((t) => t.due_date && t.due_date < weekAgo);
  const all = [...todos.data.overdue, ...todos.data.due_today, ...todos.data.upcoming];
  const avoided = all.filter((t) => (t.snooze_count ?? 0) >= 3);
  const total = stalled.length + quiet.length + longOverdue.length + avoided.length;

  const followUp = (a: { id: string; name: string }) => ui.openCapture("todo", { account: { id: a.id, name: a.name } });

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-10">
        <h1 className="title text-2xl">Weekly review</h1>
        <p className="mt-1 text-sm text-muted">
          {total === 0 ? "All clear. Every account has a follow-up." : `${total} ${total === 1 ? "thing needs" : "things need"} a decision. Five minutes keeps every account warm.`}
        </p>
      </header>

      <Group label="No follow-up planned" hint="Plan the next touch, or move the account to Not a fit.">
        {stalled.map((a) => (
          <AccountLine key={a.id} id={a.id} name={a.name} meta={[accountStatusLabel(a.status), a.city, a.last_contact_at ? `last contact ${relative(a.last_contact_at)}` : "not contacted yet"]}>
            <ActionButton onClick={() => followUp(a)}>+ Follow-up</ActionButton>
          </AccountLine>
        ))}
      </Group>

      <Group label="No contact for two weeks or more" hint="A follow-up is planned, but it's been quiet. Still warm?">
        {quiet.map((a) => (
          <AccountLine key={a.id} id={a.id} name={a.name} meta={[accountStatusLabel(a.status), a.last_contact_at ? `last contact ${relative(a.last_contact_at)}` : "not contacted yet"]}>
            <ActionButton onClick={() => ui.openLog({ account: { id: a.id, name: a.name }, channel: "call" })}>Log contact</ActionButton>
          </AccountLine>
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
        <TodoItem key={r.id} todo={r} context={r.account_name ?? r.project_name} showType />
      ))}
    </Group>
  );
}

function AccountLine({ id, name, meta, children }: { id: string; name: string; meta: (string | null | false | undefined)[]; children?: React.ReactNode }) {
  const parts = meta.filter(Boolean);
  return (
    <li className="flex items-center justify-between gap-4 border-b border-line py-3">
      <Link to={`/accounts/${id}`} className="min-w-0 truncate hover:underline">
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
