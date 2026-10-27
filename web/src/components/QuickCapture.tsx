import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PROJECT_STAGES, TASK_TYPES, type Project, type ProjectStage, type TaskType } from "@shared/model";
import { api } from "@/lib/api";
import { addDays, todayISO, workday } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Chips, ErrorText, Field, Input, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AccountPicker, ProjectPicker, type PickedAccount, type PickedProject } from "./Pickers";
import { AccountForm } from "./AccountForm";
import { LogForm } from "./LogForm";
import { NextStepPicker, nextPayload, type NextStepValue } from "./NextStepPicker";
import type { CaptureKind, PageContext } from "./ui-context";

const KINDS: { key: CaptureKind; label: string }[] = [
  { key: "todo", label: "To-do" },
  { key: "project", label: "Project" },
  { key: "log", label: "Log" },
  { key: "account", label: "Company" },
  { key: "contact", label: "Contact" },
];

export function QuickCapture({
  open,
  kind,
  ctx,
  onKind,
  onClose,
}: {
  open: boolean;
  kind: CaptureKind;
  ctx: PageContext;
  onKind: (k: CaptureKind) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title="Quick capture" hideTitle>
      <div className="border-b border-line px-5 pt-4">
        <div className="flex gap-5 overflow-x-auto" role="tablist">
          {KINDS.map((k) => (
            <button
              key={k.key}
              role="tab"
              aria-selected={kind === k.key}
              onClick={() => onKind(k.key)}
              className={cn(
                "-mb-px whitespace-nowrap border-b-2 pb-3 text-sm transition-colors",
                kind === k.key ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-5">
        {kind === "todo" && <TodoForm ctx={ctx} onDone={onClose} />}
        {kind === "project" && <ProjectForm account={ctx.project ? null : ctx.account ?? null} onDone={onClose} />}
        {kind === "log" && <LogForm key={JSON.stringify(ctx)} preset={ctx} onSaved={onClose} />}
        {kind === "account" && <AccountForm onDone={onClose} />}
        {kind === "contact" && <ContactQuickForm account={ctx.account ?? null} onDone={onClose} />}
      </div>
    </Dialog>
  );
}

const DUE = [
  { key: "0", label: "Today" },
  { key: "1", label: "Tomorrow" },
  { key: "7", label: "Next week" },
] as const;

function TodoForm({ ctx, onDone }: { ctx: PageContext; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskType>("todo");
  const [project, setProject] = useState<PickedProject | null>(ctx.project ?? null);
  const [account, setAccount] = useState<PickedAccount | null>(ctx.project ? null : ctx.account ?? null);
  const [due, setDue] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = todayISO();
  const presetKey = DUE.find((d) => (d.key === "0" ? today : workday(addDays(today, Number(d.key)))) === due)?.key ?? null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/tasks", "POST", {
        title,
        type,
        due_date: due || null,
        project_id: project?.id ?? null,
        account_id: project ? null : account?.id ?? null,
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={save}>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" autoFocus className="h-11 text-base" aria-label="To-do" />
      <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
        <ProjectPicker value={project} onChange={setProject} placeholder="Project (optional)" />
        <Select value={type} onChange={(e) => setType(e.target.value as TaskType)} aria-label="Type">
          {TASK_TYPES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>
      {!project && <AccountPicker value={account} onChange={setAccount} placeholder="Company (optional)" />}
      <div className="flex flex-wrap items-center gap-2">
        <Chips options={DUE} value={presetKey} onChange={(k) => setDue(k === "0" ? today : workday(addDays(today, Number(k))))} size="sm" />
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-7 w-auto px-2 text-[13px]" aria-label="Due date" />
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end">
        <Button disabled={busy || !title.trim()}>Add to-do</Button>
      </div>
    </form>
  );
}

const STAGE_CHIPS = PROJECT_STAGES.filter((s) => s.key !== "done").map((s) => ({ key: s.key, label: s.key === "waiting" ? "Waiting" : s.label }));

/** New project: a name is enough. Company, stage and a first to-do are optional. */
export function ProjectForm({ account: initial, onDone }: { account: PickedAccount | null; onDone: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [account, setAccount] = useState<PickedAccount | null>(initial);
  const [stage, setStage] = useState<ProjectStage>("active");
  const [notes, setNotes] = useState("");
  const [next, setNext] = useState<NextStepValue>({ mode: "new", type: "todo", title: "", due_date: todayISO(), due_time: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const p = await api<Project>("/projects", "POST", { name, stage, account_id: account?.id ?? null, notes, next: nextPayload(next) });
      onDone();
      navigate(`/projects/${p.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={save}>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" autoFocus required className="h-11 text-base" aria-label="Project name" />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <AccountPicker value={account} onChange={setAccount} placeholder="Company (optional)" />
        <Chips options={STAGE_CHIPS} value={stage} onChange={setStage} size="sm" />
      </div>
      <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" aria-label="Notes" />
      <NextStepPicker value={next} onChange={setNext} label="First to-do" />
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end">
        <Button disabled={busy || !name.trim()}>Add project</Button>
      </div>
    </form>
  );
}

function ContactQuickForm({ account: initial, onDone }: { account: PickedAccount | null; onDone: () => void }) {
  const [account, setAccount] = useState<PickedAccount | null>(initial);
  const [f, setF] = useState({ name: "", role: "", email: "", phone: "", linkedin_url: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/contacts", "POST", { ...f, account_id: account?.id ?? null });
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={save}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name">
          <Input value={f.name} onChange={set("name")} required autoFocus />
        </Field>
        <Field label="Role">
          <Input value={f.role} onChange={set("role")} />
        </Field>
      </div>
      <Field label="Company">
        <AccountPicker value={account} onChange={setAccount} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email">
          <Input type="email" value={f.email} onChange={set("email")} />
        </Field>
        <Field label="Phone">
          <Input type="tel" value={f.phone} onChange={set("phone")} />
        </Field>
      </div>
      <Field label="LinkedIn">
        <Input value={f.linkedin_url} onChange={set("linkedin_url")} placeholder="linkedin.com/in/…" />
      </Field>
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end">
        <Button disabled={busy || !f.name.trim()}>Add contact</Button>
      </div>
    </form>
  );
}
