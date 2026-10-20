import { useState } from "react";
import { TASK_TYPES, type TaskType } from "@shared/model";
import { api } from "@/lib/api";
import { addDays, todayISO, workday } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Chips, ErrorText, Field, Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AccountPicker, type PickedAccount } from "./AccountPicker";
import { AccountForm } from "./AccountForm";
import { LogForm } from "./LogForm";
import type { CaptureKind } from "./ui-context";

const KINDS: { key: CaptureKind; label: string }[] = [
  { key: "todo", label: "To-do" },
  { key: "log", label: "Communication" },
  { key: "account", label: "Account" },
  { key: "contact", label: "Contact" },
];

export function QuickCapture({
  open,
  kind,
  account,
  onKind,
  onClose,
}: {
  open: boolean;
  kind: CaptureKind;
  account: PickedAccount | null;
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
        {kind === "todo" && <TodoForm account={account} onDone={onClose} />}
        {kind === "log" && <LogForm key={account?.id ?? "none"} preset={{ account }} onSaved={onClose} />}
        {kind === "account" && <AccountForm onDone={onClose} />}
        {kind === "contact" && <ContactQuickForm account={account} onDone={onClose} />}
      </div>
    </Dialog>
  );
}

const DUE = [
  { key: "0", label: "Today" },
  { key: "1", label: "Tomorrow" },
  { key: "7", label: "Next week" },
] as const;

function TodoForm({ account: initial, onDone }: { account: PickedAccount | null; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskType>("todo");
  const [account, setAccount] = useState<PickedAccount | null>(initial);
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
      await api("/tasks", "POST", { title, type, due_date: due || null, account_id: account?.id ?? null });
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
        <AccountPicker value={account} onChange={setAccount} placeholder="Account (optional)" />
        <Select value={type} onChange={(e) => setType(e.target.value as TaskType)} aria-label="Type">
          {TASK_TYPES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Chips
          options={DUE}
          value={presetKey}
          onChange={(k) => setDue(k === "0" ? today : workday(addDays(today, Number(k))))}
          size="sm"
        />
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-7 w-auto px-2 text-[13px]" aria-label="Due date" />
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end">
        <Button disabled={busy || !title.trim()}>Add to-do</Button>
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
      await api("/contacts", "POST", { ...f, account_id: account?.id ?? null, lawful_basis: "legitimate_interest" });
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
      <Field label="Account">
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
