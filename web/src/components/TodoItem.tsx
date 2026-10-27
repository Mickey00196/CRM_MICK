import { Check, Eye, Link2, Mail, Phone, Users } from "lucide-react";
import { channelForTaskType, taskTypeLabel, type ProjectStage, type TaskType } from "@shared/model";
import { api } from "@/lib/api";
import { daysBetween, dmy, relative, todayISO, weekday } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TASK_DONE, useUI } from "./ui-context";
import { toast } from "./Toast";

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
  const opts: Intl.DateTimeFormatOptions = { timeZone: "UTC", day: "numeric", month: "short" };
  if (due.slice(0, 4) !== today.slice(0, 4)) opts.year = "2-digit";
  return new Date(due + "T12:00:00Z").toLocaleDateString("en-GB", opts);
}

/** "1d late", "5d late", "3w late". */
function lateLabel(due: string, today: string): string {
  const d = daysBetween(due, today);
  if (d < 14) return `${d}d late`;
  if (d < 60) return `${Math.round(d / 7)}w late`;
  return `${Math.round(d / 30.44)}mo late`;
}

/**
 * When it's due, in monospace: red when late, plain otherwise.
 * `timeOnly` is for lists already grouped by day, where repeating the day is noise.
 */
export function DuePill({ due, time, timeOnly, className }: { due: string | null; time: string | null; timeOnly?: boolean; className?: string }) {
  const today = todayISO();
  if (!due) return null;
  const late = due < today;
  if (timeOnly && !late && !time) return null;
  return (
    <span
      title={dmy(due) + (time ? ` ${time}` : "")}
      className={cn("mono shrink-0 whitespace-nowrap text-[12.5px]", late ? "text-late-text" : due === today ? "text-fg" : "text-muted", className)}
    >
      {late ? lateLabel(due, today) : timeOnly ? time : dueLabel(due, time, today)}
    </span>
  );
}

/** One row: check circle, title, what it's for, when. */
export function TodoItem({
  todo,
  context,
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
    <li className={cn("group/row flex items-center gap-3.5 pl-[var(--row-x,1rem)] transition-colors hover:bg-hover", fading && "fade-out")}>
      <button
        onClick={() => complete(todo)}
        className={cn(
          "group grid size-[18px] shrink-0 place-items-center rounded-full border transition-colors duration-200",
          fading ? "border-fg bg-fg text-bg" : "border-check text-transparent hover:border-fg hover:text-muted",
        )}
        aria-label={comm ? `Complete and log: ${todo.title}` : `Complete: ${todo.title}`}
        title={comm ? "Complete and log how it went" : "Mark done"}
      >
        <Check className="size-2.5" strokeWidth={3.5} />
      </button>
      <button
        onClick={() => ui.openTask(todo.id)}
        className="flex min-w-0 flex-1 items-center gap-4 border-b border-line py-3 pr-[var(--row-x,1rem)] text-left group-last/row:border-b-0"
      >
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-[14.5px]", fading && "text-muted line-through")}>{todo.title}</span>
          {context && <span className="mt-0.5 block truncate text-[12.5px] text-muted">{context}</span>}
        </span>
        {Icon && (
          <span title={taskTypeLabel(todo.type)} className="shrink-0 text-faint opacity-0 transition-opacity duration-200 group-hover/row:opacity-100">
            <Icon className="size-3.5" />
          </span>
        )}
        <DuePill due={todo.due_date} time={todo.due_time} timeOnly={timeOnly} className="min-w-16 text-right" />
      </button>
    </li>
  );
}
