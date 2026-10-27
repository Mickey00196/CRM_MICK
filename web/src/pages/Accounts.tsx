import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, Columns3, Download, Plus, Search } from "lucide-react";
import { ACCOUNT_STATUSES, accountStatusLabel, type AccountRow } from "@shared/model";
import { api, useApi, useStored } from "@/lib/api";
import { dmy, m2, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Menu, MenuCheckbox, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/dropdown";
import { useUI } from "@/components/ui-context";
import { Avatar } from "@/components/Avatar";
import { PageHeader } from "@/components/Panel";

type ColKey = "status" | "location" | "size" | "lease_end" | "next_step" | "last_contact" | "industry" | "source";

const COLUMNS: { key: ColKey; label: string; sort: (a: AccountRow) => string | number | null; className?: string }[] = [
  { key: "status", label: "Status", sort: (a) => ACCOUNT_STATUSES.findIndex((s) => s.key === a.status) },
  { key: "location", label: "Office", sort: (a) => (a.office_submarket || a.office_city || "").toLowerCase() || null },
  { key: "size", label: "m²", sort: (a) => a.area_m2, className: "text-right" },
  { key: "lease_end", label: "Lease end", sort: (a) => a.lease_end },
  { key: "next_step", label: "Next step", sort: (a) => a.next_step?.due_date ?? null },
  { key: "last_contact", label: "Last contact", sort: (a) => a.last_contact_at },
  { key: "industry", label: "Industry", sort: (a) => a.industry.toLowerCase() || null },
  { key: "source", label: "Source", sort: (a) => a.lead_source.toLowerCase() || null },
];

const DEFAULT_COLS: ColKey[] = ["status", "location", "size", "lease_end", "next_step", "last_contact"];

const VIEWS = [
  { key: "lead", label: "Leads", match: (a: AccountRow) => a.status === "lead" },
  { key: "prospect", label: "Prospects", match: (a: AccountRow) => a.status === "prospect" },
  { key: "client", label: "Clients", match: (a: AccountRow) => a.status === "client" },
  { key: "all", label: "All", match: (_a: AccountRow) => true },
];

interface SavedView {
  name: string;
  view: string;
  q: string;
  sort: { key: string; dir: 1 | -1 };
}

export function Accounts() {
  const { data, error } = useApi<AccountRow[]>("/accounts");
  const [view, setView] = useStored("accounts-view", "all");
  const [cols, setCols] = useStored<ColKey[]>("accounts-cols", DEFAULT_COLS);
  const [sort, setSort] = useStored<{ key: string; dir: 1 | -1 }>("accounts-sort", { key: "name", dir: 1 });
  const [saved, setSaved] = useStored<SavedView[]>("accounts-saved-views", []);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const ui = useUI();
  const today = todayISO();

  const rows = useMemo(() => {
    if (!data) return [];
    const v = VIEWS.find((x) => x.key === view) ?? VIEWS[3];
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

  const counts = useMemo(() => Object.fromEntries(VIEWS.map((v) => [v.key, data?.filter(v.match).length ?? 0])), [data]);

  function toggleSort(key: string) {
    setSort(sort.key === key ? { key, dir: sort.dir === 1 ? -1 : 1 } : { key, dir: 1 });
  }

  async function bulk(body: Record<string, unknown>) {
    if (body.action === "archive" && !confirm(`Archive ${selected.size} compan${selected.size === 1 ? "y" : "ies"}?`)) return;
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
    <div className="rise mx-auto max-w-6xl">
      <PageHeader
        title="Companies"
        subtitle="The clients and prospects behind your projects."
        actions={
          <Button onClick={() => ui.openCapture("account")}>
            <Plus /> New Company
          </Button>
        }
      />

      <div className="mb-4 max-w-full overflow-x-auto">
        <div className="segmented" role="radiogroup" aria-label="View">
          {VIEWS.map((v) => (
            <button key={v.key} role="radio" aria-checked={view === v.key} onClick={() => setView(v.key)}>
              {v.label} <span className="text-[12px] font-medium tabular-nums text-faint">{counts[v.key]}</span>
            </button>
          ))}
          {saved.map((s) => (
            <button
              key={s.name}
              role="radio"
              aria-checked={false}
              onClick={() => {
                setView(s.view);
                setQ(s.q);
                setSort(s.sort);
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, area, tag" className="h-9 pl-8" />
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

      {error && <p className="text-sm text-late">{error}</p>}

      {data && rows.length === 0 ? (
        <p className="card py-12 text-center text-muted">
          {data.length === 0 ? "No companies yet. Add one when a project involves a client or prospect." : "No companies match this view."}
        </p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="data min-w-[760px]">
            <thead>
              <tr>
                <th className="w-8 !pr-0">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--accent)]"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                    aria-label="Select all"
                  />
                </th>
                <SortHeader label="Company" k="name" sort={sort} onSort={toggleSort} />
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
                  className={cn("cursor-pointer", selected.has(a.id) && "bg-accent-soft/50")}
                >
                  <td className="!pr-0" onClick={(e) => e.stopPropagation()}>
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
                  <td>
                    <span className="flex items-center gap-2.5">
                      <Avatar name={a.name} size="md" />
                      <span className="font-medium">{a.name}</span>
                    </span>
                  </td>
                  {shown.map((c) => (
                    <td key={c.key} className={cn("text-muted", c.className)}>
                      <Cell row={a} col={c.key} today={today} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
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
    <th className={className} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
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
      return (
        <span
          className={cn(
            "inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold",
            a.status === "client" ? "bg-green-soft text-green-text" : a.status === "prospect" ? "bg-accent-soft text-accent" : "bg-subtle text-muted",
          )}
        >
          {accountStatusLabel(a.status)}
        </span>
      );
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
        <span className={cn("block max-w-56 truncate", late ? "text-late-text" : "text-fg")}>
          {a.next_step.title}
          {a.next_step.due_date && <span className={late ? "" : "text-muted"}> · {dmy(a.next_step.due_date)}</span>}
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
