import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Mail, Phone, Link2, ArrowUpRight, Clock } from "lucide-react";
import {
  OUTCOMES,
  TASK_TYPES,
  channelForTaskType,
  channelLabel,
  outcomeLabel,
  suggestNextStep,
  taskTypeLabel,
  projectStageLabel,
  type TaskDetail,
  type TaskType,
} from "@shared/model";
import { api } from "@/lib/api";
import { addDays, daysBetween, dmy, m2, relative, todayISO, workday } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Chips, ErrorText, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/dropdown";
import { NextStepPicker, nextFromSuggestion, nextPayload, type NextStepValue } from "./NextStepPicker";
import { useUI } from "./ui-context";

type Step = "view" | "edit" | "complete";

export function TaskPanel({
  taskId,
  startWith = "view",
  onDone,
  onClose,
}: {
  taskId: string;
  startWith?: Step;
  onDone: (id: string) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<TaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(startWith);

  const load = () =>
    api<TaskDetail>(`/tasks/${taskId}`)
      .then(setData)
      .catch((e) => setError(e.message));

  useEffect(() => {
    setData(null);
    setStep(startWith);
    load();
  }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!data) return <div className="h-40" />;
  if (step === "complete") return <CompleteStep data={data} onBack={() => setStep("view")} onDone={() => onDone(taskId)} />;
  if (step === "edit") return <EditStep data={data} onBack={() => setStep("view")} onSaved={() => { setStep("view"); load(); }} onDeleted={() => onDone(taskId)} />;
  return <ViewStep data={data} onComplete={() => setStep("complete")} onEdit={() => setStep("edit")} onClose={onClose} onSnoozed={() => onDone(taskId)} />;
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-4">
      <h3 className="mb-1.5 text-[13px] text-muted">{label}</h3>
      {children}
    </section>
  );
}

function DueLine({ due, time }: { due: string | null; time: string | null }) {
  if (!due) return <p className="text-sm text-muted">No due date</p>;
  const late = daysBetween(due, todayISO());
  return (
    <p className="text-sm text-muted">
      Due {dmy(due)}
      {time && ` at ${time}`}
      {late > 0 && <span className="text-late"> · {late === 1 ? "1 day" : `${late} days`} overdue</span>}
    </p>
  );
}

function ViewStep({
  data,
  onComplete,
  onEdit,
  onClose,
  onSnoozed,
}: {
  data: TaskDetail;
  onComplete: () => void;
  onEdit: () => void;
  onClose: () => void;
  onSnoozed: () => void;
}) {
  const { task, account, project, contact, last_activity: last, office } = data;
  const ui = useUI();
  const today = todayISO();

  async function snooze(date: string) {
    await api(`/tasks/${task.id}`, "PATCH", { snooze_until: date });
    onSnoozed();
  }

  return (
    <div>
      <p className="label">
        {taskTypeLabel(task.type)}
        {task.priority === "high" && <span className="text-late"> · High priority</span>}
      </p>
      <h2 className="title mt-1 text-xl">{task.title}</h2>
      <div className="mt-1">
        <DueLine due={task.due_date} time={task.due_time} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={onComplete}>Complete</Button>
        <Menu>
          <MenuTrigger asChild>
            <Button variant="outline">
              <Clock /> Snooze
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={() => snooze(workday(addDays(today, 1)))}>Tomorrow</MenuItem>
            <MenuItem onSelect={() => snooze(workday(addDays(today, 2)))}>In 2 days</MenuItem>
            <MenuItem onSelect={() => snooze(workday(addDays(today, 7)))}>Next week</MenuItem>
            <MenuItem onSelect={() => snooze(workday(addDays(today, 14)))}>In 2 weeks</MenuItem>
            <div className="px-2.5 py-1.5">
              <Input type="date" className="h-8" min={today} onChange={(e) => e.target.value && snooze(e.target.value)} aria-label="Snooze until" />
            </div>
          </MenuContent>
        </Menu>
        {(account || project) && (
          <Button
            variant="outline"
            onClick={() =>
              ui.openLog({
                project: project ? { id: project.id, name: project.name } : null,
                account: account ? { id: account.id, name: account.name } : null,
                contact_id: contact?.id ?? null,
                channel: channelForTaskType(task.type) ?? "note",
              })
            }
          >
            Log something
          </Button>
        )}
      </div>

      <div className="mt-6">
        {project && (
          <Section label="Project">
            <Link to={`/projects/${project.id}`} onClick={onClose} className="inline-flex items-center gap-1 font-medium hover:text-accent-text">
              {project.name} <ArrowUpRight className="size-3.5 text-faint" />
            </Link>
            <span className="ml-2 text-sm text-muted">{projectStageLabel(project.stage)}</span>
          </Section>
        )}

        {account && (
          <Section label="Account">
            <Link to={`/accounts/${account.id}`} onClick={onClose} className="inline-flex items-center gap-1 font-medium hover:text-accent-text">
              {account.name} <ArrowUpRight className="size-3.5 text-faint" />
            </Link>
          </Section>
        )}

        {contact && (
          <Section label="Contact">
            <p className="font-medium">
              <Link to={`/contacts/${contact.id}`} onClick={onClose} className="hover:text-accent-text">
                {contact.name}
              </Link>
              {contact.role && <span className="font-normal text-muted"> · {contact.role}</span>}
            </p>
            {contact.do_not_contact && <p className="text-[13px] text-late">Do not contact</p>}
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {contact.phone && (
                <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 text-muted hover:text-fg">
                  <Phone className="size-3.5" /> {contact.phone}
                </a>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1.5 text-muted hover:text-fg">
                  <Mail className="size-3.5" /> {contact.email}
                </a>
              )}
              {contact.linkedin_url && (
                <a
                  href={contact.linkedin_url.startsWith("http") ? contact.linkedin_url : `https://${contact.linkedin_url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-muted hover:text-fg"
                >
                  <Link2 className="size-3.5" /> LinkedIn
                </a>
              )}
            </div>
          </Section>
        )}

        {(account || project) && last && (
          <Section label="Last update">
            {last ? (
              <>
                <p className="text-sm">
                  {channelLabel(last.channel)}
                  {last.direction === "inbound" && " (inbound)"} · {dmy(last.occurred_at)}
                  {last.outcome && ` · ${outcomeLabel(last.channel, last.outcome)}`}
                  {last.contact_name && <span className="text-muted"> · {last.contact_name}</span>}
                </p>
                {last.summary && <p className="mt-1 line-clamp-3 text-sm text-muted">{last.summary}</p>}
              </>
            ) : (
              <p className="text-sm text-muted">Nothing logged yet.</p>
            )}
          </Section>
        )}

        {office && (
          <Section label="Office">
            <p className="text-sm">
              {[office.building_name, office.submarket, office.city].filter(Boolean).join(", ") || "Location unknown"}
              {office.area_m2 != null && <span className="text-muted"> · {m2(office.area_m2)}</span>}
            </p>
            {office.lease_end && (
              <p className="text-sm text-muted">
                Lease ends {dmy(office.lease_end)} ({relative(office.lease_end)})
              </p>
            )}
          </Section>
        )}

        {task.notes && (
          <Section label="Notes">
            <p className="whitespace-pre-wrap text-sm">{task.notes}</p>
          </Section>
        )}

        <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-4 text-sm">
          {contact?.email && !contact.do_not_contact && (
            <a href={`mailto:${contact.email}`} className="text-muted hover:text-fg">
              Write email
            </a>
          )}
          <button className="text-muted hover:text-fg" onClick={onEdit}>
            Edit to-do
          </button>
        </div>
      </div>
    </div>
  );
}

function CompleteStep({ data, onBack, onDone }: { data: TaskDetail; onBack: () => void; onDone: () => void }) {
  const { task, contacts } = data;
  const channel = channelForTaskType(task.type);
  const outcomes = channel ? OUTCOMES[channel] : [];
  const [outcome, setOutcome] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [contactId, setContactId] = useState(task.contact_id ?? "");
  const [next, setNext] = useState<NextStepValue>(() =>
    data.other_open_tasks > 0 || (!task.account_id && !task.project_id)
      ? { ...nextFromSuggestion(null), mode: "none" }
      : nextFromSuggestion(null, { type: task.type as TaskType, title: "Follow up" }),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickOutcome(o: string) {
    setOutcome(o);
    const s = suggestNextStep(channel!, o);
    if (s) setNext(nextFromSuggestion(s));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/tasks/${task.id}/complete`, "POST", {
        outcome,
        note,
        contact_id: contactId || null,
        next: nextPayload(next),
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const needsOutcome = outcomes.length > 0 && !outcome;

  return (
    <form onSubmit={save} className="grid gap-6">
      <div>
        <p className="label">{taskTypeLabel(task.type)}</p>
        <h2 className="title mt-1 text-xl">How did it go?</h2>
        <p className="mt-1 text-sm text-muted">
          {task.title}
          {(task.account_name ?? task.project_name) && ` · ${task.account_name ?? task.project_name}`}
        </p>
      </div>

      {outcomes.length > 0 && <Chips options={outcomes} value={outcome} onChange={pickOutcome} />}

      {contacts.length > 1 && (
        <Field label="Who">
          <Select value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">No specific contact</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.role ? ` · ${c.role}` : ""}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Note">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="One line on what happened" autoFocus={!outcomes.length} />
      </Field>

      {(task.account_id || task.project_id) && (
        <NextStepPicker
          value={next}
          onChange={setNext}
          noneHint={
            data.other_open_tasks > 0
              ? "another to-do is still open"
              : task.account_id
                ? "the account will show as having no follow-up"
                : data.project && data.project.stage !== "done"
                  ? "the project will show as having no next step"
                  : undefined
          }
        />
      )}

      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button disabled={busy || needsOutcome} title={needsOutcome ? "Pick an outcome first" : undefined}>
          Complete
        </Button>
      </div>
    </form>
  );
}

function EditStep({
  data,
  onBack,
  onSaved,
  onDeleted,
}: {
  data: TaskDetail;
  onBack: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const { task, contacts } = data;
  const [f, setF] = useState({
    title: task.title,
    type: task.type,
    due_date: task.due_date ?? "",
    due_time: task.due_time ?? "",
    priority: task.priority,
    contact_id: task.contact_id ?? "",
    notes: task.notes,
  });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api(`/tasks/${task.id}`, "PATCH", { ...f, contact_id: f.contact_id || null });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove() {
    if (!confirm("Delete this to-do?")) return;
    await api(`/tasks/${task.id}`, "DELETE");
    onDeleted();
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <h2 className="title text-xl">Edit to-do</h2>
      <Field label="To-do">
        <Input value={f.title} onChange={set("title")} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <Select value={f.type} onChange={set("type")}>
            {TASK_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={f.priority} onChange={set("priority")}>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </Select>
        </Field>
        <Field label="Due date">
          <Input type="date" value={f.due_date} onChange={set("due_date")} />
        </Field>
        <Field label="Time">
          <Input type="time" value={f.due_time} onChange={set("due_time")} />
        </Field>
      </div>
      {contacts.length > 0 && (
        <Field label="Contact">
          <Select value={f.contact_id} onChange={set("contact_id")}>
            <option value="">No specific contact</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Notes">
        <Textarea rows={3} value={f.notes} onChange={set("notes")} />
      </Field>
      <ErrorText>{error}</ErrorText>
      <div className="flex items-center justify-between">
        <Button type="button" variant="danger" size="sm" onClick={remove}>
          Delete
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onBack}>
            Cancel
          </Button>
          <Button>Save</Button>
        </div>
      </div>
    </form>
  );
}
