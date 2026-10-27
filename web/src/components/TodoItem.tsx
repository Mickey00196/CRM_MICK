import { Clock, Eye, Link2, Mail, Phone, Users } from "lucide-react";
import { channelForTaskType, taskTypeLabel, type TaskType } from "@shared/model";
import { dueText, shortDate } from "@shared/dates";
import { api } from "@/lib/api";
import { addDays, dmy, todayISO, workday } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/dropdown";
import { TASK_DONE, useUI } from "./ui-context";
import { toast } from "./Toast";

export interface TodoLike {
  id: string;
  title: string;
  type: TaskType;
  due_date: string | null;
  due_time: string | null;
  snooze_count?: number;
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

/** Moves a to-do to another day, with Undo. */
export async function snoozeTodo(t: TodoLike, date: string) {
  try {
    await api(`/tasks/${t.id}`, "PATCH", { snooze_until: date });
    toast(`Moved to ${dueText(date, null, todayISO()).toLowerCase()}`, {
      label: "Undo",
      run: () => void api(`/tasks/${t.id}`, "PATCH", { due_date: t.due_date }),
    });
  } catch (e) {
    toast((e as Error).message);
  }
}

export function dueLabel(due: string | null, time: string | null, today = todayISO()): string {
  return dueText(due, time, today);
}

/** One calm row: circle, title (+ what it's for), when, and quick ways to push it back. */
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
  const Icon = showType !== false ? TYPE_ICON[todo.type] : undefined;
  const tomorrow = workday(addDays(today, 1));
  const pushedBack = (todo.snooze_count ?? 0) >= 3;
  const dueStr = hideToday && todo.due_date === today ? todo.due_time ?? "" : dueLabel(todo.due_date, todo.due_time, today);

  return (
    <li className={cn("group/row border-b border-line", fading && "fade-out")}>
      <div className="flex items-center gap-4 py-3">
        <button
          onClick={() => complete(todo)}
          className="group relative grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] border-line-strong transition-colors before:absolute before:-inset-3 before:content-[''] hover:border-fg"
          aria-label={comm ? `Complete and log: ${todo.title}` : `Complete: ${todo.title}`}
          title={comm ? "Complete and log how it went" : "Mark done"}
        >
          <span className="size-2 rounded-full bg-fg opacity-0 transition-opacity group-hover:opacity-30" />
        </button>

        <button onClick={() => ui.openTask(todo.id)} className="flex min-w-0 flex-1 items-baseline gap-2 text-left">
          {Icon && (
            <Icon className="relative top-[2px] size-3.5 shrink-0 text-muted" aria-label={taskTypeLabel(todo.type)} />
          )}
          {/* Wide screens: one line. */}
          <span className="hidden min-w-0 truncate sm:block">
            {todo.title}
            {context && <span className="text-sm text-muted"> · {context}</span>}
            {pushedBack && <span className="text-sm text-missing"> · pushed back {todo.snooze_count}×</span>}
          </span>
          {/* Phones: title, then when and what it's for, so the title gets the full width. */}
          <span className="min-w-0 sm:hidden">
            <span className="block truncate">{todo.title}</span>
            {(dueStr || context || pushedBack) && (
              <span className="block truncate text-[13px] text-muted">
                {dueStr && <span className={cn(late && "text-late")}>{dueStr}</span>}
                {dueStr && context && " · "}
                {context}
                {pushedBack && <span className="text-missing"> · pushed back {todo.snooze_count}×</span>}
              </span>
            )}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100">
            <button
              onClick={() => snoozeTodo(todo, tomorrow)}
              className="hidden h-7 rounded-md px-2 text-[13px] text-muted hover:bg-hover hover:text-fg sm:inline-flex sm:items-center"
              title={`Move to ${shortDate(tomorrow, today)}`}
            >
              Tomorrow
            </button>
            <Menu>
              <MenuTrigger asChild>
                <button className="grid size-8 place-items-center rounded-md text-muted hover:bg-hover hover:text-fg [@media(hover:none)]:size-10" aria-label="Move to another day" title="Move to another day">
                  <Clock className="size-4" />
                </button>
              </MenuTrigger>
              <MenuContent align="end">
                <MenuLabel>Move to</MenuLabel>
                {[
                  ["Tomorrow", 1],
                  ["In 2 days", 2],
                  ["Next week", 7],
                  ["In 2 weeks", 14],
                ].map(([label, days]) => {
                  const d = workday(addDays(today, days as number));
                  return (
                    <MenuItem key={label} onSelect={() => snoozeTodo(todo, d)}>
                      {label}
                      <span className="ml-auto pl-4 text-xs text-faint">{shortDate(d, today)}</span>
                    </MenuItem>
                  );
                })}
              </MenuContent>
            </Menu>
          </div>
          <span
            title={todo.due_date ? dmy(todo.due_date) : undefined}
            className={cn("hidden min-w-14 text-right text-sm sm:block", late ? "text-late" : "text-muted")}
          >
            {dueStr}
          </span>
        </div>
      </div>
    </li>
  );
}
