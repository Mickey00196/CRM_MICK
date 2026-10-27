import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Building2, Check, ChevronDown, Flag, Mail, MoreHorizontal, Phone, Plus, StickyNote, Users } from "lucide-react";
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
import { STAGE_DOT, StageDot } from "@/components/Stage";
import { PanelHead } from "@/components/Panel";

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
      <Link to="/projects" className="mb-5 inline-flex items-center gap-1 rounded-md text-[13px] font-medium text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> Projects
      </Link>

      <header className="card relative overflow-hidden p-5 sm:p-6">
        <span aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-1", STAGE_DOT[p.stage])} />
        <div className="flex items-start gap-4">
          <Avatar name={p.account_name ?? p.name} size="lg" className="hidden sm:inline-grid" />
          <div className="min-w-0 flex-1">
            <EditableTitle value={p.name} onSave={(name) => save({ name })} />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-muted">
              <CompanyField project={p} onSave={(account_id) => save({ account_id })} />
              <TargetDate value={p.target_date} onSave={(target_date) => save({ target_date })} />
            </div>
          </div>
          <Menu>
            <MenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More">
                <MoreHorizontal />
              </Button>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem onSelect={archive}>Archive project</MenuItem>
            </MenuContent>
          </Menu>
        </div>
        <StageSwitcher stage={p.stage} waitingOn={p.waiting_on} onStage={(stage) => save({ stage })} onWaitingOn={(waiting_on) => save({ waiting_on })} />
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid min-w-0 content-start gap-6">
          <section className="card overflow-hidden">
            <PanelHead title="To-dos" count={data.tasks.length} />
            {data.tasks.length === 0 && p.stage !== "done" && (
              <p className="flex items-center gap-2 border-b border-line bg-missing-soft px-4 py-3 text-sm text-missing sm:px-5">
                <AlertTriangle className="size-4 shrink-0" /> No next step. What's the next thing that moves this forward?
              </p>
            )}
            <ul>
              {data.tasks.map((t) => (
                <TodoItem key={t.id} todo={t} fading={fading.has(t.id)} />
              ))}
            </ul>
            <InlineAddTodo projectId={p.id} />
            {data.done_tasks.length > 0 && <DoneTasks tasks={data.done_tasks} />}
          </section>

          <section className="card overflow-hidden">
            <PanelHead title="Log">
              <div className="flex flex-wrap gap-0.5">
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
              </div>
            </PanelHead>
            <div className="px-4 py-1 sm:px-5">
              <Timeline items={data.activities} empty="Nothing logged yet. Notes, calls and meetings for this project show up here." />
            </div>
          </section>
        </div>

        <aside className="grid content-start gap-6">
          <Notes value={p.notes} onSave={(notes) => save({ notes })} />
          {data.contacts.length > 0 && (
            <section className="card overflow-hidden">
              <PanelHead title={`People at ${p.account_name}`} />
              <ul>
                {data.contacts.map((c) => (
                  <li key={c.id} className="flex gap-3 border-b border-line px-4 py-3 text-sm last:border-b-0">
                    <Avatar name={c.name} size="md" />
                    <div className="min-w-0">
                      <Link to={`/contacts/${c.id}`} className="font-semibold hover:text-accent">
                        {c.name}
                      </Link>
                      {c.role && <p className="truncate text-[13px] text-muted">{c.role}</p>}
                      <div className="mt-1 grid gap-0.5 text-[13px] text-muted">
                        {c.phone && (
                          <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-accent">
                            <Phone className="size-3" /> {c.phone}
                          </a>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="inline-flex min-w-0 items-center gap-1.5 hover:text-accent">
                            <Mail className="size-3 shrink-0" /> <span className="truncate">{c.email}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="px-1 text-xs text-faint">
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
      <h1 className="display cursor-text text-[26px] sm:text-[30px]" onClick={() => setEditing(true)} title="Click to rename">
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
      className="display -mx-1 w-full rounded-md bg-subtle px-1 text-[26px] outline-none sm:text-[30px]"
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
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-subtle pl-2.5 pr-1">
      <Building2 className="size-3.5" />
      <Link to={`/accounts/${p.account_id}`} className="font-medium text-fg hover:text-accent">
        {p.account_name}
      </Link>
      <button onClick={() => setPicking(true)} className="rounded-full px-1.5 text-xs text-faint hover:bg-hover hover:text-fg">
        change
      </button>
    </span>
  ) : (
    <button onClick={() => setPicking(true)} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-dashed border-line-strong px-2.5 hover:text-fg">
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
        className="h-7 w-auto px-2 text-[13px]"
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
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 hover:text-fg",
        value ? "bg-subtle" : "border border-dashed border-line-strong",
      )}
    >
      <Flag className="size-3.5" />
      {value ? (
        <>
          <span className="font-medium text-fg">Target {dmy(value)}</span> <span className="text-faint">{relative(value)}</span>
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
    <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
      <div className="inline-flex max-w-full overflow-x-auto rounded-xl bg-subtle p-1" role="radiogroup" aria-label="Stage">
        {PROJECT_STAGES.map((s) => (
          <button
            key={s.key}
            role="radio"
            aria-checked={stage === s.key}
            onClick={() => onStage(s.key)}
            className={cn(
              "inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-all",
              stage === s.key ? "bg-surface font-semibold text-fg shadow-[var(--shadow-card)]" : "text-muted hover:text-fg",
            )}
          >
            <StageDot stage={s.key} className={cn(stage !== s.key && "opacity-50")} />
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
          className="h-9 w-80 max-w-full text-[13px]"
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
    <form onSubmit={add} className="border-t border-line px-4 py-2.5 first:border-t-0 sm:px-5 [ul:empty+&]:border-t-0">
      <div className="flex items-center gap-3.5">
        <Plus className="size-[22px] shrink-0 rounded-full border-[1.5px] border-dashed border-line-strong p-0.5 text-faint" />
        <input
          ref={input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a to-do"
          className="w-full bg-transparent py-1 text-[15px] outline-none placeholder:text-faint"
          aria-label="New to-do"
        />
      </div>
      {title.trim() && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-9 text-[13px]">
          {QUICK_DUE.map((q) => {
            const d = q.days ? workday(addDays(today, q.days)) : today;
            return (
              <button
                key={q.label}
                type="button"
                onClick={() => setDue(d)}
                className={cn("h-7 rounded-full border px-2.5", due === d ? "border-accent bg-accent text-accent-fg" : "border-line-strong text-muted hover:text-fg")}
              >
                {q.label}
              </button>
            );
          })}
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-7 w-auto px-2 text-[13px]" aria-label="Due date" />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TaskType)}
            className="h-7 rounded-md border border-line-strong bg-surface px-2 text-[13px]"
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
    <div className="border-t border-line bg-subtle/40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium text-muted hover:text-fg sm:px-5"
        aria-expanded={open}
      >
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        {open ? "Hide" : "Show"} {tasks.length} done
      </button>
      {open && (
        <ul className="pb-1">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-2 text-sm sm:px-5">
              <span className="flex min-w-0 items-center gap-3.5">
                <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                <span className="truncate text-faint line-through">{t.title}</span>
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
    <section className="card overflow-hidden">
      <div className="flex min-h-12 items-center justify-between border-b border-line px-4">
        <h2 className="title text-[15px]">Notes</h2>
        {saved && <span className="text-[12px] text-accent">Saved</span>}
      </div>
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
        className="rounded-none border-0 bg-transparent px-4 py-3 text-sm focus:ring-0"
      />
    </section>
  );
}
