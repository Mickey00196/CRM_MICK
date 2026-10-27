import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Phone, Mail, Link2, Users, StickyNote, Plus, MoreHorizontal, ArrowLeft, FolderPlus } from "lucide-react";
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
import { Avatar } from "@/components/Avatar";
import { StageDot } from "@/components/Stage";
import { ActionTile, ActionTiles, BackLink, Panel, PanelEmpty } from "@/components/Panel";
import { OfficeCard, OfficeForm } from "@/components/Office";
import { ContactForm } from "@/components/ContactForm";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "office", label: "Office & lease" },
  { value: "communication", label: "Communication" },
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
          Back to companies
        </Link>
      </div>
    );
  if (!data) return null;

  const { account } = data;
  const picked = { id: account.id, name: account.name };
  const log = (channel: Channel) => ui.openLog({ account: picked, channel });

  return (
    <div className="rise mx-auto max-w-4xl">
      <BackLink to="/accounts">Companies</BackLink>

      <Header data={data} />

      <ActionTiles className="mt-4">
        <ActionTile icon={Phone} label="Call" onClick={() => log("call")} />
        <ActionTile icon={Mail} label="Email" onClick={() => log("email")} />
        <ActionTile icon={Link2} label="LinkedIn" onClick={() => log("linkedin")} />
        <ActionTile icon={Users} label="Meeting" onClick={() => log("meeting")} />
        <ActionTile icon={StickyNote} label="Note" onClick={() => log("note")} />
        <ActionTile icon={Plus} label="To-do" onClick={() => ui.openCapture("todo", { account: picked })} />
        <ActionTile icon={FolderPlus} label="Project" onClick={() => ui.openCapture("project", { account: picked })} />
      </ActionTiles>

      <Tabs value={tab} onValueChange={(v) => setParams(v === "overview" ? {} : { tab: v }, { replace: true })} className="mt-8">
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
        <Avatar name={account.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="display text-[30px] sm:text-[36px]">{account.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <Select
              value={account.status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-8 w-auto rounded-full pl-3 pr-7 text-[13px] font-medium [field-sizing:content]"
              aria-label="Status"
            >
              {ACCOUNT_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </Select>
            {account.domain && (
              <a href={`https://${account.domain}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-full bg-subtle px-3 font-medium text-accent hover:bg-subtle-hover">
                {account.domain}
              </a>
            )}
            <span className="inline-flex h-8 items-center rounded-full bg-subtle px-3">{account.language.toUpperCase()}</span>
            {data.last_contact_at && <span className="px-1">Last contact {relative(data.last_contact_at)}</span>}
          </div>
        </div>
        <Menu>
          <MenuTrigger asChild>
            <button className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-subtle text-accent hover:bg-subtle-hover" aria-label="More">
              <MoreHorizontal className="size-[18px]" />
            </button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem onSelect={archive}>Archive company</MenuItem>
          </MenuContent>
        </Menu>
      </div>

      <div className="card mt-6 px-4 py-3">
        <p className="mb-0.5 text-[13px] font-medium text-muted">Next step</p>
        {next ? (
          <button onClick={() => ui.openTask(next.id)} className="group flex w-full items-baseline justify-between gap-4 text-left">
            <span className="text-[17px] font-medium group-hover:text-accent">
              {next.title} <span className="text-[14px] font-normal text-muted">· {taskTypeLabel(next.type)}</span>
            </span>
            <span className={cn("shrink-0 text-[14px]", next.due_date && next.due_date < today ? "font-medium text-late-text" : "text-muted")}>
              {next.due_date ? dmy(next.due_date) : "No date"}
              {next.due_time && ` ${next.due_time}`}
            </span>
          </button>
        ) : (
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[17px] font-medium text-missing">No next step</span>
            <button onClick={() => ui.openCapture("todo", { account: { id: account.id, name: account.name } })} className="text-[15px] font-medium text-accent">
              Add
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
    <div className="grid gap-6">
      <Panel
        title="Projects"
        count={data.projects.length}
        actions={
          <Button variant="ghost" size="xs" onClick={() => ui.openCapture("project", { account: { id: account.id, name: account.name } })}>
            <Plus /> New
          </Button>
        }
      >
        {data.projects.length === 0 ? (
          <PanelEmpty>No projects with this company yet.</PanelEmpty>
        ) : (
          <ul>
            {data.projects.map((p) => (
              <li key={p.id} className="border-b border-line last:border-b-0">
                <Link to={`/projects/${p.id}`} className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-hover/50 sm:px-5">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <StageDot stage={p.stage} />
                    <span className={cn("truncate font-medium", p.stage === "done" && "text-muted")}>{p.name}</span>
                  </span>
                  <span className="shrink-0 text-[13px] text-muted">
                    {p.stage === "waiting" && p.waiting_on ? `Waiting on ${p.waiting_on}` : projectStageLabel(p.stage)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Company"
        actions={
          <Button variant="ghost" size="xs" onClick={() => setEditing(true)}>
            Edit
          </Button>
        }
      >
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-4 py-4 sm:grid-cols-4 sm:px-5">
          <Info label="Industry" value={account.industry} />
          <Info label="Size" value={SIZE_BANDS.find((s) => s.key === account.size_band)?.label} />
          <Info label="ICP fit" value={ICP_FIT.find((s) => s.key === account.icp_fit)?.label} />
          <Info label="Lead source" value={account.lead_source} />
          <Info label="Website" value={account.website} />
          <Info label="Tags" value={account.tags.join(", ")} />
        </dl>
        {account.notes && <p className="whitespace-pre-wrap border-t border-line px-4 py-4 text-sm text-muted sm:px-5">{account.notes}</p>}
      </Panel>

      <Panel title="Office">
        {primary ? (
          <OfficeCard office={primary} compact className="px-4 py-4 sm:px-5" />
        ) : (
          <PanelEmpty>No office details yet. Add them on the Office & lease tab.</PanelEmpty>
        )}
      </Panel>

      <Panel
        title="Contacts"
        count={contacts.length}
        actions={
          <Button variant="ghost" size="xs" onClick={() => setContactForm("new")}>
            <Plus /> Add
          </Button>
        }
      >
        {contacts.length === 0 ? (
          <PanelEmpty>No contacts yet.</PanelEmpty>
        ) : (
          <ul>
            {contacts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-3 last:border-b-0 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={c.name} size="md" shape="round" />
                  <div className="min-w-0">
                    <Link to={`/contacts/${c.id}`} className="font-semibold hover:text-accent">
                      {c.name}
                    </Link>
                    {c.do_not_contact && <span className="ml-2 rounded-full bg-late-soft px-2 py-0.5 text-[11.5px] font-semibold text-late-text">Do not contact</span>}
                    <p className="truncate text-[13px] text-muted">{[c.role, buyingRoleLabel(c.buying_role)].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 text-sm text-muted">
                  {c.phone && (
                    <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="text-accent hover:underline">
                      {c.phone}
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="text-accent hover:underline">
                      {c.email}
                    </a>
                  )}
                  <button onClick={() => setContactForm(c)} className="font-medium text-accent">
                    Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Open to-dos"
        count={tasks.length}
        actions={
          <Button variant="ghost" size="xs" onClick={() => ui.openCapture("todo", { account: { id: account.id, name: account.name } })}>
            <Plus /> Add
          </Button>
        }
      >
        {tasks.length === 0 ? (
          <PanelEmpty>Nothing open.</PanelEmpty>
        ) : (
          <ul>
            {tasks.map((t) => (
              <li key={t.id} className="border-b border-line last:border-b-0">
                <button
                  onClick={() => ui.openTask(t.id)}
                  className="flex w-full items-baseline justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-hover/50 sm:px-5"
                >
                  <span className="min-w-0 truncate">
                    {t.title}{" "}
                    <span className="text-sm text-muted">
                      · {taskTypeLabel(t.type)}
                      {t.project_name && ` · ${t.project_name}`}
                    </span>
                  </span>
                  <span className={cn("shrink-0 text-sm", t.due_date && t.due_date < today ? "text-late" : "text-muted")}>{dmy(t.due_date)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Sheet open={editing} onOpenChange={setEditing} title="Edit company">
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
    <div className="grid gap-6">
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
          <div className="grid gap-4">
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
        <Select value={channel} onChange={(e) => setChannel(e.target.value)} className="h-8 w-auto rounded-full pl-3 text-[13px] font-medium" aria-label="Channel">
          <option value="">All channels</option>
          {CHANNELS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </Select>
        {data.contacts.length > 0 && (
          <Select value={contact} onChange={(e) => setContact(e.target.value)} className="h-8 w-auto rounded-full pl-3 text-[13px] font-medium" aria-label="Contact">
            <option value="">All contacts</option>
            {data.contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </div>
      {items && (
        <div className="card px-4 py-1">
          <Timeline items={items} showProject empty={channel || contact ? "Nothing logged that matches." : "Nothing logged yet. Use the buttons above to log a call, email or note."} />
        </div>
      )}
    </div>
  );
}
