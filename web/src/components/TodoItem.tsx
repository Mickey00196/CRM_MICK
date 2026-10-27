import { channelForTaskType, taskTypeLabel, type TaskType } from "@shared/model";
import { api } from "@/lib/api";
import { daysBetween, dmy, todayISO } from "@/lib/format";
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
  return time && d > 0 && d < 7 ? `${dmy(due)} ${time}` : dmy(due);
}

/** One calm row: circle, title (+ what it's for), due date. */
export function TodoItem({
  todo,
  context,
  fading,
  showType,
  hideToday,
}: {
  todo: TodoLike;
  context?: string | null;
  fading?: boolean;
  showType?: boolean;
  /** In a "Today" section the word Today is noise; show only a time, if any. */
  hideToday?: boolean;
}) {
  const ui = useUI();
  const complete = useComplete();
  const today = todayISO();
  const late = todo.due_date !== null && todo.due_date < today;
  const comm = channelForTaskType(todo.type);

  return (
    <li className={cn("border-b border-line", fading && "fade-out")}>
      <div className="flex items-center gap-4 py-3.5">
        <button
          onClick={() => complete(todo)}
          className="group grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] border-line-strong transition-colors hover:border-fg"
          aria-label={comm ? `Complete and log: ${todo.title}` : `Complete: ${todo.title}`}
          title={comm ? "Complete and log how it went" : "Mark done"}
        >
          <span className="size-2 rounded-full bg-fg opacity-0 transition-opacity group-hover:opacity-30" />
        </button>
        <button onClick={() => ui.openTask(todo.id)} className="flex min-w-0 flex-1 items-baseline justify-between gap-4 text-left">
          <span className="min-w-0 truncate">
            {todo.title}
            {(context || (showType && comm)) && (
              <span className="text-sm text-muted">
                {showType && comm ? ` · ${taskTypeLabel(todo.type)}` : ""}
                {context ? ` · ${context}` : ""}
              </span>
            )}
          </span>
          <span className={cn("shrink-0 text-sm", late ? "text-late" : "text-muted")}>
            {hideToday && todo.due_date === today ? todo.due_time ?? "" : dueLabel(todo.due_date, todo.due_time, today)}
          </span>
        </button>
      </div>
    </li>
  );
}
