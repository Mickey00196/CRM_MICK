import { TASK_TYPES, taskTypeLabel, type NextStepSuggestion, type TaskType } from "@shared/model";
import { addDays, dmy, todayISO, workday } from "@/lib/format";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type NextMode = "new" | "none" | "keep";

export interface NextStepValue {
  mode: NextMode;
  type: TaskType;
  title: string;
  due_date: string;
  due_time: string;
}

export function nextFromSuggestion(s: NextStepSuggestion | null, fallback: Partial<NextStepValue> = {}): NextStepValue {
  return {
    mode: "new",
    type: s?.type ?? fallback.type ?? "call",
    title: s?.title ?? fallback.title ?? "Follow up",
    due_date: workday(addDays(todayISO(), s?.days ?? 2)),
    due_time: "",
  };
}

/** Body for the API's `next` field, or null. */
export function nextPayload(v: NextStepValue) {
  if (v.mode !== "new" || !v.title.trim()) return null;
  return { type: v.type, title: v.title.trim(), due_date: v.due_date || null, due_time: v.due_time || null };
}

const PRESETS = [
  { label: "Tomorrow", days: 1 },
  { label: "2 days", days: 2 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "1 month", days: 30 },
  { label: "6 months", days: 182 },
];

export function NextStepPicker({
  value,
  onChange,
  existing,
  noneHint,
  label = "Next step",
}: {
  value: NextStepValue;
  onChange: (v: NextStepValue) => void;
  /** An open next step already on the account; offers to keep it. */
  existing?: { title: string; type: string; due_date: string | null } | null;
  /** Shown when "No next step" is chosen. */
  noneHint?: string;
  label?: string;
}) {
  const set = (patch: Partial<NextStepValue>) => onChange({ ...value, ...patch });
  const today = todayISO();

  if (value.mode !== "new") {
    return (
      <div className="grid gap-1.5">
        <span className="text-[13px] text-muted">{label}</span>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
          {value.mode === "keep" && existing ? (
            <span>
              Keep <span className="font-medium">{existing.title}</span>
              <span className="text-muted">
                {" "}
                · {taskTypeLabel(existing.type)}
                {existing.due_date && ` · ${dmy(existing.due_date)}`}
              </span>
            </span>
          ) : (
            <span className="text-missing">None{noneHint ? ` · ${noneHint}` : ""}</span>
          )}
          <button type="button" className="text-accent hover:underline" onClick={() => set({ mode: "new" })}>
            {value.mode === "keep" ? "Add another" : "Add one"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-muted">{label}</span>
        <div className="flex gap-3 text-[13px]">
          {existing && (
            <button type="button" className="text-muted hover:text-fg" onClick={() => set({ mode: "keep" })}>
              Keep current
            </button>
          )}
          <button type="button" className="text-muted hover:text-fg" onClick={() => set({ mode: "none" })}>
            Skip
          </button>
        </div>
      </div>
      <div className="flex gap-2">
        <Select
          className="w-32 shrink-0"
          value={value.type}
          onChange={(e) => set({ type: e.target.value as TaskType })}
          aria-label="Next step type"
        >
          {TASK_TYPES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </Select>
        <Input value={value.title} onChange={(e) => set({ title: e.target.value })} aria-label="Next step" placeholder="What's next?" />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((p) => {
          const d = workday(addDays(today, p.days));
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => set({ due_date: d })}
              className={cn(
                "h-7 rounded-full border px-2.5 text-[13px] transition-colors",
                value.due_date === d ? "border-accent bg-accent text-accent-fg" : "border-line-strong text-muted hover:text-fg",
              )}
            >
              {p.label}
            </button>
          );
        })}
        <Input
          type="date"
          className="h-7 w-auto px-2 text-[13px]"
          value={value.due_date}
          onChange={(e) => set({ due_date: e.target.value })}
          aria-label="Next step date"
        />
        <Input
          type="time"
          className="h-7 w-auto px-2 text-[13px]"
          value={value.due_time}
          onChange={(e) => set({ due_time: e.target.value })}
          aria-label="Time (optional)"
        />
      </div>
    </div>
  );
}
