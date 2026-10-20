import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Phone, Mail, Link2, Users, StickyNote, Plus, MoreHorizontal, ArrowLeft } from "lucide-react";
import {
  ACCOUNT_STATUSES,
  BUYING_ROLES,
  CHANNELS,
  ICP_FIT,
  LANGUAGES,
  SIZE_BANDS,
  buyingRoleLabel,
  taskTypeLabel,
  type AccountDetail,
  type ActivityRow,
  type Channel,
  type Contact,
} from "@shared/model";
import { api, useLoad } from "@/lib/api";
import { dmy, relative, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ErrorText, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/dropdown";
import { Tabs, TabList, TabPanelBody } from "@/components/ui/tabs";
import { Sheet } from "@/components/ui/dialog";
import { useUI } from "@/components/ui-context";
import { Timeline } from "@/components/Timeline";
import { OfficeCard, OfficeForm } from "@/components/Office";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "office", label: "Office & lease" },
  { value: "communication", label: "Communication" },
];

export function AccountPage() {
  const id = useParams().id!;
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get("tab")) ? params.get("tab")! : "overview";
  const { data, error } = useLoad(() => api<AccountDetail>(`/accounts/${id}`), [id]);
  const ui = useUI();

  if (error)
    return (
      <div className="mx-auto max-w-4xl">
        <p className="text-sm text-late">{error}</p>
        <Link to="/accounts" className="mt-3 inline-block text-sm text-muted hover:text-fg">
          Back to accounts
        </Link>
      </div>
    );
  if (!data) return null;

  const { account } = data;
  const picked = { id: account.id, name: account.name };
  const log = (channel: Channel) => ui.openLog({ account: picked, channel });

  return (
    <div className="mx-auto max-w-4xl" data-account-id={account.id} data-account-name={account.name}>
      <Link to="/accounts" className="mb-6 inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> Accounts
      </Link>

      <Header data={data} />

      <div className="mt-6 flex flex-wrap gap-1.5">
        <Button variant="outline" size="sm" onClick={() => log("call")}>
          <Phone /> Log call
        </Button>
        <Button variant="outline" size="sm" onClick={() => log("email")}>
          <Mail /> Log email
        </Button>
        <Button variant="outline" size="sm" onClick={() => log("linkedin")}>
          <Link2 /> Log LinkedIn
        </Button>
        <Button variant="outline" size="sm" onClick={() => log("meeting")}>
          <Users /> Log meeting
        </Button>
        <Button variant="outline" size="sm" onClick={() => log("note")}>
          <StickyNote /> Add note
        </Button>
        <Button variant="outline" size="sm" onClick={() => ui.openCapture("todo", { account: picked })}>
          <Plus /> Add to-do
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams(v === "overview" ? {} : { tab: v }, { replace: true })} className="mt-10">
        <TabList tabs={TABS} />
        <TabPanelBody value="overview">
          <Overview data={data} />
        </TabPanelBody>
        <TabPanelBody value="office">
          <Offices data={data} />
        </TabPanelBody>
        <TabPanelBody value="communication">
          <Communication data={data} />
        </TabPanelBody>
      </Tabs>
    </div>
  );
}

// ---------- header ----------

function Header({ data }: { data: AccountDetail }) {
  const { account, tasks } = data;
  const next = tasks[0];
  const ui = useUI();
  const navigate = useNavigate();
  const today = todayISO();
  const needsStep = !next && ["prospect", "client"].includes(account.status);

  async function setStatus(status: string) {
    await api(`/accounts/${account.id}`, "PATCH", { status });
  }

  async function archive() {
    if (!confirm(`Archive ${account.name}? It disappears from lists and to-dos; you can restore it from Settings.`)) return;
    await api(`/accounts/${account.id}`, "DELETE");
    navigate("/accounts");
  }

  return (
    <header>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="title text-3xl">{account.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <Select
              value={account.status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-7 w-auto border-transparent bg-transparent pl-0 pr-6 text-sm text-muted [field-sizing:content] hover:text-fg"
              aria-label="Status"
            >
              {ACCOUNT_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </Select>
            {account.domain && (
              <a href={`https://${account.domain}`} target="_blank" rel="noreferrer" className="hover:text-fg">
                {account.domain}
              </a>
            )}
            <span>{account.language.toUpperCase()}</span>
            {data.last_contact_at && <span>Last contact {relative(data.last_contact_at)}</span>}
          </div>
        </div>
        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More">
              <MoreHorizontal />
            </Button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem onSelect={archive}>Archive account</MenuItem>
          </MenuContent>
        </Menu>
      </div>

      <div className="mt-8 border-y border-line py-4">
        <p className="mb-1 text-[13px] text-muted">Next step</p>
        {next ? (
          <button onClick={() => ui.openTask(next.id)} className="group flex w-full items-baseline justify-between gap-4 text-left">
            <span className="text-lg group-hover:text-accent">
              {next.title} <span className="text-sm text-muted">· {taskTypeLabel(next.type)}</span>
            </span>
            <span className={cn("shrink-0 text-sm", next.due_date && next.due_date < today ? "text-late" : "text-muted")}>
              {next.due_date ? dmy(next.due_date) : "No date"}
              {next.due_time && ` ${next.due_time}`}
            </span>
          </button>
        ) : (
          <div className="flex items-baseline justify-between gap-4">
            <span className={cn("text-lg", needsStep ? "text-missing" : "text-muted")}>No next step</span>
            <button onClick={() => ui.openCapture("todo", { account: { id: account.id, name: account.name } })} className="text-sm text-accent hover:underline">
              Set next step
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

// ---------- overview ----------

function Overview({ data }: { data: AccountDetail }) {
  const { account, offices, contacts, tasks } = data;
  const ui = useUI();
  const primary = offices.find((o) => o.is_primary && o.is_current) ?? offices.find((o) => o.is_current);
  const [editing, setEditing] = useState(false);
  const [contactForm, setContactForm] = useState<Contact | "new" | null>(null);
  const today = todayISO();

  return (
    <div className="grid gap-12">
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="label">Company</h2>
          <Button variant="ghost" size="xs" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-4">
          <Info label="Industry" value={account.industry} />
          <Info label="Size" value={SIZE_BANDS.find((s) => s.key === account.size_band)?.label} />
          <Info label="ICP fit" value={ICP_FIT.find((s) => s.key === account.icp_fit)?.label} />
          <Info label="Lead source" value={account.lead_source} />
          <Info label="Website" value={account.website} />
          <Info label="Tags" value={account.tags.join(", ")} />
        </dl>
        {account.notes && <p className="mt-5 whitespace-pre-wrap text-sm text-muted">{account.notes}</p>}
      </section>

      <section>
        <h2 className="label mb-3">Office</h2>
        {primary ? (
          <OfficeCard office={primary} compact />
        ) : (
          <p className="border-t border-line pt-5 text-sm text-muted">No office details yet. Add them on the Office & lease tab.</p>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="label">Contacts</h2>
          <Button variant="ghost" size="xs" onClick={() => setContactForm("new")}>
            + Add
          </Button>
        </div>
        {contacts.length === 0 ? (
          <p className="border-t border-line pt-5 text-sm text-muted">No contacts yet.</p>
        ) : (
          <ul>
            {contacts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line py-3.5">
                <div className="min-w-0">
                  <Link to={`/contacts/${c.id}`} className="font-medium hover:text-accent">
                    {c.name}
                  </Link>
                  <span className="text-sm text-muted">
                    {[c.role, buyingRoleLabel(c.buying_role)].filter(Boolean).map((s) => ` · ${s}`)}
                  </span>
                  {c.do_not_contact && <span className="text-[13px] text-late"> · Do not contact</span>}
                </div>
                <div className="flex flex-wrap gap-x-4 text-sm text-muted">
                  {c.phone && (
                    <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="hover:text-fg">
                      {c.phone}
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="hover:text-fg">
                      {c.email}
                    </a>
                  )}
                  <button onClick={() => setContactForm(c)} className="hover:text-fg">
                    Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="label">Open to-dos</h2>
          <Button variant="ghost" size="xs" onClick={() => ui.openCapture("todo", { account: { id: account.id, name: account.name } })}>
            + Add
          </Button>
        </div>
        {tasks.length === 0 ? (
          <p className="border-t border-line pt-5 text-sm text-muted">Nothing open.</p>
        ) : (
          <ul>
            {tasks.map((t) => (
              <li key={t.id} className="border-t border-line">
                <button onClick={() => ui.openTask(t.id)} className="flex w-full items-baseline justify-between gap-4 py-3.5 text-left hover:text-accent">
                  <span>
                    {t.title} <span className="text-sm text-muted">· {taskTypeLabel(t.type)}</span>
                  </span>
                  <span className={cn("shrink-0 text-sm", t.due_date && t.due_date < today ? "text-late" : "text-muted")}>{dmy(t.due_date)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet open={editing} onOpenChange={setEditing} title="Edit account">
        {editing && <AccountEdit data={data} onDone={() => setEditing(false)} />}
      </Sheet>
      <Sheet open={contactForm !== null} onOpenChange={(o) => !o && setContactForm(null)} title={contactForm === "new" ? "Add contact" : "Edit contact"}>
        {contactForm && (
          <ContactForm accountId={account.id} contact={contactForm === "new" ? undefined : contactForm} onDone={() => setContactForm(null)} />
        )}
      </Sheet>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className={cn("mt-0.5 truncate text-sm", !value && "text-faint")}>{value || "–"}</dd>
    </div>
  );
}

function AccountEdit({ data, onDone }: { data: AccountDetail; onDone: () => void }) {
  const a = data.account;
  const [f, setF] = useState({
    name: a.name,
    website: a.website,
    domain: a.domain ?? "",
    industry: a.industry,
    size_band: a.size_band ?? "",
    icp_fit: a.icp_fit ?? "",
    lead_source: a.lead_source,
    language: a.language,
    tags: a.tags.join(", "),
    notes: a.notes,
  });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api(`/accounts/${a.id}`, "PATCH", f);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <Field label="Name">
        <Input value={f.name} onChange={set("name")} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Website">
          <Input value={f.website} onChange={set("website")} />
        </Field>
        <Field label="Domain" hint="Used to spot duplicates">
          <Input value={f.domain} onChange={set("domain")} placeholder="example.nl" />
        </Field>
        <Field label="Industry">
          <Input value={f.industry} onChange={set("industry")} />
        </Field>
        <Field label="Company size">
          <Select value={f.size_band} onChange={set("size_band")}>
            <option value="">–</option>
            {SIZE_BANDS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label} employees
              </option>
            ))}
          </Select>
        </Field>
        <Field label="ICP fit">
          <Select value={f.icp_fit} onChange={set("icp_fit")}>
            <option value="">–</option>
            {ICP_FIT.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Language">
          <Select value={f.language} onChange={set("language")}>
            {LANGUAGES.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Lead source">
        <Input value={f.lead_source} onChange={set("lead_source")} placeholder="e.g. referral, LinkedIn, event" />
      </Field>
      <Field label="Tags" hint="Separate with commas">
        <Input value={f.tags} onChange={set("tags")} />
      </Field>
      <Field label="Notes">
        <Textarea rows={5} value={f.notes} onChange={set("notes")} />
      </Field>
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button>Save</Button>
      </div>
    </form>
  );
}

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

// ---------- office & lease ----------

function Offices({ data }: { data: AccountDetail }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const current = data.offices.filter((o) => o.is_current);
  const previous = data.offices.filter((o) => !o.is_current);

  if (editing) {
    const office = editing === "new" ? undefined : data.offices.find((o) => o.id === editing);
    return (
      <div>
        <h2 className="title mb-8 text-lg">{office ? "Edit location" : "Add location"}</h2>
        <OfficeForm accountId={data.account.id} office={office} onDone={() => setEditing(null)} />
      </div>
    );
  }

  return (
    <div className="grid gap-12">
      {current.length === 0 && (
        <p className="text-sm text-muted">No office details yet. Add what you know now; you can complete the rest later.</p>
      )}
      {current.map((o) => (
        <OfficeCard key={o.id} office={o} onEdit={() => setEditing(o.id)} />
      ))}
      <div>
        <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
          + Add location
        </Button>
      </div>
      {previous.length > 0 && (
        <section>
          <h2 className="label mb-3">Previous locations</h2>
          <div className="grid gap-10">
            {previous.map((o) => (
              <OfficeCard key={o.id} office={o} onEdit={() => setEditing(o.id)} compact />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------- communication ----------

function Communication({ data }: { data: AccountDetail }) {
  const [channel, setChannel] = useState("");
  const [contact, setContact] = useState("");
  const qs = useMemo(() => {
    const p = new URLSearchParams({ account_id: data.account.id, limit: "500" });
    if (channel) p.set("channel", channel);
    if (contact) p.set("contact_id", contact);
    return p.toString();
  }, [data.account.id, channel, contact]);
  const { data: items } = useLoad(() => api<ActivityRow[]>(`/activities?${qs}`), [qs]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={channel} onChange={(e) => setChannel(e.target.value)} className="h-8 w-auto text-[13px]" aria-label="Channel">
          <option value="">All channels</option>
          {CHANNELS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </Select>
        {data.contacts.length > 0 && (
          <Select value={contact} onChange={(e) => setContact(e.target.value)} className="h-8 w-auto text-[13px]" aria-label="Contact">
            <option value="">All contacts</option>
            {data.contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </div>
      {items && <Timeline items={items} empty={channel || contact ? "Nothing logged that matches." : "Nothing logged yet. Use the buttons above to log a call, email or note."} />}
    </div>
  );
}
