import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Search } from "lucide-react";
import { ACCOUNT_STATUSES, FLOW, OPPORTUNITY_STAGES, type AccountRow, type AccountStatus } from "@shared/model";
import { api } from "@/lib/api";
import { daysBetween, dmy, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Chips, Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/dropdown";
import { useUI } from "@/components/ui-context";
import { dueLabel } from "@/components/TodoItem";
import { StatusDot } from "@/components/Brand";
import { toast } from "@/components/Toast";

const GROUPS: { phase: string; stages: AccountStatus[] }[] = [
  { phase: "Lead", stages: ["lead"] },
  { phase: "Opportunity", stages: OPPORTUNITY_STAGES },
  { phase: "Invoicing", stages: ["invoicing"] },
];
const label = (s: AccountStatus) => ACCOUNT_STATUSES.find((x) => x.key === s)!.label;

/**
 * Lead, the seven opportunity steps, invoicing. Drag a card or use its menu to move it; a logged
 * viewing moves it to Viewing on its own. Empty steps shrink so the busy ones get the room.
 */
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
    const by = Object.fromEntries(FLOW.map((k) => [k, [] as AccountRow[]])) as Record<string, AccountRow[]>;
    for (const a of list) by[a.status]?.push(a);
    // No follow-up first so it gets seen, then the soonest follow-up.
    const urgency = (a: AccountRow) => (a.next_step ? a.next_step.due_date ?? "9999" : "0000");
    for (const k of Object.keys(by)) by[k].sort((a, b) => urgency(a).localeCompare(urgency(b)) || a.name.localeCompare(b.name));
    return by;
  }, [data, q]);

  const others = data.filter((a) => a.status === "not_now").length;

  // Fade the edges that have more columns behind them.
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const checkEdges = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  }, []);
  useEffect(() => {
    checkEdges();
    window.addEventListener("resize", checkEdges);
    return () => window.removeEventListener("resize", checkEdges);
  }, [checkEdges, columns]);

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

  // A plain function, not a component, so columns aren't remounted on every drag-over.
  function column(stage: AccountStatus) {
    const rows = columns[stage];
    const narrow = rows.length === 0 && over !== stage;
    return (
      <section
        key={stage}
        onDragOver={(e) => {
          if (!dragId) return;
          e.preventDefault();
          setOver(stage);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (dragId) move(dragId, stage);
          setDragId(null);
          setOver(null);
        }}
        className={cn(
          "min-h-24 min-w-0 rounded-lg transition-[background-color,width] md:min-h-[55vh] md:shrink-0",
          narrow ? "md:w-28" : "md:w-56",
          over === stage && "bg-accent-soft/60",
          stage !== mobile && "hidden md:block",
        )}
      >
        <h2 className="label mb-3 hidden items-center justify-between gap-2 border-b border-line pb-2 md:flex">
          <span className="flex min-w-0 items-center gap-2">
            <StatusDot status={stage} />
            <span className="truncate">{label(stage)}</span>
          </span>
          <span className="font-normal text-faint">{rows.length}</span>
        </h2>
        <div className="grid gap-2">
          {rows.map((a) => (
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
          {rows.length === 0 && (
            <p className="rounded-lg border border-dashed border-line px-2 py-6 text-center text-[12px] text-faint">{q ? "No matches" : "Empty"}</p>
          )}
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name or area" className="h-8 pl-8 text-[13px]" aria-label="Filter accounts" />
        </div>
        {/* Phones: one step at a time. */}
        <Chips
          className="-mx-4 flex-nowrap overflow-x-auto px-4 md:hidden"
          size="sm"
          options={FLOW.map((k) => ({ key: k, label: `${label(k)} ${columns[k].length}` }))}
          value={mobile}
          onChange={setMobile}
        />
      </div>

      {/* Wide screens: Lead | the opportunity steps | Invoicing, scrolling sideways when needed. */}
      <div className="relative">
        <div
          ref={scroller}
          onScroll={checkEdges}
          className="md:-mx-2 md:flex md:gap-4 md:overflow-x-auto md:px-2 md:pb-4"
        >
          {GROUPS.map((g) => {
            const opp = g.phase === "Opportunity";
            return (
              <div key={g.phase} className={cn("md:shrink-0 md:pt-2", opp && "md:rounded-xl md:bg-subtle/60 md:px-3")}>
                {/* Only the opportunity needs a group label; the others keep the space so headers line up. */}
                <p className={cn("mb-2 hidden text-[11px] font-medium uppercase tracking-[0.08em] text-accent-text md:block", !opp && "invisible")}>
                  {g.phase}
                </p>
                <div className="md:flex md:gap-3">{g.stages.map((s) => column(s))}</div>
              </div>
            );
          })}
        </div>
        {/* A soft edge where more steps sit off-screen. */}
        {edges.right && <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 -right-2 hidden w-16 bg-linear-to-l from-bg to-transparent md:block" />}
        {edges.left && <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 -left-2 hidden w-16 bg-linear-to-r from-bg to-transparent md:block" />}
      </div>

      {others > 0 && (
        <button onClick={onShowOthers} className="mt-6 text-[13px] text-muted hover:text-fg">
          {others} parked as Not now · show in list
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
        ) : a.status === "invoicing" ? (
          <p className="text-muted">Nothing planned</p>
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
