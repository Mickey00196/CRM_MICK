import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Link2, Mail, MessageSquarePlus, Phone, Plus } from "lucide-react";
import { buyingRoleLabel, taskTypeLabel, type ContactDetail } from "@shared/model";
import { api, useApi } from "@/lib/api";
import { dmy, relative, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Timeline } from "@/components/Timeline";
import { Avatar } from "@/components/Avatar";
import { ActionTile, ActionTiles, BackLink, Panel } from "@/components/Panel";
import { usePageContext, useUI } from "@/components/ui-context";
import { ContactForm } from "@/components/ContactForm";

export function ContactPage() {
  const id = useParams().id!;
  const { data, error } = useApi<ContactDetail>(`/contacts/${id}`);
  const [editing, setEditing] = useState(false);
  const ui = useUI();
  const today = todayISO();
  usePageContext(data?.contact.account_id ? { account: { id: data.contact.account_id, name: data.contact.account_name ?? "" } } : null);

  if (error) return <p className="text-sm text-late-text">{error}</p>;
  if (!data) return null;
  const { contact: c, activities, tasks } = data;
  const account = c.account_id ? { id: c.account_id, name: c.account_name ?? "" } : null;
  const linkedin = c.linkedin_url ? (c.linkedin_url.startsWith("http") ? c.linkedin_url : `https://${c.linkedin_url}`) : null;

  return (
    <div className="rise mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <BackLink to={account ? `/accounts/${account.id}` : "/contacts"}>{account ? account.name : "Contacts"}</BackLink>
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="-mt-3 text-[15px]">
          Edit
        </Button>
      </div>

      <header className="flex flex-col items-center text-center">
        <Avatar name={c.name} size="xl" shape="round" />
        <h1 className="display mt-3 text-[30px]">{c.name}</h1>
        <p className="mt-1 text-[15px] text-muted">
          {[c.role, account?.name].filter(Boolean).join(" · ")}
        </p>
        <p className="text-[13px] text-faint">
          {[buyingRoleLabel(c.buying_role), c.language?.toUpperCase(), c.last_contacted_at && `last contact ${relative(c.last_contacted_at)}`]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {c.do_not_contact && (
          <p className="mt-2 rounded-full bg-late-soft px-3 py-1 text-[13px] font-semibold text-late-text">
            Do not contact{c.opt_out_at && ` since ${dmy(c.opt_out_at)}`}
          </p>
        )}
      </header>

      <ActionTiles className="mt-5 justify-center">
        {c.phone && <ActionTile icon={Phone} label="Call" href={`tel:${c.phone.replace(/\s/g, "")}`} />}
        {c.email && <ActionTile icon={Mail} label="Mail" href={`mailto:${c.email}`} />}
        {linkedin && <ActionTile icon={Link2} label="LinkedIn" href={linkedin} />}
        {account && <ActionTile icon={MessageSquarePlus} label="Log" onClick={() => ui.openLog({ account, contact_id: c.id, channel: "call" })} />}
        {account && <ActionTile icon={Plus} label="To-do" onClick={() => ui.openCapture("todo", { account })} />}
      </ActionTiles>

      {(c.phone || c.email || linkedin) && (
        <ul className="card mt-6 overflow-hidden">
          {c.phone && <InfoRow label="phone" value={c.phone} href={`tel:${c.phone.replace(/\s/g, "")}`} />}
          {c.email && <InfoRow label="email" value={c.email} href={`mailto:${c.email}`} />}
          {linkedin && <InfoRow label="LinkedIn" value={linkedin.replace(/^https?:\/\/(www\.)?/, "")} href={linkedin} />}
        </ul>
      )}

      {c.notes && (
        <div className="card mt-6 px-4 py-3">
          <p className="text-[13px] text-muted">Notes</p>
          <p className="mt-0.5 whitespace-pre-wrap text-[15px]">{c.notes}</p>
        </div>
      )}

      {tasks.length > 0 && (
        <Panel title="Open To-dos" count={tasks.length} className="mt-8">
          <ul>
            {tasks.map((t) => (
              <li key={t.id} className="group/row pl-4 transition-colors hover:bg-hover">
                <button
                  onClick={() => ui.openTask(t.id)}
                  className="flex w-full items-baseline justify-between gap-4 border-b border-line py-2.5 pr-4 text-left group-last/row:border-b-0"
                >
                  <span className="min-w-0 truncate text-[15px]">
                    {t.title} <span className="text-[13px] text-muted">· {taskTypeLabel(t.type)}</span>
                  </span>
                  <span className={cn("shrink-0 text-[13px]", t.due_date && t.due_date < today ? "font-medium text-late-text" : "text-muted")}>
                    {dmy(t.due_date)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Communication" className="mt-8">
        <div className="px-4 py-1">
          <Timeline items={activities} showProject empty="Nothing logged with this contact yet." />
        </div>
      </Panel>

      <Sheet open={editing} onOpenChange={setEditing} title="Edit contact">
        {editing && <ContactForm accountId={c.account_id} contact={c} onDone={() => setEditing(false)} />}
      </Sheet>
    </div>
  );
}

function InfoRow({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <li className="group/row pl-4">
      <a
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel="noreferrer"
        className="block border-b border-line py-2.5 pr-4 group-last/row:border-b-0"
      >
        <span className="block text-[13px] text-muted">{label}</span>
        <span className="block truncate text-[15px] text-accent">{value}</span>
      </a>
    </li>
  );
}
