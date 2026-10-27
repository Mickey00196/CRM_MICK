import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Search } from "lucide-react";
import { ACCOUNT_STATUSES, type AccountRow, type AccountStatus } from "@shared/model";
import { api } from "@/lib/api";
import { daysBetween, dmy, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Chips, Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/dropdown";
import { useUI } from "@/components/ui-context";
import { dueLabel } from "@/components/TodoItem";
import { StatusDot } from "@/components/Brand";
import { toast } from "@/components/Toast";

const COLUMNS: { key: AccountStatus; label: string }[] = [
  { key: "lead", label: "Leads" },
  { key: "prospect", label: "Prospects" },
  { key: "client", label: "Clients" },
];

/** The accounts you're working, by status. Drag a card to move it; each card shows its next follow-up. */
export function AccountsBoard({
  data,
  setData,
  onShowOthers,
}: {
  data: AccountRow[];
  setData: (rows: AccountRow[]) => void;
  onShowOthers: () => void;
}) {
  const [q, setQ] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<AccountStatus | null>(null);
  const [mobile, setMobile] = useState<AccountStatus>("lead");

  const columns = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = data.filter(
      (a) => !t || [a.name, a.office_city, a.office_submarket, a.industry].some((s) => s?.toLowerCase().includes(t)),
    );
    const by: Record<string, AccountRow[]> = { lead: [], prospect: [], client: [] };
    for (const a of list) by[a.status]?.push(a);
    // No follow-up first so it gets seen, then the soonest follow-up.
    const urgency = (a: AccountRow) => (a.next_step ? a.next_step.due_date ?? "9999" : "0000");
    for (const k of Object.keys(by)) by[k].sort((a, b) => urgency(a).localeCompare(urgency(b)) || a.name.localeCompare(b.name));
    return by;
  }, [data, q]);

  const others = data.filter((a) => a.status === "former_client" || a.status === "not_a_fit").length;

  async function move(id: string, status: AccountStatus) {
    const a = data.find((x) => x.id === id);
    if (!a || a.status === status) return;
    setData(data.map((x) => (x.id === id ? { ...x, status } : x)));
    try {
      await api(`/accounts/${id}`, "PATCH", { status });
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name or area" className="h-8 pl-8 text-[13px]" aria-label="Filter accounts" />
        </div>
        {/* Phones: one column at a time. */}
        <Chips
          className="md:hidden"
          size="sm"
          options={COLUMNS.map((c) => ({ key: c.key, label: `${c.label} ${columns[c.key].length}` }))}
          value={mobile}
          onChange={setMobile}
        />
      </div>

      <div className="grid gap-8 md:grid-cols-3 md:gap-5">
        {COLUMNS.map((col) => (
          <section
            key={col.key}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              setOver(col.key);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId) move(dragId, col.key);
              setDragId(null);
              setOver(null);
            }}
            className={cn(
              "min-h-24 min-w-0 rounded-lg transition-colors md:block md:min-h-[55vh]",
              over === col.key && "bg-accent-soft/60",
              col.key !== mobile && "hidden",
            )}
          >
            <h2 className="label mb-3 hidden items-center justify-between border-b border-line pb-2 md:flex">
              <span className="flex items-center gap-2">
                <StatusDot status={col.key} />
                {col.label}
              </span>
              <span className="font-normal text-faint">{columns[col.key].length}</span>
            </h2>
            <div className="grid gap-2">
              {columns[col.key].map((a) => (
                <Card
                  key={a.id}
                  account={a}
                  dragging={dragId === a.id}
                  onDragStart={() => setDragId(a.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOver(null);
                  }}
                  onMove={(s) => move(a.id, s)}
                />
              ))}
              {columns[col.key].length === 0 && (
                <p className="rounded-lg border border-dashed border-line py-6 text-center text-[13px] text-faint">
                  {q ? "No matches" : "Nothing here"}
                </p>
              )}
            </div>
          </section>
        ))}
      </div>

      {others > 0 && (
        <button onClick={onShowOthers} className="mt-8 text-[13px] text-muted hover:text-fg">
          {others} former client{others === 1 ? "" : "s"} or not a fit · show in list
        </button>
      )}
    </>
  );
}

function Card({
  account: a,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  account: AccountRow;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (s: AccountStatus) => void;
}) {
  const navigate = useNavigate();
  const ui = useUI();
  const today = todayISO();
  const next = a.next_step;
  const late = next?.due_date && next.due_date < today;
  const place = [a.office_submarket, a.office_city].filter(Boolean).join(", ");
  const quietDays = a.last_contact_at ? daysBetween(a.last_contact_at.slice(0, 10), today) : null;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", a.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={() => navigate(`/accounts/${a.id}`)}
      onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && navigate(`/accounts/${a.id}`)}
      tabIndex={0}
      className={cn(
        "group/card min-w-0 cursor-pointer rounded-lg border border-line bg-surface px-3.5 py-3 transition-[border-color,box-shadow] hover:border-accent/40 hover:shadow-[0_2px_12px_-4px_var(--accent-glow)]",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-medium leading-snug">{a.name}</h3>
        {/* Clicks inside the menu (it renders in a portal) still bubble to the card; stop them here. */}
        <span onClick={stop} onKeyDown={stop} className="contents">
          <Menu>
            <MenuTrigger asChild>
              <button
                className="-mr-1.5 -mt-1 grid size-7 shrink-0 place-items-center rounded-md text-faint opacity-0 transition-opacity hover:bg-hover hover:text-fg focus:opacity-100 group-hover/card:opacity-100 [@media(hover:none)]:opacity-100"
                aria-label={`Move ${a.name}`}
                title="Move to…"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuLabel>Move to</MenuLabel>
              {ACCOUNT_STATUSES.filter((s) => s.key !== a.status).map((s) => (
                <MenuItem key={s.key} onSelect={() => onMove(s.key)}>
                  <StatusDot status={s.key} /> {s.label}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        </span>
      </div>
      {place && <p className="mt-0.5 truncate text-[13px] text-muted">{place}</p>}

      <div className="mt-2.5 border-t border-line pt-2 text-[13px]">
        {next ? (
          <p className="flex items-baseline justify-between gap-3">
            <span className="truncate">{next.title}</span>
            <span className={cn("num shrink-0", late ? "text-late" : "text-muted")} title={next.due_date ? dmy(next.due_date) : undefined}>
              {next.due_date ? dueLabel(next.due_date, next.due_time, today) : "No date"}
            </span>
          </p>
        ) : (
          <p className="flex items-center justify-between gap-3">
            <span className="text-missing">No follow-up</span>
            <button
              onClick={(e) => {
                stop(e);
                ui.openCapture("todo", { account: { id: a.id, name: a.name } });
              }}
              className="rounded-md px-1.5 py-0.5 font-medium text-missing hover:bg-missing/10"
            >
              + Follow-up
            </button>
          </p>
        )}
        {quietDays !== null && quietDays >= 14 && (
          <p className="mt-1 text-faint">No contact in {Math.floor(quietDays / 7)} weeks</p>
        )}
      </div>
    </article>
  );
}
