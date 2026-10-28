import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Phone, Mail, Link2, Users, StickyNote, MoreHorizontal, ArrowLeft, CalendarPlus } from "lucide-react";
import {
  ACCOUNT_STATUSES,
  projectStageLabel,
  CHANNELS,
  ICP_FIT,
  LANGUAGES,
  SIZE_BANDS,
  buyingRoleLabel,
  taskTypeLabel,
  type AccountDetail,
  type AccountStatus,
  type ActivityRow,
  type Channel,
  type Contact,
} from "@shared/model";
import { api, useApi } from "@/lib/api";
import { dmy, relative, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ErrorText, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/dropdown";
import { Tabs, TabList, TabPanelBody } from "@/components/ui/tabs";
import { Sheet } from "@/components/ui/dialog";
import { usePageContext, useUI } from "@/components/ui-context";
import { Timeline } from "@/components/Timeline";
import { OfficeCard, OfficeForm } from "@/components/Office";
import { ContactForm } from "@/components/ContactForm";
import { Skeleton } from "@/components/Skeleton";
import { TodoItem, dueLabel } from "@/components/TodoItem";
import { StageFlow } from "@/components/StageFlow";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "office", label: "Office & lease" },
  { value: "communication", label: "Log" },
];

export function AccountPage() {
  const id = useParams().id!;
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get("tab")) ? params.get("tab")! : "overview";
  const { data, error } = useApi<AccountDetail>(`/accounts/${id}`);
  const ui = useUI();
  usePageContext(data ? { account: { id: data.account.id, name: data.account.name } } : null);

  if (error)
    return (
      <div className="mx-auto max-w-4xl">
        <p className="text-sm text-late">{error}</p>
        <Link to="/accounts" className="mt-3 inline-block text-sm text-muted hover:text-fg">
          Back to accounts
        </Link>
      </div>
    );
  if (!data) return <Skeleton rows={5} className="max-w-4xl" />;

  const { account } = data;
  const picked = { id: account.id, name: account.name };
  const log = (channel: Channel) => ui.openLog({ account: picked, channel });

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/accounts" className="mb-6 inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> Accounts
      </Link>

      <Header data={data} />

      <div className="mt-6 flex flex-wrap gap-1.5">
        <Button size="sm" onClick={() => ui.openCapture("todo", { account: picked })}>
          <CalendarPlus /> Plan follow-up
        </Button>
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

  async function setStatus(status: AccountStatus) {
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

      <StageFlow status={account.status} onChange={setStatus} />

      <div className="mt-6 border-y border-line py-4">
        <p className="mb-1 text-[13px] text-muted">Next follow-up</p>
        {next ? (
          <button onClick={() => ui.openTask(next.id)} className="group flex w-full items-baseline justify-between gap-4 text-left">
            <span className="text-lg group-hover:text-accent-text">
              {next.title} <span className="text-sm text-muted">· {taskTypeLabel(next.type)}</span>
            </span>
            <span className={cn("num shrink-0 text-sm", next.due_date && next.due_date < today ? "text-late" : "text-muted")}>
              {next.due_date ? dueLabel(next.due_date, null, today) : "No date"}
              {next.due_time && ` ${next.due_time}`}
            </span>
          </button>
        ) : (
          <p className="text-lg text-missing">No follow-up planned</p>
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
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="label">Follow-ups</h2>
          <Button variant="ghost" size="xs" onClick={() => ui.openCapture("todo", { account: { id: account.id, name: account.name } })}>
            + Plan
          </Button>
        </div>
        {tasks.length === 0 ? (
          <p className="border-t border-line pt-5 text-sm text-muted">Nothing planned. Every account you're chasing should have a next follow-up date.</p>
        ) : (
          <ul className="border-t border-line">
            {tasks.map((t) => (
              <TodoItem key={t.id} todo={t} showType />
            ))}
          </ul>
        )}
      </section>

      <LatestActivity accountId={account.id} />

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
                  <Link to={`/contacts/${c.id}`} className="font-medium hover:text-accent-text">
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

      {data.projects.length > 0 && (
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="label">Projects (from before)</h2>
        </div>
        {data.projects.length === 0 ? (
          <p className="border-t border-line pt-5 text-sm text-muted">No projects with this company yet.</p>
        ) : (
          <ul>
            {data.projects.map((p) => (
              <li key={p.id} className="border-t border-line">
                <Link to={`/projects/${p.id}`} className="flex items-baseline justify-between gap-4 py-3.5 hover:text-accent-text">
                  <span className={cn("min-w-0 truncate", p.stage === "done" && "text-muted")}>{p.name}</span>
                  <span className="shrink-0 text-sm text-muted">
                    {p.stage === "waiting" && p.waiting_on ? `Waiting on ${p.waiting_on}` : projectStageLabel(p.stage)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      )}

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

/** The last few things that happened, so the follow-ups have context. */
function LatestActivity({ accountId }: { accountId: string }) {
  const { data: items } = useApi<ActivityRow[]>(`/activities?account_id=${accountId}&limit=3`);
  if (!items) return null;
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="label">Latest activity</h2>
        {items.length > 0 && (
          <Link to="?tab=communication" className="text-[13px] text-muted hover:text-fg">
            Full log
          </Link>
        )}
      </div>
      <Timeline items={items} empty="Nothing logged yet. Log a call, email or meeting with the buttons above." />
    </section>
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
  const { data: items } = useApi<ActivityRow[]>(`/activities?${qs}`);

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
      {items && <Timeline items={items} showProject empty={channel || contact ? "Nothing logged that matches." : "Nothing logged yet. Use the buttons above to log a call, email or note."} />}
    </div>
  );
}
