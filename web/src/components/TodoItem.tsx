import { Eye, Link2, Mail, Phone, Users } from "lucide-react";
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
 * When it's due, as plain text the way Reminders shows it: red when late, blue for today.
 * `timeOnly` is for lists already grouped by day, where repeating the day is noise.
 */
export function DuePill({ due, time, timeOnly, className }: { due: string | null; time: string | null; timeOnly?: boolean; className?: string }) {
  const today = todayISO();
  if (!due) return null;
  const late = due < today;
  const isToday = due === today;
  if (timeOnly && !late && !time) return null;
  return (
    <span
      title={dmy(due) + (time ? ` ${time}` : "")}
      className={cn(
        "shrink-0 whitespace-nowrap tabular-nums",
        late ? "font-medium text-late-text" : isToday ? "text-accent" : "text-muted",
        className,
      )}
    >
      {late ? lateLabel(due, today) : timeOnly ? time : dueLabel(due, time, today)}
    </span>
  );
}

/** One row, like a reminder: circle, title, what it's for and when. */
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
  const due = <DuePill due={todo.due_date} time={todo.due_time} timeOnly={timeOnly} />;
  const hasDue = Boolean(todo.due_date && (!timeOnly || todo.due_time || todo.due_date < todayISO()));

  return (
    <li className={cn("group/row flex items-start gap-3 pl-4 transition-colors hover:bg-hover", fading && "fade-out")}>
      <button
        onClick={() => complete(todo)}
        className={cn(
          "group mt-[11px] grid size-[22px] shrink-0 place-items-center rounded-full border-[1.5px] transition-colors",
          fading ? "border-accent bg-accent" : "border-check hover:border-accent",
        )}
        aria-label={comm ? `Complete and log: ${todo.title}` : `Complete: ${todo.title}`}
        title={comm ? "Complete and log how it went" : "Mark done"}
      >
        <span className={cn("size-3 rounded-full transition-opacity", fading ? "opacity-0" : "bg-accent opacity-0 group-hover:opacity-25")} />
      </button>
      <button
        onClick={() => ui.openTask(todo.id)}
        className="flex min-w-0 flex-1 items-center gap-3 border-b border-line py-2.5 pr-4 text-left group-last/row:border-b-0"
      >
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-[15px] leading-snug", fading && "text-muted")}>{todo.title}</span>
          {(context || hasDue) && (
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
              {hasDue && due}
              {hasDue && context && <span className="text-faint">·</span>}
              {context && (
                <>
                  {stage && <StageDot stage={stage} className="size-1.5" />}
                  <span className="truncate">{context}</span>
                </>
              )}
            </span>
          )}
        </span>
        {Icon && (
          <span title={taskTypeLabel(todo.type)} className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <Icon className="size-3.5" />
          </span>
        )}
      </button>
    </li>
  );
}
