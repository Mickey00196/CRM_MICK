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
    <div className="rise mx-auto max-w-3xl">
      <BackLink to={account ? `/accounts/${account.id}` : "/contacts"}>{account ? account.name : "Contacts"}</BackLink>

      <header className="flex items-start gap-4">
        <Avatar name={c.name} size="lg" shape="round" className="mt-1.5" />
        <div className="min-w-0 flex-1">
          <h1 className="display text-[38px] sm:text-[48px]">{c.name}</h1>
          <p className="mt-2 text-[14px] text-muted">
            {[c.role, account?.name, buyingRoleLabel(c.buying_role)].filter(Boolean).join(" · ")}
          </p>
          {c.do_not_contact && (
            <p className="mt-2 inline-flex rounded-md border border-late/30 px-1.5 py-px text-[12px] font-medium text-late-text">
              Do not contact{c.opt_out_at && ` since ${dmy(c.opt_out_at)}`}
            </p>
          )}
        </div>
        <Button variant="outline" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </header>

      <ActionTiles className="mt-8">
        {c.phone && <ActionTile icon={Phone} label="Call" href={`tel:${c.phone.replace(/\s/g, "")}`} />}
        {c.email && <ActionTile icon={Mail} label="Email" href={`mailto:${c.email}`} />}
        {linkedin && <ActionTile icon={Link2} label="LinkedIn" href={linkedin} />}
        {account && <ActionTile icon={MessageSquarePlus} label="Log" onClick={() => ui.openLog({ account, contact_id: c.id, channel: "call" })} />}
        {account && <ActionTile icon={Plus} label="To-do" onClick={() => ui.openCapture("todo", { account })} />}
      </ActionTiles>

      {(
        <ul className="open-list mt-12">
          {c.phone && <InfoRow label="Phone" value={c.phone} href={`tel:${c.phone.replace(/\s/g, "")}`} />}
          {c.email && <InfoRow label="Email" value={c.email} href={`mailto:${c.email}`} />}
          {linkedin && <InfoRow label="LinkedIn" value={linkedin.replace(/^https?:\/\/(www\.)?/, "")} href={linkedin} />}
          <InfoRow label="Language" value={c.language?.toUpperCase() ?? "–"} />
          <InfoRow label="Last contact" value={c.last_contacted_at ? `${dmy(c.last_contacted_at)} · ${relative(c.last_contacted_at)}` : "–"} />
        </ul>
      )}

      {c.notes && (
        <div className="mt-10 border-y border-line py-4">
          <p className="label">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-[13.5px]">{c.notes}</p>
        </div>
      )}

      {tasks.length > 0 && (
        <Panel title="Open to-dos" count={tasks.length} className="mt-14">
          <ul>
            {tasks.map((t) => (
              <li key={t.id} className="group/row pl-[var(--row-x,1rem)]">
                <button
                  onClick={() => ui.openTask(t.id)}
                  className="flex w-full items-baseline justify-between gap-4 border-b border-line py-3 pr-[var(--row-x,1rem)] text-left group-last/row:border-b-0"
                >
                  <span className="min-w-0 truncate text-[14px]">
                    {t.title} <span className="text-[13px] text-muted">· {taskTypeLabel(t.type)}</span>
                  </span>
                  <span className={cn("mono shrink-0 text-[12px]", t.due_date && t.due_date < today ? "text-late-text" : "text-muted")}>
                    {dmy(t.due_date)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Communication" className="mt-14">
        <div className="px-[var(--row-x,1rem)]">
          <Timeline items={activities} showProject empty="Nothing logged with this contact yet." />
        </div>
      </Panel>

      <Sheet open={editing} onOpenChange={setEditing} title="Edit contact">
        {editing && <ContactForm accountId={c.account_id} contact={c} onDone={() => setEditing(false)} />}
      </Sheet>
    </div>
  );
}

function InfoRow({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = (
    <>
      <span className="w-32 shrink-0 text-[13px] text-muted">{label}</span>
      <span className={cn("min-w-0 flex-1 truncate text-[14px]", href && "underline decoration-line-strong underline-offset-4 group-hover/row:decoration-fg")}>{value}</span>
    </>
  );
  return (
    <li className="group/row border-b border-line last:border-b-0">
      {href ? (
        <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="flex items-center gap-3 px-[var(--row-x,1rem)] py-3">
          {body}
        </a>
      ) : (
        <div className="flex items-center gap-3 px-[var(--row-x,1rem)] py-3">{body}</div>
      )}
    </li>
  );
}
