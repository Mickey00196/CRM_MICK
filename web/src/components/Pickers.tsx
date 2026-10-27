import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { projectStageLabel, type AccountRow, type ProjectRow } from "@shared/model";
import { api, DATA_CHANGED } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface Picked {
  id: string;
  name: string;
}
export type PickedAccount = Picked;
export type PickedProject = Picked & { account_id?: string | null; account_name?: string | null };

/** A list shared by every picker on screen, refreshed after any change. */
function useShared<T>(path: string): T[] {
  const store = useRef((shared[path] ??= { promise: null }) as { promise: Promise<T[]> | null }).current;
  const [list, setList] = useState<T[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () => {
      store.promise ??= api<T[]>(path);
      store.promise.then((l) => alive && setList(l)).catch(() => {});
    };
    const invalidate = () => {
      store.promise = null;
      load();
    };
    load();
    window.addEventListener(DATA_CHANGED, invalidate);
    return () => {
      alive = false;
      window.removeEventListener(DATA_CHANGED, invalidate);
    };
  }, [path, store]);
  return list;
}
const shared: Record<string, { promise: Promise<unknown[]> | null }> = {};

export const useAccounts = () => useShared<AccountRow>("/accounts");
export const useProjects = () => useShared<ProjectRow>("/projects");

interface Item {
  id: string;
  name: string;
  sub?: string | null;
}

function Picker<T extends Item>({
  items,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  items: T[];
  value: Picked | null;
  onChange: (v: T | null) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (t ? items.filter((i) => i.name.toLowerCase().includes(t) || (i.sub ?? "").toLowerCase().includes(t)) : items).slice(0, 8);
  }, [items, q]);

  if (value) {
    return (
      <div className="flex h-9 min-w-0 items-center justify-between rounded-md border border-line-strong bg-subtle px-3 text-sm">
        <span className="truncate font-medium">{value.name}</span>
        <button
          type="button"
          className="-mr-1 rounded p-1 text-faint hover:text-fg"
          onClick={() => {
            onChange(null);
            setTimeout(() => input.current?.focus(), 0);
          }}
          aria-label={`Clear ${placeholder.toLowerCase()}`}
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  const pick = (i: T | undefined) => {
    if (!i) return;
    onChange(i);
    setQ("");
    setOpen(false);
  };

  return (
    <div className="relative min-w-0">
      <Input
        ref={input}
        value={q}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && open && matches.length) {
            e.preventDefault();
            pick(matches[active]);
          }
        }}
        role="combobox"
        aria-expanded={open}
        aria-label={placeholder}
      />
      {open && (
        <ul className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-lg" role="listbox">
          {matches.length === 0 && <li className="px-2.5 py-2 text-sm text-muted">{q ? `Nothing matches “${q}”.` : "Nothing here yet."}</li>}
          {matches.map((i, n) => (
            <li
              key={i.id}
              role="option"
              aria-selected={n === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(i);
              }}
              onMouseEnter={() => setActive(n)}
              className={cn("flex cursor-pointer items-baseline justify-between gap-3 rounded-md px-2.5 py-1.5 text-sm", n === active && "bg-hover")}
            >
              <span className="truncate">{i.name}</span>
              {i.sub && <span className="shrink-0 text-xs text-faint">{i.sub}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AccountPicker({
  value,
  onChange,
  placeholder = "Company",
  autoFocus,
}: {
  value: PickedAccount | null;
  onChange: (v: PickedAccount | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const accounts = useAccounts();
  const items = useMemo(() => accounts.map((a) => ({ id: a.id, name: a.name, sub: a.office_submarket || a.office_city })), [accounts]);
  return <Picker items={items} value={value} onChange={(i) => onChange(i ? { id: i.id, name: i.name } : null)} placeholder={placeholder} autoFocus={autoFocus} />;
}

/** Open projects only (done ones drop out of the list). */
export function ProjectPicker({
  value,
  onChange,
  placeholder = "Project",
  autoFocus,
}: {
  value: PickedProject | null;
  onChange: (v: PickedProject | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const projects = useProjects();
  const items = useMemo(
    () =>
      projects
        .filter((p) => p.stage !== "done")
        .map((p) => ({ id: p.id, name: p.name, sub: p.account_name ?? projectStageLabel(p.stage), account_id: p.account_id, account_name: p.account_name })),
    [projects],
  );
  return (
    <Picker
      items={items}
      value={value}
      onChange={(i) => onChange(i ? { id: i.id, name: i.name, account_id: i.account_id, account_name: i.account_name } : null)}
      placeholder={placeholder}
      autoFocus={autoFocus}
    />
  );
}
