import { Clock, Eye, Link2, Mail, Phone, Users } from "lucide-react";
import { channelForTaskType, taskTypeLabel, type TaskType } from "@shared/model";
import { dueParts, dueText, shortDate } from "@shared/dates";
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

/**
 * One row, in columns so every row lines up: when, circle, title, and (on wide screens)
 * what it's for. Quick ways to push it back appear on hover.
 */
export function TodoItem({
  todo,
  context,
  fading,
  showType,
}: {
  todo: TodoLike;
  /** Pass it (even as null) to get the "what it's for" column; leave it out where that's obvious. */
  context?: string | null;
  fading?: boolean;
  showType?: boolean;
}) {
  const ui = useUI();
  const complete = useComplete();
  const today = todayISO();
  const late = todo.due_date !== null && todo.due_date < today;
  const comm = channelForTaskType(todo.type);
  const Icon = showType !== false ? TYPE_ICON[todo.type] : undefined;
  const tomorrow = workday(addDays(today, 1));
  const pushedBack = (todo.snooze_count ?? 0) >= 3;
  const { day, time } = dueParts(todo.due_date, todo.due_time, today);
  const withContext = context !== undefined;

  return (
    <li className={cn("group/row relative border-b border-line", fading && "fade-out")}>
      <div className="flex items-start gap-3 py-3 sm:gap-4">
        {/* When. Same width on every row, so the titles line up. */}
        <span
          title={todo.due_date ? dmy(todo.due_date) : undefined}
          className={cn(
            "num w-[4.75rem] shrink-0 pt-[3px] leading-tight sm:w-[7.5rem] sm:truncate sm:leading-[22.5px] sm:pt-0",
            late ? "text-late" : "text-muted",
          )}
        >
          {day}
          {time && <span className="block text-faint sm:ml-2 sm:inline">{time}</span>}
        </span>

        <button
          onClick={() => complete(todo)}
          className="group relative mt-px grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] border-line-strong transition-colors before:absolute before:-inset-3 before:content-[''] hover:border-accent"
          aria-label={comm ? `Complete and log: ${todo.title}` : `Complete: ${todo.title}`}
          title={comm ? "Complete and log how it went" : "Mark done"}
        >
          <span className="size-2 rounded-full bg-accent opacity-0 transition-opacity group-hover:opacity-50" />
        </button>

        <button onClick={() => ui.openTask(todo.id)} className="flex min-w-0 flex-1 items-start gap-2.5 text-left">
          {/* Type icon in a fixed slot, empty for plain to-dos, so titles still line up. */}
          <span className="flex h-[22.5px] w-3.5 shrink-0 items-center">
            {Icon && <Icon className="size-3.5 text-muted" aria-label={taskTypeLabel(todo.type)} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate">
              {todo.title}
              {pushedBack && <span className="text-sm text-missing"> · pushed back {todo.snooze_count}×</span>}
            </span>
            {/* Phones: what it's for goes under the title. */}
            {context && <span className="block truncate text-[13px] text-muted sm:hidden">{context}</span>}
          </span>
          {withContext && <span className="hidden w-48 shrink-0 truncate text-sm leading-[22.5px] text-muted sm:block">{context}</span>}
        </button>

        {/* Push back: over the right edge on hover; always there on touch screens. */}
        <div
          className={cn(
            "flex shrink-0 items-center gap-0.5 transition-opacity",
            "sm:pointer-events-none sm:absolute sm:inset-y-0 sm:right-0 sm:bg-linear-to-l sm:from-bg sm:from-75% sm:to-transparent sm:pl-12 sm:opacity-0",
            "sm:focus-within:pointer-events-auto sm:focus-within:opacity-100 sm:group-hover/row:pointer-events-auto sm:group-hover/row:opacity-100",
            "[@media(hover:none)]:pointer-events-auto [@media(hover:none)]:static [@media(hover:none)]:bg-none [@media(hover:none)]:pl-0 [@media(hover:none)]:opacity-100",
          )}
        >
          <button
            onClick={() => snoozeTodo(todo, tomorrow)}
            className="hidden h-7 rounded-md px-2 text-[13px] text-muted hover:bg-hover hover:text-fg sm:inline-flex sm:items-center"
            title={`Move to ${shortDate(tomorrow, today)}`}
          >
            Tomorrow
          </button>
          <Menu>
            <MenuTrigger asChild>
              <button className="-my-1 grid size-8 place-items-center rounded-md text-muted hover:bg-hover hover:text-fg [@media(hover:none)]:size-10" aria-label="Move to another day" title="Move to another day">
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
      </div>
    </li>
  );
}
