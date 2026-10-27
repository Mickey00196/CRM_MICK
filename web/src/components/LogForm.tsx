import { useEffect, useMemo, useState } from "react";
import { CHANNELS, OUTCOMES, suggestNextStep, type Channel, type ContactLite, type OpenTask } from "@shared/model";
import { api } from "@/lib/api";
import { toastMove } from "./Toast";
import { addDays, fromLocalInput, toLocalInput, todayISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Chips, ErrorText, Field, Input, Select, Textarea } from "@/components/ui/input";
import { AccountPicker, ProjectPicker, type PickedAccount, type PickedProject } from "./Pickers";
import { NextStepPicker, nextFromSuggestion, nextPayload, type NextStepValue } from "./NextStepPicker";
import type { LogPreset } from "./ui-context";

/** Open to-dos and people for whatever the entry is about (project first, else company). */
interface Scope {
  tasks: OpenTask[];
  contacts: ContactLite[];
}

const MESSAGE_CHANNELS: Channel[] = ["email", "linkedin", "whatsapp"];

/** Log a call, email, meeting, note… with an optional next step. */
export function LogForm({ preset, onSaved, onCancel }: { preset: LogPreset; onSaved: () => void; onCancel?: () => void }) {
  const [project, setProject] = useState<PickedProject | null>(preset.project ?? null);
  const [account, setAccount] = useState<PickedAccount | null>(preset.project ? null : preset.account ?? null);
  const [detail, setDetail] = useState<Scope | null>(null);
  const [channel, setChannel] = useState<Channel>(preset.channel ?? "call");
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [contactId, setContactId] = useState(preset.contact_id ?? "");
  const [when, setWhen] = useState(toLocalInput());
  const [whenTouched, setWhenTouched] = useState(false);
  const [closeTask, setCloseTask] = useState(true);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [expectReply, setExpectReply] = useState(false);
  const [next, setNext] = useState<NextStepValue>({ ...nextFromSuggestion(null), mode: "none" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existing = detail?.tasks[0] ?? null;
  // An open to-do this communication probably takes care of (same channel, due by today).
  const matching = useMemo(
    () => detail?.tasks.find((t) => t.type === channel && (!t.due_date || t.due_date <= addDays(todayISO(), 1))) ?? null,
    [detail, channel],
  );

  // Load contacts and the current next step for the chosen project or company.
  const scopePath = project ? `/projects/${project.id}` : account ? `/accounts/${account.id}` : null;
  useEffect(() => {
    setDetail(null);
    if (!scopePath) return;
    api<Scope>(scopePath).then((d) => {
      setDetail(d);
      setNext((n) => ({ ...n, mode: d.tasks.length > 1 || (d.tasks.length === 1 && d.tasks[0].type !== channel) ? "keep" : "new" }));
      if (!preset.contact_id && d.contacts.length === 1) setContactId(d.contacts[0].id);
    });
  }, [scopePath]); // eslint-disable-line react-hooks/exhaustive-deps

  const keepable = existing && !(matching && closeTask && matching.id === existing.id) ? existing : null;
  // If the current next step is being closed, ask for a new one instead of "keeping" it.
  useEffect(() => {
    if (next.mode === "keep" && !keepable && detail) setNext((n) => ({ ...n, mode: "new" }));
  }, [keepable, next.mode, detail]);

  const outcomes = OUTCOMES[channel];
  const isMessage = MESSAGE_CHANNELS.includes(channel);

  function pickChannel(c: Channel) {
    setChannel(c);
    setOutcome(null);
  }

  function pickOutcome(o: string) {
    setOutcome(o);
    const s = suggestNextStep(channel, o);
    if (s) setNext(nextFromSuggestion(s));
    if (o === "replied") setDirection("inbound");
  }

  const contact = useMemo(() => detail?.contacts.find((c) => c.id === contactId), [detail, contactId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!account && !project) return setError("Pick an account.");
    setBusy(true);
    setError(null);
    try {
      const res = await api("/activities", "POST", {
        project_id: project?.id ?? null,
        account_id: project ? null : account?.id ?? null,
        contact_id: contactId || null,
        channel,
        direction: channel === "note" ? "outbound" : direction,
        outcome,
        summary,
        occurred_at: whenTouched ? fromLocalInput(when) : null,
        complete_task_id: matching && closeTask ? matching.id : null,
        expect_reply: isMessage && direction === "outbound" && expectReply,
        next: nextPayload(next),
      });
      toastMove(res);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={save}>
      {!preset.account && !preset.project && (
        <div className="grid gap-3 sm:grid-cols-2">
          <AccountPicker value={account} onChange={setAccount} placeholder="Account" autoFocus />
        </div>
      )}

      <Chips options={CHANNELS} value={channel} onChange={pickChannel} size="sm" />

      <div className="grid gap-4 sm:grid-cols-2">
        {detail && detail.contacts.length > 0 && (
          <Field label="Contact">
            <Select value={contactId} onChange={(e) => setContactId(e.target.value)}>
              <option value="">No specific contact</option>
              {detail.contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.role ? ` · ${c.role}` : ""}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="When">
          <Input
            type="datetime-local"
            value={when}
            onChange={(e) => {
              setWhen(e.target.value);
              setWhenTouched(true);
            }}
          />
        </Field>
      </div>
      {contact?.do_not_contact && <p className="text-[13px] text-late">{contact.name} is marked do not contact.</p>}

      {channel !== "note" && (
        <Chips
          options={[
            { key: "outbound", label: "Outbound" },
            { key: "inbound", label: "Inbound" },
          ]}
          value={direction}
          onChange={setDirection}
          size="sm"
        />
      )}

      {outcomes.length > 0 && (
        <div className="grid gap-1.5">
          <span className="text-[13px] text-muted">Outcome</span>
          <Chips options={outcomes} value={outcome} onChange={pickOutcome} size="sm" />
        </div>
      )}

      <Field label={channel === "note" ? "Note" : "Summary"}>
        <Textarea
          rows={3}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder={channel === "note" ? "What should you remember?" : "What was said, what's agreed"}
          autoFocus={Boolean(preset.account || preset.project)}
        />
      </Field>

      {isMessage && direction === "outbound" && (
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={expectReply} onChange={(e) => setExpectReply(e.target.checked)} />
          Expect a reply
        </label>
      )}

      {matching && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={closeTask} onChange={(e) => setCloseTask(e.target.checked)} />
          <span>
            Mark <span className="font-medium">{matching.title}</span> as done
          </span>
        </label>
      )}

      {(account || project) && (
        <NextStepPicker
          value={next}
          onChange={setNext}
          existing={keepable}
        />
      )}

      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button disabled={busy}>Log {channel === "note" ? "note" : "communication"}</Button>
      </div>
    </form>
  );
}
