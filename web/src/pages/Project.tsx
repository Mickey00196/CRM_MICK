import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Archive, Building2, Check, CircleDashed, Flag, Mail, MoreHorizontal, Phone, Plus, StickyNote, Users } from "lucide-react";
import { PROJECT_STAGES, type Channel, type ProjectDetail, type ProjectStage, type TaskType } from "@shared/model";
import { api, useApi } from "@/lib/api";
import { addDays, dmy, relative, todayISO, workday } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/dropdown";
import { AccountPicker } from "@/components/Pickers";
import { Timeline } from "@/components/Timeline";
import { TodoItem } from "@/components/TodoItem";
import { TASK_DONE, usePageContext, useUI } from "@/components/ui-context";
import { Avatar } from "@/components/Avatar";
import { StageDot } from "@/components/Stage";
import { BackLink, Panel, PanelHead } from "@/components/Panel";

export function ProjectPage() {
  const id = useParams().id!;
  const { data, error } = useApi<ProjectDetail>(`/projects/${id}`);
  const ui = useUI();
  const navigate = useNavigate();
  const p = data?.project;
  usePageContext(
    p
      ? {
          project: { id: p.id, name: p.name, account_id: p.account_id, account_name: p.account_name },
          account: p.account_id ? { id: p.account_id, name: p.account_name ?? "" } : null,
        }
      : null,
  );
  const fading = useFading(data);

  if (error && !data)
    return (
      <div className="mx-auto max-w-4xl">
        <p className="text-sm text-late">{error}</p>
        <Link to="/projects" className="mt-3 inline-block text-sm text-muted hover:text-fg">
          Back to projects
        </Link>
      </div>
    );
  if (!data || !p) return null;

  const save = (patch: Record<string, unknown>) => api(`/projects/${p.id}`, "PATCH", patch);
  const ctx = { project: { id: p.id, name: p.name, account_id: p.account_id, account_name: p.account_name }, account: p.account_id ? { id: p.account_id, name: p.account_name ?? "" } : null };
  const log = (channel: Channel) => ui.openLog({ ...ctx, channel });

  async function archive() {
    if (!confirm(`Archive "${p!.name}"? Its open to-dos disappear from your list.`)) return;
    await api(`/projects/${p!.id}`, "DELETE");
    navigate("/projects");
  }

  const stageLabel = PROJECT_STAGES.find((s) => s.key === p.stage)?.label.toLowerCase();

  return (
    <div className="rise mx-auto max-w-5xl">
      <BackLink to="/projects">Projects</BackLink>

      <header className="mb-8">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <EditableTitle value={p.name} onSave={(name) => save({ name })} />
          </div>
          <Menu>
            <MenuTrigger asChild>
              <button className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-fg" aria-label="More">
                <MoreHorizontal className="size-[18px]" />
              </button>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem onSelect={archive}>
                <Archive /> Archive project
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
          <CompanyField project={p} onSave={(account_id) => save({ account_id })} />
          <TargetDate value={p.target_date} onSave={(target_date) => save({ target_date })} />
        </div>
        <StageSwitcher stage={p.stage} waitingOn={p.waiting_on} onStage={(stage) => save({ stage })} onWaitingOn={(waiting_on) => save({ waiting_on })} />
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid min-w-0 content-start gap-8">
          <Panel title="To-dos" count={data.tasks.length}>
            {data.tasks.length === 0 && p.stage !== "done" && (
              <p className="flex items-center gap-2 border-b border-dashed border-line-strong px-4 py-3 text-[13px] text-muted">
                <CircleDashed className="size-4 shrink-0" /> No next step yet. What moves this forward?
              </p>
            )}
            <ul>
              {data.tasks.map((t) => (
                <TodoItem key={t.id} todo={t} fading={fading.has(t.id)} />
              ))}
            </ul>
            <InlineAddTodo projectId={p.id} />
            {data.done_tasks.length > 0 && <DoneTasks tasks={data.done_tasks} />}
          </Panel>

          <Panel
            title="Log"
            actions={
              <>
                <Button variant="ghost" size="xs" onClick={() => log("note")}>
                  <StickyNote /> Note
                </Button>
                <Button variant="ghost" size="xs" onClick={() => log("call")}>
                  <Phone /> Call
                </Button>
                <Button variant="ghost" size="xs" onClick={() => log("email")}>
                  <Mail /> Email
                </Button>
                <Button variant="ghost" size="xs" onClick={() => log("meeting")}>
                  <Users /> Meeting
                </Button>
              </>
            }
          >
            <div className="px-4 py-1">
              <Timeline items={data.activities} empty="Nothing logged yet. Notes, calls and meetings for this project show up here." />
            </div>
          </Panel>
        </div>

        <aside className="grid content-start gap-8">
          <Notes value={p.notes} onSave={(notes) => save({ notes })} />
          {data.contacts.length > 0 && (
            <Panel title="People">
              <ul>
                {data.contacts.map((c) => (
                  <li key={c.id} className="group/row flex gap-3 pl-4">
                    <Avatar name={c.name} size="md" shape="round" className="mt-3" />
                    <div className="min-w-0 flex-1 border-b border-line py-2.5 pr-4 group-last/row:border-b-0">
                      <Link to={`/contacts/${c.id}`} className="block truncate text-[13.5px] font-medium hover:underline">
                        {c.name}
                      </Link>
                      {c.role && <p className="truncate text-[13px] text-muted">{c.role}</p>}
                      <div className="mt-1 flex flex-wrap gap-x-3 text-[13px]">
                        {c.phone && (
                          <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="mono text-[12px] text-muted hover:text-fg">
                            {c.phone}
                          </a>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="min-w-0 truncate text-muted hover:text-fg">
                            {c.email}
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <p className="px-1 text-[12px] text-faint">
            Started {dmy(p.created_at)} · {stageLabel} since {dmy(p.stage_changed_at)}
          </p>
        </aside>
      </div>
    </div>
  );
}

/** Rows fade out right after they're completed, before the list reloads. */
function useFading(data: unknown) {
  const [fading, setFading] = useState<Set<string>>(new Set());
  useEffect(() => {
    const onDone = (e: Event) => setFading((s) => new Set(s).add((e as CustomEvent<string>).detail));
    window.addEventListener(TASK_DONE, onDone);
    return () => window.removeEventListener(TASK_DONE, onDone);
  }, []);
  useEffect(() => setFading(new Set()), [data]);
  return fading;
}

function EditableTitle({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  if (!editing)
    return (
      <h1 className="display cursor-text text-[24px] sm:text-[28px]" onClick={() => setEditing(true)} title="Click to rename">
        {value}
      </h1>
    );
  const commit = () => {
    setEditing(false);
    if (v.trim() && v.trim() !== value) onSave(v.trim());
    else setV(value);
  };
  return (
    <input
      autoFocus
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setV(value);
          setEditing(false);
        }
      }}
      className="display -mx-1.5 w-full rounded-lg bg-subtle px-1.5 text-[24px] outline-none sm:text-[28px]"
      aria-label="Project name"
    />
  );
}

function CompanyField({ project: p, onSave }: { project: ProjectDetail["project"]; onSave: (id: string | null) => void }) {
  const [picking, setPicking] = useState(false);
  if (picking)
    return (
      <div className="w-64">
        <AccountPicker
          value={null}
          autoFocus
          onChange={(a) => {
            setPicking(false);
            if (a) onSave(a.id);
          }}
        />
      </div>
    );
  return p.account_id ? (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-line-strong bg-surface pl-1.5 pr-1 shadow-[var(--shadow-card)]">
      <Avatar name={p.account_name ?? ""} size="sm" className="!size-4 !rounded-[4px] !text-[7px]" />
      <Link to={`/accounts/${p.account_id}`} className="font-medium text-fg hover:underline">
        {p.account_name}
      </Link>
      <button onClick={() => setPicking(true)} className="rounded-md px-1.5 py-0.5 text-[12px] text-faint hover:bg-subtle hover:text-fg">
        Change
      </button>
    </span>
  ) : (
    <button onClick={() => setPicking(true)} className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 text-muted shadow-[var(--shadow-card)] hover:text-fg">
      <Building2 className="size-3.5" /> Add company
    </button>
  );
}

function TargetDate({ value, onSave }: { value: string | null; onSave: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <Input
        type="date"
        autoFocus
        defaultValue={value ?? ""}
        className="h-7 w-auto px-2.5 text-[13px]"
        onBlur={(e) => {
          setEditing(false);
          if ((e.target.value || null) !== value) onSave(e.target.value || null);
        }}
        aria-label="Target date"
      />
    );
  return (
    <button
      onClick={() => setEditing(true)}
      className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 text-muted shadow-[var(--shadow-card)] hover:text-fg"
    >
      <Flag className="size-3.5" />
      {value ? (
        <>
          <span className="mono text-[12px] text-fg">{dmy(value)}</span> <span>{relative(value)}</span>
        </>
      ) : (
        "Target date"
      )}
    </button>
  );
}

function StageSwitcher({
  stage,
  waitingOn,
  onStage,
  onWaitingOn,
}: {
  stage: ProjectStage;
  waitingOn: string;
  onStage: (s: ProjectStage) => void;
  onWaitingOn: (v: string) => void;
}) {
  const [v, setV] = useState(waitingOn);
  useEffect(() => setV(waitingOn), [waitingOn]);
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <div className="segmented flex w-full sm:inline-flex sm:w-auto" role="radiogroup" aria-label="Stage">
        {PROJECT_STAGES.map((s) => (
          <button key={s.key} role="radio" aria-checked={stage === s.key} onClick={() => onStage(s.key)} className="flex-1 sm:min-w-24">
            <StageDot stage={s.key} className={cn(stage !== s.key && "opacity-40")} />
            {s.key === "waiting" ? "Waiting" : s.label}
          </button>
        ))}
      </div>
      {stage === "waiting" && (
        <Input
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => v !== waitingOn && onWaitingOn(v)}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          placeholder="Waiting on… (e.g. landlord's counter-offer)"
          className="h-8 w-80 max-w-full text-[14px]"
          aria-label="Waiting on"
        />
      )}
    </div>
  );
}

const QUICK_DUE = [
  { label: "Today", days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "Next week", days: 7 },
];

/** Type and press Enter. Defaults to today. */
function InlineAddTodo({ projectId }: { projectId: string }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(todayISO());
  const [type, setType] = useState<TaskType>("todo");
  const input = useRef<HTMLInputElement>(null);
  const today = todayISO();

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const t = title;
    setTitle("");
    await api("/tasks", "POST", { title: t, type, due_date: due || null, project_id: projectId });
    input.current?.focus();
  }

  return (
    <form onSubmit={add} className="border-t border-line px-4 py-2 first:border-t-0 [ul:empty+&]:border-t-0">
      <div className="flex items-center gap-3">
        <span className="grid size-[18px] shrink-0 place-items-center rounded-full border-[1.5px] border-dashed border-check text-faint">
          <Plus className="size-2.5" strokeWidth={3} />
        </span>
        <input
          ref={input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New to-do"
          className="w-full bg-transparent py-1 text-[14px] outline-none placeholder:text-faint"
          aria-label="New to-do"
        />
      </div>
      {title.trim() && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pb-1 pl-[34px] text-[13px]">
          {QUICK_DUE.map((q) => {
            const d = q.days ? workday(addDays(today, q.days)) : today;
            return (
              <button
                key={q.label}
                type="button"
                onClick={() => setDue(d)}
                className={cn("h-7 rounded-lg border px-2.5 font-medium", due === d ? "border-accent bg-accent text-accent-fg" : "border-line-strong bg-surface text-muted hover:text-fg")}
              >
                {q.label}
              </button>
            );
          })}
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-7 w-auto px-2.5 text-[13px]" aria-label="Due date" />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TaskType)}
            className="h-7 rounded-lg border border-line-strong bg-surface px-2 text-[13px]"
            aria-label="Type"
          >
            <option value="todo">To-do</option>
            <option value="call">Call</option>
            <option value="email">Email</option>
            <option value="meeting">Meeting</option>
            <option value="viewing">Viewing</option>
            <option value="linkedin">LinkedIn</option>
          </select>
          <Button size="xs" className="ml-auto">
            Add
          </Button>
        </div>
      )}
    </form>
  );
}

function DoneTasks({ tasks }: { tasks: ProjectDetail["done_tasks"] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-line">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-[12.5px] text-muted hover:bg-hover"
        aria-expanded={open}
      >
        <span className="mono">{tasks.length} completed</span>
        <span className="text-[12.5px] text-faint">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <ul className="pb-1">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-2 text-[13.5px]">
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-faint text-surface">
                  <Check className="size-2.5" strokeWidth={3.5} />
                </span>
                <span className="truncate text-muted">{t.title}</span>
              </span>
              <span className="shrink-0 text-[13px] text-faint">{dmy(t.completed_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Notes({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  const [saved, setSaved] = useState(false);
  useEffect(() => setV(value), [value]);
  return (
    <section>
      <PanelHead title="Notes">{saved && <span className="mr-2 text-[13px] text-muted">Saved</span>}</PanelHead>
      <Textarea
        rows={7}
        value={v}
        onChange={(e) => {
          setV(e.target.value);
          setSaved(false);
        }}
        onBlur={async () => {
          if (v === value) return;
          await onSave(v);
          setSaved(true);
        }}
        placeholder="Requirements, background, anything to remember"
        className="px-4 py-3 text-[13.5px]"
      />
    </section>
  );
}
