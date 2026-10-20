import { useEffect, useMemo, useRef, useState } from "react";
import type { AccountRow } from "@shared/model";
import { api, DATA_CHANGED } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

let cache: Promise<AccountRow[]> | null = null;
if (typeof window !== "undefined") window.addEventListener(DATA_CHANGED, () => (cache = null));

export function useAccounts(): AccountRow[] {
  const [list, setList] = useState<AccountRow[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () => {
      cache ??= api<AccountRow[]>("/accounts");
      cache.then((l) => alive && setList(l)).catch(() => {});
    };
    load();
    window.addEventListener(DATA_CHANGED, load);
    return () => {
      alive = false;
      window.removeEventListener(DATA_CHANGED, load);
    };
  }, []);
  return list;
}

export interface PickedAccount {
  id: string;
  name: string;
}

/** Type-ahead account field. */
export function AccountPicker({
  value,
  onChange,
  placeholder = "Account",
  autoFocus,
}: {
  value: PickedAccount | null;
  onChange: (v: PickedAccount | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const accounts = useAccounts();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = t
      ? accounts.filter((a) => a.name.toLowerCase().includes(t) || (a.office_submarket ?? "").toLowerCase().includes(t))
      : accounts;
    return list.slice(0, 8);
  }, [accounts, q]);

  if (value) {
    return (
      <div className="flex h-9 items-center justify-between rounded-md border border-line-strong bg-subtle px-3 text-sm">
        <span className="truncate font-medium">{value.name}</span>
        <button
          type="button"
          className="-mr-1 rounded p-1 text-faint hover:text-fg"
          onClick={() => {
            onChange(null);
            setTimeout(() => input.current?.focus(), 0);
          }}
          aria-label="Clear account"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  const pick = (a: AccountRow | undefined) => {
    if (!a) return;
    onChange({ id: a.id, name: a.name });
    setQ("");
    setOpen(false);
  };

  return (
    <div className="relative">
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
          {matches.length === 0 && <li className="px-2.5 py-2 text-sm text-muted">No account matches “{q}”.</li>}
          {matches.map((a, i) => (
            <li
              key={a.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(a);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-baseline justify-between gap-3 rounded-md px-2.5 py-1.5 text-sm", i === active && "bg-hover")}
            >
              <span className="truncate">{a.name}</span>
              <span className="shrink-0 text-xs text-faint">{a.office_submarket || a.office_city}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
