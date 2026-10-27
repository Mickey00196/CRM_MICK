import { useState } from "react";
import { BUYING_ROLES, LANGUAGES, type Contact } from "@shared/model";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ErrorText, Field, Input, Select, Textarea } from "@/components/ui/input";

export function ContactForm({ accountId, contact, onDone }: { accountId: string | null; contact?: Contact; onDone: () => void }) {
  const [f, setF] = useState({
    name: contact?.name ?? "",
    role: contact?.role ?? "",
    buying_role: contact?.buying_role ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    linkedin_url: contact?.linkedin_url ?? "",
    language: contact?.language ?? "",
    lawful_basis: contact?.lawful_basis ?? "legitimate_interest",
    do_not_contact: contact?.do_not_contact ?? false,
    notes: contact?.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (contact) await api(`/contacts/${contact.id}`, "PATCH", f);
      else await api("/contacts", "POST", { ...f, account_id: accountId });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove() {
    if (!contact || !confirm(`Remove ${contact.name}? Their logged communication stays on the account.`)) return;
    await api(`/contacts/${contact.id}`, "DELETE");
    onDone();
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name">
          <Input value={f.name} onChange={set("name")} required autoFocus />
        </Field>
        <Field label="Role">
          <Input value={f.role} onChange={set("role")} />
        </Field>
        <Field label="Buying role">
          <Select value={f.buying_role} onChange={set("buying_role")}>
            <option value="">–</option>
            {BUYING_ROLES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Language">
          <Select value={f.language} onChange={set("language")}>
            <option value="">Same as account</option>
            {LANGUAGES.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </Select>
        </Field>
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
      <Field label="Notes">
        <Textarea rows={3} value={f.notes} onChange={set("notes")} />
      </Field>
      <div className="grid grid-cols-2 items-end gap-3">
        <Field label="Lawful basis">
          <Select value={f.lawful_basis} onChange={set("lawful_basis")}>
            <option value="legitimate_interest">Legitimate interest</option>
            <option value="consent">Consent</option>
            <option value="contract">Contract</option>
          </Select>
        </Field>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--late)]" checked={f.do_not_contact} onChange={(e) => setF({ ...f, do_not_contact: e.target.checked })} />
          Do not contact
        </label>
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="flex items-center justify-between">
        {contact ? (
          <Button type="button" variant="danger" size="sm" onClick={remove}>
            Remove contact
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button>{contact ? "Save" : "Add contact"}</Button>
        </div>
      </div>
    </form>
  );
}
