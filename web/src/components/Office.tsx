import { useState, type ReactNode } from "react";
import { GROWTH, TENURES, tenureLabel, type OfficeLocation } from "@shared/model";
import { leaseInfo } from "@shared/lease";
import { api } from "@/lib/api";
import { daysBetween, dmy, m2, money, num, relative, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ErrorText, Field, Input, Select, Textarea } from "@/components/ui/input";

export function officeTitle(o: Pick<OfficeLocation, "building_name" | "address" | "submarket" | "city">): string {
  return o.building_name || o.address || [o.submarket, o.city].filter(Boolean).join(", ") || "Office";
}

/** Lease start → end, with today, breaks and notice deadlines marked. */
export function LeaseBar({ office }: { office: OfficeLocation }) {
  const today = todayISO();
  const { lease_start: start, lease_end: end } = office;
  if (!end) return null;
  const info = leaseInfo(office, today);
  const from = start ?? (today < end ? today : end);
  const span = Math.max(daysBetween(from, end), 1);
  const pos = (d: string) => Math.min(100, Math.max(0, (daysBetween(from, d) / span) * 100));
  const todayPos = pos(today);
  const windowPos = info.decisionWindowOpens ? pos(info.decisionWindowOpens) : null;

  const marks = info.keyDates.filter((k) => k.label !== "Lease end" && k.date >= from && k.date <= end);

  return (
    <div className="mt-6">
      <div className="relative h-1.5 rounded-full bg-subtle">
        {windowPos !== null && windowPos < 100 && (
          <div className="absolute inset-y-0 right-0 rounded-r-full bg-accent-soft" style={{ left: `${windowPos}%` }} title={`Decision window opens ${dmy(info.decisionWindowOpens)}`} />
        )}
        <div className="absolute inset-y-0 left-0 rounded-l-full bg-line-strong" style={{ width: `${todayPos}%` }} />
        {marks.map((k) => (
          <span
            key={k.label + k.date}
            className={cn("absolute top-1/2 h-3 w-px -translate-y-1/2", k.label.includes("notice") || k.label.includes("Notice") ? "bg-late" : "bg-fg")}
            style={{ left: `${pos(k.date)}%` }}
            title={`${k.label} · ${dmy(k.date)}`}
          />
        ))}
        {today >= from && today <= end && (
          <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-fg" style={{ left: `${todayPos}%` }} title="Today" />
        )}
      </div>
      <div className="mt-2 flex justify-between text-xs text-faint">
        <span>{start ? dmy(start) : "Start unknown"}</span>
        <span>{dmy(end)}</span>
      </div>
      {marks.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {marks.map((k) => (
            <li key={k.label + k.date} className="flex items-center gap-1.5">
              <span className={cn("h-2.5 w-px", k.label.toLowerCase().includes("notice") ? "bg-late" : "bg-fg")} />
              {k.label} {dmy(k.date)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  if (children === "" || children === null || children === undefined) return null;
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

/** Summary card with the computed lease view. */
export function OfficeCard({ office, onEdit, compact }: { office: OfficeLocation; onEdit?: () => void; compact?: boolean }) {
  const today = todayISO();
  const info = leaseInfo(office, today);
  const remaining =
    office.lease_end && office.lease_end >= today ? `Lease ends ${relative(office.lease_end, today)}` : office.lease_end ? `Lease ended ${dmy(office.lease_end)}` : null;
  const noticeSoon = info.nextKeyDate?.label.toLowerCase().includes("notice") && daysBetween(today, info.nextKeyDate.date) <= 180;

  return (
    <article className="border-t border-line pt-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-medium">
            {officeTitle(office)}
            {office.is_primary && office.is_current && <span className="ml-2 text-[13px] font-normal text-faint">Primary</span>}
            {!office.is_current && <span className="ml-2 text-[13px] font-normal text-faint">Previous</span>}
          </h3>
          {(() => {
            // Only what the title didn't already say.
            const title = officeTitle(office);
            const rest = [office.building_name ? office.address : "", office.postcode, office.submarket, office.city].filter(
              (p) => p && !title.includes(p),
            );
            return rest.length > 0 && <p className="text-sm text-muted">{rest.join(", ")}</p>;
          })()}
        </div>
        {onEdit && (
          <Button variant="ghost" size="xs" onClick={onEdit}>
            Edit
          </Button>
        )}
      </div>

      {(remaining || info.nextKeyDate) && (
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          {remaining && <p>{remaining}</p>}
          {info.nextKeyDate && info.nextKeyDate.label !== "Lease end" && (
            <p className={noticeSoon ? "text-late" : "text-muted"}>
              Next: {info.nextKeyDate.label.toLowerCase()} {dmy(info.nextKeyDate.date)}
            </p>
          )}
          {info.decisionWindowOpens && (
            <p className="text-muted">
              {info.inDecisionWindow ? "Decision window open" : `Decision window opens ${dmy(info.decisionWindowOpens)}`}
            </p>
          )}
        </div>
      )}

      <LeaseBar office={office} />

      <dl className={cn("mt-6 grid gap-x-6 gap-y-4", compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-4")}>
        <Fact label="Floor area">{m2(office.area_m2)}</Fact>
        <Fact label="Workstations">{num(office.workstations)}</Fact>
        <Fact label="Headcount">{num(office.headcount)}</Fact>
        <Fact label="Tenure">{tenureLabel(office.tenure)}</Fact>
        {!compact && (
          <>
            <Fact label="Landlord">{office.landlord}</Fact>
            <Fact label="Notice">{office.notice_months != null ? `${office.notice_months} months` : ""}</Fact>
            <Fact label="Rent">{office.rent_per_m2 != null ? `${money(office.rent_per_m2)} /m²/yr` : ""}</Fact>
            <Fact label="Annual rent">{money(office.annual_rent)}</Fact>
            <Fact label="Hybrid policy">{office.hybrid_policy}</Fact>
            <Fact label="Satisfaction">{office.satisfaction ? `${office.satisfaction} / 5` : ""}</Fact>
            <Fact label="Growth">{GROWTH.find((g) => g.key === office.growth_outlook)?.label ?? ""}</Fact>
            <Fact label="RE decision maker">{office.re_decision_maker}</Fact>
          </>
        )}
      </dl>
      {!compact && office.pain_points && (
        <div className="mt-4">
          <p className="text-[13px] text-muted">Pain points</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm">{office.pain_points}</p>
        </div>
      )}
    </article>
  );
}

type Form = Record<string, string | boolean | string[]>;

/** Zero or more dates. */
function DateList({ value: dates, onChange: update }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="grid gap-2">
      {dates.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input type="date" value={d} onChange={(e) => update(dates.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Break date ${i + 1}`} />
          <button type="button" onClick={() => update(dates.filter((_, j) => j !== i))} className="shrink-0 px-1 text-sm text-faint hover:text-late" aria-label="Remove date">
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={() => update([...dates, ""])} className="justify-self-start text-sm text-muted hover:text-fg">
        + Add break date
      </button>
    </div>
  );
}

function toForm(o: Partial<OfficeLocation>): Form {
  const out: Form = {};
  for (const [k, v] of Object.entries(o)) {
    if (k === "break_dates") out[k] = [...((v as string[]) ?? [])];
    else if (typeof v === "boolean") out[k] = v;
    else out[k] = v == null ? "" : String(v);
  }
  return out;
}

const SECTIONS: { title: string; fields: { key: string; label: string; type?: string; wide?: boolean; options?: readonly { key: string; label: string }[]; hint?: string; area?: boolean }[] }[] = [
  {
    title: "Location",
    fields: [
      { key: "building_name", label: "Building" },
      { key: "address", label: "Address" },
      { key: "postcode", label: "Postcode" },
      { key: "city", label: "City" },
      { key: "submarket", label: "Area / submarket" },
      { key: "floors", label: "Floor(s)" },
    ],
  },
  {
    title: "Space",
    fields: [
      { key: "area_m2", label: "Floor area (m²)", type: "num" },
      { key: "workstations", label: "Workstations", type: "num" },
      { key: "headcount", label: "Headcount", type: "num" },
      { key: "meeting_rooms", label: "Meeting rooms", type: "num" },
      { key: "parking_spaces", label: "Parking spaces", type: "num" },
      { key: "hybrid_policy", label: "Hybrid policy", hint: "e.g. 3 days in office" },
      { key: "fit_out_condition", label: "Quality / fit-out", wide: true },
    ],
  },
  {
    title: "Lease",
    fields: [
      { key: "tenure", label: "Tenure", options: TENURES },
      { key: "landlord", label: "Landlord" },
      { key: "landlord_agent", label: "Landlord's agent" },
      { key: "lease_start", label: "Lease start", type: "date" },
      { key: "lease_end", label: "Lease end", type: "date" },
      { key: "initial_term_months", label: "Initial term (months)", type: "num" },
      { key: "notice_months", label: "Notice period (months)", type: "num" },
      { key: "break_dates", label: "Break option dates", type: "dates" },
      { key: "sublet_allowed", label: "Sublet allowed", options: [{ key: "true", label: "Yes" }, { key: "false", label: "No" }] },
      { key: "renewal_options", label: "Renewal options", wide: true },
    ],
  },
  {
    title: "Financials",
    fields: [
      { key: "rent_per_m2", label: "Rent (€/m²/year)", type: "num" },
      { key: "annual_rent", label: "Total annual rent (€)", type: "num" },
      { key: "service_charges", label: "Service charges (€/year)", type: "num" },
      { key: "parking_rent", label: "Parking rent (€/year)", type: "num" },
      { key: "indexation", label: "Indexation", hint: "e.g. CPI" },
      { key: "rent_free_months", label: "Rent-free months", type: "num" },
      { key: "fitout_contribution", label: "Fit-out contribution (€)", type: "num" },
      { key: "guarantee", label: "Bank guarantee / deposit" },
    ],
  },
  {
    title: "Situation",
    fields: [
      { key: "satisfaction", label: "Satisfaction", options: [1, 2, 3, 4, 5].map((n) => ({ key: String(n), label: `${n} / 5` })) },
      { key: "growth_outlook", label: "Growth outlook", options: GROWTH },
      { key: "re_decision_maker", label: "Who decides on real estate", wide: true },
      { key: "pain_points", label: "Pain points", wide: true, area: true },
      { key: "notes", label: "Notes", wide: true, area: true },
    ],
  },
];

/** Sectioned edit form. Every field is optional. */
export function OfficeForm({
  accountId,
  office,
  onDone,
}: {
  accountId: string;
  office?: OfficeLocation;
  onDone: () => void;
}) {
  const [f, setF] = useState<Form>(() => toForm(office ?? { is_current: true, city: "Amsterdam" }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = {};
    for (const s of SECTIONS) for (const fld of s.fields) body[fld.key] = f[fld.key] ?? "";
    body.break_dates = ((f.break_dates as string[]) ?? []).filter(Boolean);
    body.sublet_allowed = f.sublet_allowed === "" || f.sublet_allowed === undefined ? null : f.sublet_allowed === "true" || f.sublet_allowed === true;
    body.is_current = f.is_current !== false;
    if (f.is_primary === true) body.is_primary = true;
    try {
      if (office) await api(`/offices/${office.id}`, "PATCH", body);
      else await api(`/accounts/${accountId}/offices`, "POST", body);
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!office || !confirm("Delete this location?")) return;
    await api(`/offices/${office.id}`, "DELETE");
    onDone();
  }

  return (
    <form onSubmit={save} className="grid gap-10">
      {SECTIONS.map((s) => (
        <fieldset key={s.title} className="grid gap-4">
          <legend className="label mb-4">{s.title}</legend>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {s.fields.map((fld) => (
              <Field key={fld.key} label={fld.label} hint={fld.hint} className={fld.wide ? "sm:col-span-2 lg:col-span-3" : undefined}>
                {fld.type === "dates" ? (
                  <DateList value={(f[fld.key] as string[]) ?? []} onChange={(v) => setF({ ...f, [fld.key]: v })} />
                ) : fld.options ? (
                  <Select value={String(f[fld.key] ?? "")} onChange={set(fld.key)}>
                    <option value="">–</option>
                    {fld.options.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                ) : fld.area ? (
                  <Textarea rows={3} value={String(f[fld.key] ?? "")} onChange={set(fld.key)} />
                ) : (
                  <Input
                    type={fld.type === "date" ? "date" : "text"}
                    inputMode={fld.type === "num" ? "decimal" : undefined}
                    value={String(f[fld.key] ?? "")}
                    onChange={set(fld.key)}
                  />
                )}
              </Field>
            ))}
          </div>
        </fieldset>
      ))}

      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="size-4 accent-[var(--fg)]" checked={f.is_current !== false} onChange={(e) => setF({ ...f, is_current: e.target.checked })} />
          Current location
        </label>
        {!office?.is_primary && (
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-4 accent-[var(--fg)]" checked={f.is_primary === true} onChange={(e) => setF({ ...f, is_primary: e.target.checked })} />
            Make primary
          </label>
        )}
      </div>

      <ErrorText>{error}</ErrorText>
      <div className="flex items-center justify-between border-t border-line pt-5">
        {office ? (
          <Button type="button" variant="danger" size="sm" onClick={remove}>
            Delete location
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button disabled={busy}>{office ? "Save location" : "Add location"}</Button>
        </div>
      </div>
    </form>
  );
}
