import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ACCOUNT_STATUSES, LANGUAGES, type Account } from "@shared/model";
import { api, ApiError } from "@/lib/api";
import { addDays, todayISO, workday } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Chips, ErrorText, Field, Input } from "@/components/ui/input";
import { NextStepPicker, nextPayload, type NextStepValue } from "./NextStepPicker";

/** Fast new-account form: name, office basics and a first next step. Everything else can wait. */
export function AccountForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const [f, setF] = useState({
    name: "",
    website: "",
    status: "lead",
    language: "nl",
    city: "Amsterdam",
    submarket: "",
    area_m2: "",
    lease_end: "",
    contact_name: "",
    contact_role: "",
  });
  const [next, setNext] = useState<NextStepValue>({
    mode: "none",
    type: "call",
    title: "Intro call",
    due_date: workday(addDays(todayISO(), 1)),
    due_time: "",
  });
  const [dupe, setDupe] = useState<{ id: string; name: string; canForce: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function save(force = false) {
    setBusy(true);
    setError(null);
    try {
      const acc = await api<Account>("/accounts", "POST", {
        name: f.name,
        website: f.website,
        status: f.status,
        language: f.language,
        office: { city: f.city, submarket: f.submarket, area_m2: f.area_m2, lease_end: f.lease_end },
        contact: f.contact_name ? { name: f.contact_name, role: f.contact_role } : undefined,
        next: nextPayload(next),
        force,
      });
      onDone();
      navigate(`/accounts/${acc.id}`);
    } catch (err) {
      const e = err as ApiError;
      if (e.status === 409 && e.data.existing_id) setDupe({ id: e.data.existing_id, name: e.data.existing_name, canForce: Boolean(e.data.can_force) });
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Field label="Company name">
        <Input value={f.name} onChange={set("name")} required autoFocus placeholder="Company name" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Field label="Website">
          <Input value={f.website} onChange={set("website")} placeholder="example.nl" />
        </Field>
        <Field label="Language">
          <Chips options={LANGUAGES.map((l) => ({ key: l.key, label: l.key.toUpperCase() }))} value={f.language} onChange={(v) => setF({ ...f, language: v })} />
        </Field>
      </div>
      <Chips options={ACCOUNT_STATUSES.slice(0, 3)} value={f.status} onChange={(v) => setF({ ...f, status: v })} size="sm" />

      <div className="grid gap-3">
        <span className="text-[13px] text-muted">Office</span>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Input value={f.city} onChange={set("city")} placeholder="City" aria-label="City" />
          <Input value={f.submarket} onChange={set("submarket")} placeholder="Area, e.g. Zuidas" aria-label="Area" />
          <Input value={f.area_m2} onChange={set("area_m2")} placeholder="m²" inputMode="numeric" aria-label="Floor area in m²" />
          <Input type="date" value={f.lease_end} onChange={set("lease_end")} aria-label="Lease end" title="Lease end" />
        </div>
      </div>

      <div className="grid gap-3">
        <span className="text-[13px] text-muted">First contact (optional)</span>
        <div className="grid grid-cols-2 gap-3">
          <Input value={f.contact_name} onChange={set("contact_name")} placeholder="Name" aria-label="Contact name" />
          <Input value={f.contact_role} onChange={set("contact_role")} placeholder="Role" aria-label="Contact role" />
        </div>
      </div>

      <NextStepPicker value={next} onChange={setNext} />

      <ErrorText>{error}</ErrorText>
      {dupe && (
        <div className="flex flex-wrap gap-3 text-sm">
          <button
            type="button"
            className="text-accent-text hover:underline"
            onClick={() => {
              onDone();
              navigate(`/accounts/${dupe.id}`);
            }}
          >
            Open {dupe.name}
          </button>
          {dupe.canForce && (
            <button type="button" className="text-muted hover:text-fg" onClick={() => save(true)}>
              Create anyway
            </button>
          )}
        </div>
      )}
      <div className="flex justify-end">
        <Button disabled={busy || !f.name.trim()}>Add account</Button>
      </div>
    </form>
  );
}
