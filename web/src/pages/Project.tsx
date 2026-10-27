import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MoreHorizontal, Phone, Mail, Users, StickyNote } from "lucide-react";
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

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/projects" className="mb-6 inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> Projects
      </Link>

      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <EditableTitle value={p.name} onSave={(name) => save({ name })} />
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
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
      </header>

      <StageSwitcher stage={p.stage} waitingOn={p.waiting_on} onStage={(stage) => save({ stage })} onWaitingOn={(waiting_on) => save({ waiting_on })} />

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <section>
            <h2 className="label mb-1">To-dos</h2>
            {data.tasks.length === 0 && p.stage !== "done" && (
              <p className="border-b border-line py-3.5 text-sm text-missing">No next step. What's the next thing that moves this forward?</p>
            )}
            <ul>
              {data.tasks.map((t) => (
                <TodoItem key={t.id} todo={t} fading={fading.has(t.id)} showType />
              ))}
            </ul>
            <InlineAddTodo projectId={p.id} />
            {data.done_tasks.length > 0 && <DoneTasks tasks={data.done_tasks} />}
          </section>

          <section className="mt-12">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="label">Log</h2>
              <div className="flex flex-wrap gap-1">
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
            </div>
            <Timeline items={data.activities} empty="Nothing logged yet. Notes, calls and meetings for this project show up here." />
          </section>
        </div>

        <aside className="grid content-start gap-10">
          <Notes value={p.notes} onSave={(notes) => save({ notes })} />
          {data.contacts.length > 0 && (
            <section>
              <h2 className="label mb-2">People at {p.account_name}</h2>
              <ul className="grid gap-3">
                {data.contacts.map((c) => (
                  <li key={c.id} className="text-sm">
                    <Link to={`/contacts/${c.id}`} className="font-medium hover:text-accent">
                      {c.name}
                    </Link>
                    {c.role && <span className="text-muted"> · {c.role}</span>}
                    <div className="flex flex-wrap gap-x-3 text-[13px] text-muted">
                      {c.phone && (
                        <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="hover:text-fg">
                          {c.phone}
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="truncate hover:text-fg">
                          {c.email}
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="text-xs text-faint">
            Started {dmy(p.created_at)} · in {PROJECT_STAGES.find((s) => s.key === p.stage)?.label.toLowerCase()} since {dmy(p.stage_changed_at)}
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
      <h1 className="title cursor-text text-3xl" onClick={() => setEditing(true)} title="Click to rename">
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
      className="title w-full rounded-md bg-subtle px-1 -mx-1 text-3xl outline-none"
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
    <span className="inline-flex items-baseline gap-2">
      <Link to={`/accounts/${p.account_id}`} className="hover:text-fg">
        {p.account_name}
      </Link>
      <button onClick={() => setPicking(true)} className="text-xs text-faint hover:text-fg">
        change
      </button>
    </span>
  ) : (
    <button onClick={() => setPicking(true)} className="hover:text-fg">
      + Company
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
    <button onClick={() => setEditing(true)} className="hover:text-fg">
      {value ? `Target ${dmy(value)} (${relative(value)})` : "+ Target date"}
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
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <div className="inline-flex rounded-lg border border-line bg-subtle p-0.5" role="radiogroup" aria-label="Stage">
        {PROJECT_STAGES.map((s) => (
          <button
            key={s.key}
            role="radio"
            aria-checked={stage === s.key}
            onClick={() => onStage(s.key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              stage === s.key ? "bg-surface font-medium text-fg shadow-sm" : "text-muted hover:text-fg",
            )}
          >
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
          className="h-8 w-80 max-w-full text-[13px]"
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
    <form onSubmit={add} className="py-3">
      <input
        ref={input}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="+ Add a to-do"
        className="w-full bg-transparent py-1 text-[15px] outline-none placeholder:text-faint"
        aria-label="New to-do"
      />
      {title.trim() && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px]">
          {QUICK_DUE.map((q) => {
            const d = q.days ? workday(addDays(today, q.days)) : today;
            return (
              <button
                key={q.label}
                type="button"
                onClick={() => setDue(d)}
                className={cn("h-7 rounded-full border px-2.5", due === d ? "border-fg bg-fg text-bg" : "border-line-strong text-muted hover:text-fg")}
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
    <div className="mt-2">
      <button onClick={() => setOpen((v) => !v)} className="text-[13px] text-muted hover:text-fg" aria-expanded={open}>
        {open ? "Hide" : "Show"} {tasks.length} done
      </button>
      {open && (
        <ul className="mt-2">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-sm">
              <span className="text-faint line-through">{t.title}</span>
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
      <h2 className="label mb-2 flex items-baseline justify-between">
        Notes {saved && <span className="font-normal normal-case tracking-normal text-faint">Saved</span>}
      </h2>
      <Textarea
        rows={6}
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
        className="text-sm"
      />
    </section>
  );
}
