import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, Building2, Columns3, Download, KanbanSquare, List, Plus, Search } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { ACCOUNT_STATUSES, accountStatusLabel, type AccountRow } from "@shared/model";
import { api, useApi, useStored } from "@/lib/api";
import { dmy, m2, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Menu, MenuCheckbox, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/dropdown";
import { useUI } from "@/components/ui-context";
import { dueLabel } from "@/components/TodoItem";
import { Skeleton } from "@/components/Skeleton";
import { AccountsBoard } from "./AccountsBoard";

type ColKey = "status" | "location" | "size" | "lease_end" | "next_step" | "last_contact" | "industry" | "source";

const COLUMNS: { key: ColKey; label: string; sort: (a: AccountRow) => string | number | null; className?: string }[] = [
  { key: "status", label: "Status", sort: (a) => ACCOUNT_STATUSES.findIndex((s) => s.key === a.status) },
  { key: "location", label: "Office", sort: (a) => (a.office_submarket || a.office_city || "").toLowerCase() || null },
  { key: "size", label: "m²", sort: (a) => a.area_m2, className: "text-right" },
  { key: "lease_end", label: "Lease end", sort: (a) => a.lease_end },
  { key: "next_step", label: "Next follow-up", sort: (a) => a.next_step?.due_date ?? null },
  { key: "last_contact", label: "Last contact", sort: (a) => a.last_contact_at },
  { key: "industry", label: "Industry", sort: (a) => a.industry.toLowerCase() || null },
  { key: "source", label: "Source", sort: (a) => a.lead_source.toLowerCase() || null },
];

const DEFAULT_COLS: ColKey[] = ["status", "location", "size", "lease_end", "next_step", "last_contact"];

const VIEWS = [
  { key: "lead", label: "Leads", match: (a: AccountRow) => a.status === "lead" },
  { key: "prospect", label: "Prospects", match: (a: AccountRow) => a.status === "prospect" },
  { key: "client", label: "Clients", match: (a: AccountRow) => a.status === "client" },
  { key: "other", label: "Former / not a fit", match: (a: AccountRow) => a.status === "former_client" || a.status === "not_a_fit" },
  { key: "all", label: "All", match: (_a: AccountRow) => true },
];

interface SavedView {
  name: string;
  view: string;
  q: string;
  sort: { key: string; dir: 1 | -1 };
}

/** Accounts: the companies you're working. A board by status (default) or a sortable list. */
export function Accounts() {
  const { data, error, setData } = useApi<AccountRow[]>("/accounts");
  const [mode, setMode] = useStored<"board" | "list">("accounts-mode", "board");
  const [view, setView] = useStored("accounts-view", "all");
  const ui = useUI();

  return (
    <div className={cn("mx-auto", mode === "board" ? "max-w-7xl" : "max-w-6xl")}>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="title text-2xl">Accounts</h1>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-line bg-subtle p-0.5" role="radiogroup" aria-label="View">
            {(
              [
                ["board", "Board", KanbanSquare],
                ["list", "List", List],
              ] as const
            ).map(([k, label, Icon]) => (
              <button
                key={k}
                role="radio"
                aria-checked={mode === k}
                onClick={() => setMode(k)}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] transition-colors",
                  mode === k ? "bg-surface font-medium text-fg shadow-sm" : "text-muted hover:text-fg",
                )}
              >
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => ui.openCapture("account")} title="New account">
            <Plus /> New account
          </Button>
        </div>
      </header>

      {error && <p className="text-sm text-late">{error}</p>}
      {!data && !error && <Skeleton title={false} rows={5} className="max-w-none" />}
      {data && data.length === 0 && (
        <EmptyState
          icon={Building2}
          title="No accounts yet"
          text="An account is a company you're chasing or working for, like a scale-up in Amsterdam you want as a client. Plan a follow-up date on each one and it lands in your to-dos."
        >
          <Button size="lg" onClick={() => ui.openCapture("account")}>
            <Plus /> New account
          </Button>
        </EmptyState>
      )}
      {data && data.length > 0 &&
        (mode === "board" ? (
          <AccountsBoard
            data={data}
            setData={setData}
            onShowOthers={() => {
              setView("other");
              setMode("list");
            }}
          />
        ) : (
          <AccountsList data={data} view={view} setView={setView} />
        ))}
    </div>
  );
}

function AccountsList({ data, view, setView }: { data: AccountRow[]; view: string; setView: (v: string) => void }) {
  const [cols, setCols] = useStored<ColKey[]>("accounts-cols", DEFAULT_COLS);
  const [sort, setSort] = useStored<{ key: string; dir: 1 | -1 }>("accounts-sort", { key: "name", dir: 1 });
  const [saved, setSaved] = useStored<SavedView[]>("accounts-saved-views", []);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const ui = useUI();
  const today = todayISO();

  const rows = useMemo(() => {
    const v = VIEWS.find((x) => x.key === view) ?? VIEWS[VIEWS.length - 1];
    const t = q.trim().toLowerCase();
    const filtered = data.filter(
      (a) =>
        v.match(a) &&
        (!t ||
          [a.name, a.office_city, a.office_submarket, a.office_building, a.industry, a.lead_source, ...(a.tags ?? [])]
            .filter(Boolean)
            .some((s) => s!.toLowerCase().includes(t))),
    );
    const col = COLUMNS.find((c) => c.key === sort.key);
    const get = col ? col.sort : (a: AccountRow) => a.name.toLowerCase();
    return [...filtered].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (x === y) return a.name.localeCompare(b.name);
      if (x === null) return 1;
      if (y === null) return -1;
      return (x < y ? -1 : 1) * sort.dir;
    });
  }, [data, view, q, sort]);

  const counts = useMemo(() => Object.fromEntries(VIEWS.map((v) => [v.key, data.filter(v.match).length])), [data]);

  function toggleSort(key: string) {
    setSort(sort.key === key ? { key, dir: sort.dir === 1 ? -1 : 1 } : { key, dir: 1 });
  }

  async function bulk(body: Record<string, unknown>) {
    if (body.action === "archive" && !confirm(`Archive ${selected.size} account${selected.size === 1 ? "" : "s"}?`)) return;
    await api("/accounts/bulk", "POST", { ids: [...selected], ...body });
    setSelected(new Set());
  }

  function saveView() {
    const name = prompt("Name this view");
    if (!name?.trim()) return;
    setSaved([...saved.filter((s) => s.name !== name.trim()), { name: name.trim(), view, q, sort }]);
  }

  const shown = COLUMNS.filter((c) => cols.includes(c.key));
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-line">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={cn(
              "-mb-px border-b-2 pb-2.5 text-sm transition-colors",
              view === v.key ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {v.label} <span className="text-faint">{counts[v.key]}</span>
          </button>
        ))}
        {saved.map((s) => (
          <button
            key={s.name}
            onClick={() => {
              setView(s.view);
              setQ(s.q);
              setSort(s.sort);
            }}
            className="-mb-px border-b-2 border-transparent pb-2.5 text-sm text-muted hover:text-fg"
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name, area, tag…" className="h-8 pl-8 text-[13px]" />
        </div>
        {selected.size > 0 ? (
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-muted">{selected.size} selected</span>
            <Menu>
              <MenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Set status
                </Button>
              </MenuTrigger>
              <MenuContent>
                {ACCOUNT_STATUSES.map((s) => (
                  <MenuItem key={s.key} onSelect={() => bulk({ action: "status", status: s.key })}>
                    {s.label}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
            <Button variant="outline" size="sm" onClick={() => bulk({ action: "archive" })}>
              Archive
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        ) : (
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={saveView}>
              Save view
            </Button>
            <Menu>
              <MenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Columns3 /> Columns
                </Button>
              </MenuTrigger>
              <MenuContent align="end">
                <MenuLabel>Show columns</MenuLabel>
                {COLUMNS.map((c) => (
                  <MenuCheckbox
                    key={c.key}
                    checked={cols.includes(c.key)}
                    onChange={(on) => setCols(on ? COLUMNS.map((x) => x.key).filter((k) => k === c.key || cols.includes(k)) : cols.filter((k) => k !== c.key))}
                  >
                    {c.label}
                  </MenuCheckbox>
                ))}
                {saved.length > 0 && (
                  <>
                    <MenuSeparator />
                    <MenuLabel>Saved views</MenuLabel>
                    {saved.map((s) => (
                      <MenuItem key={s.name} onSelect={() => setSaved(saved.filter((x) => x.name !== s.name))}>
                        Remove “{s.name}”
                      </MenuItem>
                    ))}
                  </>
                )}
              </MenuContent>
            </Menu>
            <Button variant="ghost" size="sm" asChild>
              <a href="/api/accounts/export.csv" download>
                <Download /> CSV
              </a>
            </Button>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="py-12 text-center text-muted">No accounts match this view.</p>
      ) : (
        <>
        {/* Phones: a simple list instead of a wide table. */}
        <ul className="sm:hidden">
          {rows.map((a) => {
            const late = a.next_step?.due_date && a.next_step.due_date < today;
            return (
              <li key={a.id} className="border-b border-line">
                <Link to={`/accounts/${a.id}`} className="block py-3">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-medium">{a.name}</span>
                    <span className="shrink-0 text-[13px] text-muted">{accountStatusLabel(a.status)}</span>
                  </span>
                  <span className={cn("mt-0.5 block truncate text-[13px]", late ? "text-late" : "text-muted")}>
                    {a.next_step ? `${a.next_step.title}${a.next_step.due_date ? ` · ${dueLabel(a.next_step.due_date, null, today)}` : ""}` : "No follow-up"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="-mx-4 hidden overflow-x-auto px-4 sm:mx-0 sm:block sm:px-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[13px] text-muted">
                <th className="w-8 py-2 pr-2 font-normal">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--accent)]"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                    aria-label="Select all"
                  />
                </th>
                <SortHeader label="Account" k="name" sort={sort} onSort={toggleSort} />
                {shown.map((c) => (
                  <SortHeader key={c.key} label={c.label} k={c.key} sort={sort} onSort={toggleSort} className={c.className} />
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => navigate(`/accounts/${a.id}`)}
                  className={cn("cursor-pointer border-b border-line transition-colors hover:bg-hover/60", selected.has(a.id) && "bg-hover/60")}
                >
                  <td className="py-3 pr-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--accent)]"
                      checked={selected.has(a.id)}
                      onChange={() => {
                        const s = new Set(selected);
                        s.has(a.id) ? s.delete(a.id) : s.add(a.id);
                        setSelected(s);
                      }}
                      aria-label={`Select ${a.name}`}
                    />
                  </td>
                  <td className="py-3 pr-4 font-medium">{a.name}</td>
                  {shown.map((c) => (
                    <td key={c.key} className={cn("py-3 pr-4 text-muted", c.className)}>
                      <Cell row={a} col={c.key} today={today} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </>
  );
}

function SortHeader({
  label,
  k,
  sort,
  onSort,
  className,
}: {
  label: string;
  k: string;
  sort: { key: string; dir: 1 | -1 };
  onSort: (k: string) => void;
  className?: string;
}) {
  const active = sort.key === k;
  return (
    <th className={cn("py-2 pr-4 font-normal", className)} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
      <button onClick={() => onSort(k)} className={cn("inline-flex items-center gap-1 hover:text-fg", active && "text-fg")}>
        {label}
        {active && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );
}

function Cell({ row: a, col, today }: { row: AccountRow; col: ColKey; today: string }) {
  switch (col) {
    case "status":
      return <>{accountStatusLabel(a.status)}</>;
    case "location":
      return <>{[a.office_submarket, a.office_city].filter(Boolean).join(", ")}</>;
    case "size":
      return <>{m2(a.area_m2)}</>;
    case "lease_end":
      return <>{dmy(a.lease_end)}</>;
    case "next_step": {
      if (!a.next_step) {
        return <span className="text-faint">–</span>;
      }
      const late = a.next_step.due_date && a.next_step.due_date < today;
      return (
        <span className={cn("block max-w-56 truncate", late ? "text-late" : "text-fg")}>
          {a.next_step.title}
          {a.next_step.due_date && <span className={late ? "" : "text-muted"}> · {dueLabel(a.next_step.due_date, null, today)}</span>}
        </span>
      );
    }
    case "last_contact":
      return <>{dmy(a.last_contact_at)}</>;
    case "industry":
      return <>{a.industry}</>;
    case "source":
      return <>{a.lead_source}</>;
  }
}
