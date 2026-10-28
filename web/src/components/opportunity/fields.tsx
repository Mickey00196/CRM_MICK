import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ExternalLink, Pencil } from "lucide-react";
import type { FieldDef } from "@shared/opportunity";
import { dmy, money, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Input, Select, Textarea } from "@/components/ui/input";
import { toast } from "../Toast";

export type Value = string | number | boolean | null | undefined;
/** Saves one field and resolves with the value as stored. */
export type SaveField = (key: string, value: unknown) => Promise<Value>;

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const empty = (v: Value) => v === null || v === undefined || v === "";

/** "€ 425 /m²/yr", "1.200 m²", "01-09-2027", "Relocation". */
export function formatValue(def: FieldDef, v: Value): string {
  if (empty(v)) return "";
  switch (def.type) {
    case "money": {
      const s = money(Number(v));
      return def.unit && def.unit !== "€" ? `${s} ${def.unit.replace(/^€/, "")}` : s;
    }
    case "number":
      return `${num(Number(v))}${def.unit ? ` ${def.unit}` : ""}`;
    case "date":
      return dmy(String(v));
    case "bool":
      return v ? "Yes" : "No";
    case "select":
      return def.options?.find((o) => o.key === v)?.label ?? String(v);
    case "url":
      return hostOf(String(v));
    default:
      return String(v);
  }
}

const toDraft = (v: Value) => (empty(v) ? "" : String(v));

/**
 * A value that reads like text and turns into an input when clicked. Saves on Enter or when you
 * click away; Escape cancels. Long text saves with ⌘↵. Yes/no fields are a switch.
 */
export function Editable({
  def,
  value,
  onSave,
  className,
  align = "left",
  placeholder = "–",
}: {
  def: FieldDef;
  value: Value;
  onSave: (v: unknown) => Promise<Value>;
  className?: string;
  align?: "left" | "right";
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  // What we just saved, shown until the page has reloaded with it.
  const [saved, setSaved] = useState<{ v: Value } | null>(null);
  const done = useRef(false);
  useEffect(() => setSaved(null), [value]);
  const shown = saved ? saved.v : value;

  async function save(v: unknown) {
    try {
      const stored = await onSave(v);
      setSaved({ v: stored });
      return true;
    } catch (e) {
      toast((e as Error).message);
      return false;
    }
  }

  function start() {
    done.current = false;
    setDraft(toDraft(shown));
    setEditing(true);
  }

  async function commit(raw = draft) {
    if (done.current) return;
    done.current = true;
    const next = raw.trim();
    if (next === toDraft(shown)) return setEditing(false);
    if (await save(next === "" ? null : next)) setEditing(false);
    else done.current = false;
  }

  const box = cn("-mx-2 w-[calc(100%+1rem)] rounded-md px-2", align === "right" ? "text-right" : "text-left", className);

  if (def.type === "bool") {
    const on = shown === true;
    return (
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => save(!on)}
        className={cn("inline-flex h-8 items-center gap-2 text-sm", className)}
      >
        <span className={cn("relative h-5 w-9 rounded-full transition-colors", on ? "bg-accent" : "bg-line-strong")}>
          <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left]", on ? "left-[18px]" : "left-0.5")} />
        </span>
        <span className={on ? "" : "text-muted"}>{on ? "Yes" : "No"}</span>
      </button>
    );
  }

  if (editing) {
    const common = {
      autoFocus: true,
      "aria-label": def.label,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          done.current = true;
          setEditing(false);
        } else if (e.key === "Enter" && (def.type !== "longtext" || e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          commit();
        }
      },
      onBlur: () => commit(),
    };
    if (def.type === "select")
      return (
        <Select
          {...common}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            commit(e.target.value);
          }}
          className={cn("h-8", className)}
        >
          <option value="">–</option>
          {def.options?.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </Select>
      );
    if (def.type === "longtext")
      return <Textarea {...common} rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={def.placeholder} className={cn("text-sm", className)} />;
    return (
      <Input
        {...common}
        type={def.type === "date" ? "date" : "text"}
        inputMode={def.type === "number" || def.type === "money" ? "decimal" : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={def.placeholder ?? (def.unit ? def.unit : undefined)}
        className={cn("h-8", align === "right" && "text-right", className)}
      />
    );
  }

  const text = formatValue(def, shown);
  if (def.type === "url" && text)
    return (
      <span className={cn(box, "group flex min-h-8 items-center gap-1.5")}>
        <a href={String(shown)} target="_blank" rel="noreferrer noopener" className="inline-flex min-w-0 items-center gap-1 text-sm text-accent-text hover:underline">
          <span className="truncate">{text}</span>
          <ExternalLink className="size-3 shrink-0" />
        </a>
        <button type="button" onClick={start} aria-label={`Edit ${def.label}`} className="rounded p-1 text-faint opacity-0 hover:text-fg group-hover:opacity-100 focus:opacity-100">
          <Pencil className="size-3" />
        </button>
      </span>
    );
  return (
    <button
      type="button"
      onClick={start}
      title={`Edit ${def.label}`}
      className={cn(
        box,
        "flex min-h-8 items-center text-sm transition-colors hover:bg-hover",
        align === "right" && "justify-end",
        def.type === "longtext" && text && "items-start whitespace-pre-wrap py-1.5 leading-relaxed",
        !text && "text-faint",
      )}
    >
      <span className={cn("min-w-0", def.type !== "longtext" && "truncate", (def.type === "number" || def.type === "money") && "num")}>{text || placeholder}</span>
    </button>
  );
}

/** Label above, editable value below. */
export function PropertyField({ def, value, onSave, className }: { def: FieldDef; value: Value; onSave: SaveField; className?: string }) {
  return (
    <div className={cn("min-w-0", def.wide && (def.type === "longtext" ? "col-span-full" : "col-span-2"), className)}>
      <p className="mb-0.5 text-[13px] text-muted">{def.label}</p>
      <Editable def={def} value={value} onSave={(v) => onSave(def.key, v)} />
    </div>
  );
}

export function FieldGrid({ defs, values, onSave, className }: { defs: FieldDef[]; values: Record<string, Value>; onSave: SaveField; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-x-6 gap-y-3 @2xl:grid-cols-3", className)}>
      {defs.map((d) => (
        <PropertyField key={d.key} def={d} value={values[d.key]} onSave={onSave} />
      ))}
    </div>
  );
}

/** What a stage needs before you move on, as a row of ticks. */
export function Checklist({ checks }: { checks: { label: string; done: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Checklist">
      {checks.map((c) => (
        <li
          key={c.label}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px]",
            c.done ? "border-accent/25 bg-accent-soft text-accent-text" : "border-dashed border-line-strong text-muted",
          )}
        >
          {c.done ? <Check className="size-3" strokeWidth={3} /> : <span className="size-2.5 rounded-full border border-current opacity-60" />}
          {c.label}
          <span className="sr-only">{c.done ? "(done)" : "(to do)"}</span>
        </li>
      ))}
    </ul>
  );
}

/** A small caps heading inside a card. */
export function SubHead({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between gap-3 first:mt-0">
      <h3 className="label text-[10.5px]">{children}</h3>
      {action}
    </div>
  );
}
