import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import * as T from "@radix-ui/react-tabs";
import { MoreHorizontal, ArrowLeft, CalendarPlus, CalendarClock, Clock, Globe, MapPin, Pencil } from "lucide-react";
import {
  accountStatusLabel,
  phaseOf,
  projectStageLabel,
  ICP_FIT,
  LANGUAGES,
  SIZE_BANDS,
  buyingRoleLabel,
  taskTypeLabel,
  type AccountDetail,
  type AccountStatus,
  type Contact,
} from "@shared/model";
import { api, useApi } from "@/lib/api";
import { relative, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ErrorText, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/dropdown";
import { Tabs, TabList } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/dialog";
import { usePageContext, useUI } from "@/components/ui-context";
import { OfficeCard, OfficeForm } from "@/components/Office";
import { ContactForm } from "@/components/ContactForm";
import { Skeleton } from "@/components/Skeleton";
import { TodoItem, dueLabel } from "@/components/TodoItem";
import { StageFlow } from "@/components/StageFlow";
import { StatusDot } from "@/components/Brand";
import { CompanyAbout } from "@/components/CompanyAbout";
import { LogPanel } from "@/components/LogPanel";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "office", label: "Office & lease" },
];

export function AccountPage() {
  const id = useParams().id!;
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get("tab")) ? params.get("tab")! : "overview";
  const { data, error, reload } = useApi<AccountDetail>(`/accounts/${id}`);
  const [editing, setEditing] = useState(false);
  usePageContext(data ? { account: { id: data.account.id, name: data.account.name } } : null);

  // While the AI lookup runs, check back every few seconds.
  const lookingUp = data?.account.ai_status === "pending";
  useEffect(() => {
    if (!lookingUp) return;
    const t = setInterval(reload, 3000);
    return () => clearInterval(t);
  }, [lookingUp, reload]);

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

  async function setStatus(status: AccountStatus) {
    await api(`/accounts/${account.id}`, "PATCH", { status });
  }

  return (
    <div className="mx-auto max-w-[90rem]">
      <Link to="/accounts" className="mb-5 inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> Accounts
      </Link>

      <Header data={data} onEdit={() => setEditing(true)} />

      {/* The opportunity cycle across the full width, with the next follow-up underneath. */}
      <div className="mt-7">
        <StageFlow status={account.status} onChange={setStatus} footer={<NextFollowUp data={data} />} />
      </div>

      {/*
        Below it: details on the left, the log on the right at full height, staying beside you while
        the details scroll. Phones: log first, then details.
      */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_28rem] 2xl:grid-cols-[minmax(0,1fr)_32rem]">
        <LogPanel
          account={account}
          className="lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:h-[calc(100dvh-3rem)] lg:max-h-none lg:self-start"
        />
        <Tabs
          value={tab}
          onValueChange={(v) => setParams(v === "overview" ? {} : { tab: v }, { replace: true })}
          className="min-w-0 lg:col-start-1 lg:row-start-1"
        >
          <TabList tabs={TABS} variant="segmented" />
          <T.Content value="overview" className="mt-4 focus:outline-none">
            <Overview data={data} onEdit={() => setEditing(true)} />
          </T.Content>
          <T.Content value="office" className="mt-4 focus:outline-none">
            <Offices data={data} />
          </T.Content>
        </Tabs>
      </div>

      <Sheet open={editing} onOpenChange={setEditing} title="Edit account">
        {editing && <AccountEdit data={data} onDone={() => setEditing(false)} />}
      </Sheet>
    </div>
  );
}

// ---------- header ----------

function Header({ data, onEdit }: { data: AccountDetail; onEdit: () => void }) {
  const { account, offices } = data;
  const navigate = useNavigate();
  const office = offices.find((o) => o.is_primary && o.is_current) ?? offices.find((o) => o.is_current);
  const place = office ? [office.submarket, office.city].filter(Boolean).join(", ") : "";
  const phase = phaseOf(account.status);

  async function archive() {
    if (!confirm(`Archive ${account.name}? It disappears from lists and to-dos; you can restore it from Settings.`)) return;
    await api(`/accounts/${account.id}`, "DELETE");
    navigate("/accounts");
  }

  return (
    <header className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        <span
          aria-hidden="true"
          className="hidden size-12 shrink-0 place-items-center rounded-xl border border-accent/20 bg-accent-soft text-[17px] font-semibold text-accent-text sm:grid"
        >
          {initials(account.name)}
        </span>
        <div className="min-w-0">
          <h1 className="title truncate text-[26px] leading-tight sm:text-[28px]">{account.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-0.5 text-fg">
              <StatusDot status={account.status} />
              {phase === "opportunity" ? `Opportunity · ${accountStatusLabel(account.status)}` : accountStatusLabel(account.status)}
            </span>
            {account.domain && (
              <a href={`https://${account.domain}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-fg">
                <Globe className="size-3.5" /> {account.domain}
              </a>
            )}
            {place && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" /> {place}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" /> {data.last_contact_at ? `Last contact ${relative(data.last_contact_at)}` : "No contact yet"}
            </span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button variant="outline" size="sm" onClick={onEdit} className="hidden sm:inline-flex">
          <Pencil /> Edit
        </Button>
        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More">
              <MoreHorizontal />
            </Button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem onSelect={onEdit}>Edit account</MenuItem>
            <MenuItem onSelect={archive}>Archive account</MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </header>
  );
}

function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N}\s&]/gu, "").split(/\s+/).filter((w) => w && w !== "&");
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "·";
}

/** The bottom strip of the tracking card: what's next, and a way to plan it. */
function NextFollowUp({ data }: { data: AccountDetail }) {
  const { account, tasks } = data;
  const next = tasks[0];
  const ui = useUI();
  const today = todayISO();
  const late = next?.due_date && next.due_date < today;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface">
          <CalendarClock className={cn("size-4", next ? "text-accent-text" : "text-missing")} />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] text-muted">Next follow-up</p>
          {next ? (
            <button onClick={() => ui.openTask(next.id)} className="group flex min-w-0 flex-wrap items-baseline gap-x-2 text-left">
              <span className="truncate font-medium group-hover:text-accent-text">{next.title}</span>
              <span className={cn("text-[13px]", late ? "text-late" : "text-muted")}>
                {taskTypeLabel(next.type)} · <span className="num">{next.due_date ? dueLabel(next.due_date, next.due_time, today) : "No date"}</span>
              </span>
            </button>
          ) : (
            <p className="font-medium text-missing">No follow-up planned</p>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant={next ? "outline" : "default"}
        onClick={() => ui.openCapture("todo", { account: { id: account.id, name: account.name } })}
        className="shrink-0"
      >
        <CalendarPlus /> Plan follow-up
      </Button>
    </div>
  );
}

// ---------- overview ----------

function Overview({ data, onEdit }: { data: AccountDetail; onEdit: () => void }) {
  const { account, offices, contacts, tasks } = data;
  const ui = useUI();
  const primary = offices.find((o) => o.is_primary && o.is_current) ?? offices.find((o) => o.is_current);
  const [contactForm, setContactForm] = useState<Contact | "new" | null>(null);
  const plan = () => ui.openCapture("todo", { account: { id: account.id, name: account.name } });
  const small = "text-[13px] font-medium text-muted hover:text-fg";

  return (
    <div className="grid gap-6">
      <CompanyAbout account={account} aiEnabled={data.ai_enabled} onEditCompany={onEdit} />

      <Card
        title={<>Follow-ups <span className="num font-normal text-faint">{tasks.length || ""}</span></>}
        action={<button onClick={plan} className={small}>+ Plan</button>}
        bodyClassName={tasks.length ? "px-5 py-1" : undefined}
      >
        {tasks.length === 0 ? (
          <p className="text-sm text-muted">Nothing planned. Every account you're chasing should have a next follow-up date.</p>
        ) : (
          <ul className="[&>li:last-child]:border-b-0">
            {tasks.map((t) => (
              <TodoItem key={t.id} todo={t} showType />
            ))}
          </ul>
        )}
      </Card>

      <Card
        title={<>Contacts <span className="num font-normal text-faint">{contacts.length || ""}</span></>}
        action={<button onClick={() => setContactForm("new")} className={small}>+ Add</button>}
        bodyClassName={contacts.length ? "px-5 py-1" : undefined}
      >
        {contacts.length === 0 ? (
          <p className="text-sm text-muted">No contacts yet. Add the decision maker and whoever runs the office.</p>
        ) : (
          <ul>
            {contacts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line py-3 last:border-b-0">
                <div className="flex min-w-0 items-center gap-3">
                  <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-subtle text-[12px] font-medium text-muted">
                    {initials(c.name)}
                  </span>
                  <div className="min-w-0">
                    <Link to={`/contacts/${c.id}`} className="font-medium hover:text-accent-text">
                      {c.name}
                    </Link>
                    <p className="truncate text-[13px] text-muted">
                      {[c.role, buyingRoleLabel(c.buying_role)].filter(Boolean).join(" · ") || "No role yet"}
                      {c.do_not_contact && <span className="text-late"> · Do not contact</span>}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 text-[13px] text-muted">
                  {c.phone && (
                    <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="num hover:text-fg">
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
      </Card>

      <div className="grid gap-6 2xl:grid-cols-2">
        <Card title="Company" action={<button onClick={onEdit} className={small}>Edit</button>}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Info label="Industry" value={account.industry} />
            <Info label="Size" value={SIZE_BANDS.find((s) => s.key === account.size_band)?.label} />
            <Info label="ICP fit" value={ICP_FIT.find((s) => s.key === account.icp_fit)?.label} />
            <Info label="Lead source" value={account.lead_source} />
            <Info label="Website" value={account.website} />
            <Info label="Tags" value={account.tags.join(", ")} />
          </dl>
          {account.notes && <p className="mt-5 whitespace-pre-wrap border-t border-line pt-4 text-sm text-muted">{account.notes}</p>}
        </Card>

        <Card title="Office">
          {primary ? (
            <OfficeCard office={primary} compact />
          ) : (
            <p className="text-sm text-muted">No office details yet. Add them on the Office & lease tab.</p>
          )}
        </Card>
      </div>

      {data.projects.length > 0 && (
        <Card title="Projects (from before)" bodyClassName="px-5 py-1">
          <ul>
            {data.projects.map((p) => (
              <li key={p.id} className="border-b border-line last:border-b-0">
                <Link to={`/projects/${p.id}`} className="flex items-baseline justify-between gap-4 py-3 hover:text-accent-text">
                  <span className={cn("min-w-0 truncate", p.stage === "done" && "text-muted")}>{p.name}</span>
                  <span className="shrink-0 text-sm text-muted">
                    {p.stage === "waiting" && p.waiting_on ? `Waiting on ${p.waiting_on}` : projectStageLabel(p.stage)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

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
      <Card title={office ? "Edit location" : "Add location"}>
        <OfficeForm accountId={data.account.id} office={office} onDone={() => setEditing(null)} />
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      {current.length === 0 && (
        <Card>
          <p className="text-sm text-muted">No office details yet. Add what you know now; you can complete the rest later.</p>
        </Card>
      )}
      {current.map((o) => (
        <Card key={o.id}>
          <OfficeCard office={o} onEdit={() => setEditing(o.id)} />
        </Card>
      ))}
      <div>
        <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
          + Add location
        </Button>
      </div>
      {previous.length > 0 && (
        <Card title="Previous locations">
          <div className="grid gap-8">
            {previous.map((o) => (
              <OfficeCard key={o.id} office={o} onEdit={() => setEditing(o.id)} compact />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
