import { Check, Eye, Link2, Mail, Phone, Users } from "lucide-react";
import { channelForTaskType, taskTypeLabel, type ProjectStage, type TaskType } from "@shared/model";
import { api } from "@/lib/api";
import { daysBetween, dmy, relative, todayISO, weekday } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TASK_DONE, useUI } from "./ui-context";
import { toast } from "./Toast";
import { StageDot } from "./Stage";

export interface TodoLike {
  id: string;
  title: string;
  type: TaskType;
  due_date: string | null;
  due_time: string | null;
}

const TYPE_ICON: Partial<Record<TaskType, typeof Phone>> = {
  call: Phone,
  email: Mail,
  linkedin: Link2,
  meeting: Users,
  viewing: Eye,
};

/**
 * Plain to-dos complete in one click (with Undo). Calls, emails, meetings and viewings
 * open "How did it go?" so the outcome gets logged.
 */
export function useComplete() {
  const ui = useUI();
  return async (t: TodoLike) => {
    if (channelForTaskType(t.type)) return ui.openTask(t.id, "complete");
    window.dispatchEvent(new CustomEvent(TASK_DONE, { detail: t.id }));
    try {
      await api(`/tasks/${t.id}/complete`, "POST", {});
      toast(`Done: ${t.title}`, { label: "Undo", run: () => void api(`/tasks/${t.id}/reopen`, "POST") });
    } catch (e) {
      toast((e as Error).message);
    }
  };
}

export function dueLabel(due: string | null, time: string | null, today = todayISO()): string {
  if (!due) return "";
  if (due === today) return time ?? "Today";
  const d = daysBetween(today, due);
  if (d === 1) return time ? `Tomorrow ${time}` : "Tomorrow";
  if (d > 1 && d < 7) {
    const day = weekday(due);
    return time ? `${day} ${time}` : day;
  }
  return dmy(due);
}

/** "1 day late", "5 days late", "3 weeks late". */
function lateLabel(due: string, today: string): string {
  const d = daysBetween(due, today);
  if (d < 14) return `${d} day${d === 1 ? "" : "s"} late`;
  return relative(due, today).replace(" ago", " late");
}

/**
 * Due date as a small pill: red when late, brass for today, quiet otherwise.
 * `timeOnly` is for lists already grouped by day, where repeating the day is noise.
 */
export function DuePill({ due, time, timeOnly }: { due: string | null; time: string | null; timeOnly?: boolean }) {
  const today = todayISO();
  if (!due) return null;
  const late = due < today;
  const isToday = due === today;
  if (timeOnly && !late && !time) return null;
  return (
    <span
      title={dmy(due) + (time ? ` ${time}` : "")}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 text-[12.5px] font-medium tabular-nums",
        late && "bg-late-soft text-late",
        isToday && "bg-brass-soft text-[color-mix(in_srgb,var(--brass)_70%,var(--fg))]",
        !late && !isToday && "text-muted",
      )}
    >
      {late ? lateLabel(due, today) : timeOnly ? time : dueLabel(due, time, today)}
    </span>
  );
}

/** One row: check circle, type icon, title, what it's for, due date. */
export function TodoItem({
  todo,
  context,
  stage,
  fading,
  timeOnly,
}: {
  todo: TodoLike;
  context?: string | null;
  stage?: ProjectStage | null;
  fading?: boolean;
  /** In a list grouped by day, show only the time (if any), not the day again. */
  timeOnly?: boolean;
}) {
  const ui = useUI();
  const complete = useComplete();
  const comm = channelForTaskType(todo.type);
  const Icon = TYPE_ICON[todo.type];

  return (
    <li className={cn("group/row border-b border-line last:border-b-0", fading && "fade-out")}>
      <div className="flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-hover/50 sm:px-5">
        <button
          onClick={() => complete(todo)}
          className="group grid size-[22px] shrink-0 place-items-center rounded-full border-[1.5px] border-line-strong bg-surface transition-colors hover:border-accent hover:bg-accent-soft"
          aria-label={comm ? `Complete and log: ${todo.title}` : `Complete: ${todo.title}`}
          title={comm ? "Complete and log how it went" : "Mark done"}
        >
          <Check className="size-3 text-accent opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={3} />
        </button>
        <button onClick={() => ui.openTask(todo.id)} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
          <span className="min-w-0">
            <span className="flex min-w-0 items-center gap-2">
              {Icon && (
                <span title={taskTypeLabel(todo.type)} className="grid size-5 shrink-0 place-items-center rounded-md bg-subtle text-muted">
                  <Icon className="size-3" />
                </span>
              )}
              <span className="truncate font-medium">{todo.title}</span>
            </span>
            {context && (
              <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
                {stage && <StageDot stage={stage} className="size-1.5" />}
                <span className="truncate">{context}</span>
              </span>
            )}
          </span>
          <DuePill due={todo.due_date} time={todo.due_time} timeOnly={timeOnly} />
        </button>
      </div>
    </li>
  );
}
