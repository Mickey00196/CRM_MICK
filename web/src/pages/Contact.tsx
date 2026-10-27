import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Mail, Phone, Link2 } from "lucide-react";
import { buyingRoleLabel, taskTypeLabel, type ContactDetail } from "@shared/model";
import { api, useApi } from "@/lib/api";
import { dmy, relative, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Timeline } from "@/components/Timeline";
import { usePageContext, useUI } from "@/components/ui-context";
import { ContactForm } from "@/components/ContactForm";
import { Skeleton } from "@/components/Skeleton";
import { dueLabel } from "@/components/TodoItem";

export function ContactPage() {
  const id = useParams().id!;
  const { data, error } = useApi<ContactDetail>(`/contacts/${id}`);
  const [editing, setEditing] = useState(false);
  const ui = useUI();
  const today = todayISO();
  usePageContext(data?.contact.account_id ? { account: { id: data.contact.account_id, name: data.contact.account_name ?? "" } } : null);

  if (error) return <p className="text-sm text-late">{error}</p>;
  if (!data) return <Skeleton rows={4} className="max-w-4xl" />;
  const { contact: c, activities, tasks } = data;
  const account = c.account_id ? { id: c.account_id, name: c.account_name ?? "" } : null;

  return (
    <div className="mx-auto max-w-4xl">
      <Link to={account ? `/accounts/${account.id}` : "/contacts"} className="mb-6 inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> {account ? account.name : "Contacts"}
      </Link>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="title text-3xl">{c.name}</h1>
          <p className="mt-2 text-sm text-muted">
            {[c.role, buyingRoleLabel(c.buying_role), c.language?.toUpperCase()].filter(Boolean).join(" · ")}
            {c.last_contacted_at && ` · Last contact ${relative(c.last_contacted_at)}`}
          </p>
          {c.do_not_contact && <p className="mt-1 text-sm text-late">Do not contact{c.opt_out_at && ` since ${dmy(c.opt_out_at)}`}</p>}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </header>

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {c.phone && (
          <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 text-muted hover:text-fg">
            <Phone className="size-3.5" /> {c.phone}
          </a>
        )}
        {c.email && (
          <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 text-muted hover:text-fg">
            <Mail className="size-3.5" /> {c.email}
          </a>
        )}
        {c.linkedin_url && (
          <a
            href={c.linkedin_url.startsWith("http") ? c.linkedin_url : `https://${c.linkedin_url}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-muted hover:text-fg"
          >
            <Link2 className="size-3.5" /> LinkedIn
          </a>
        )}
      </div>

      {account && (
        <div className="mt-6 flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" onClick={() => ui.openLog({ account, contact_id: c.id, channel: "call" })}>
            Log communication
          </Button>
          <Button variant="outline" size="sm" onClick={() => ui.openCapture("todo", { account })}>
            Add to-do
          </Button>
        </div>
      )}

      {c.notes && <p className="mt-8 whitespace-pre-wrap text-sm text-muted">{c.notes}</p>}

      {tasks.length > 0 && (
        <section className="mt-12">
          <h2 className="label mb-3">Open to-dos</h2>
          <ul>
            {tasks.map((t) => (
              <li key={t.id} className="border-t border-line">
                <button onClick={() => ui.openTask(t.id)} className="flex w-full items-baseline justify-between gap-4 py-3.5 text-left hover:text-accent-text">
                  <span>
                    {t.title} <span className="text-sm text-muted">· {taskTypeLabel(t.type)}</span>
                  </span>
                  <span className={cn("num text-sm", t.due_date && t.due_date < today ? "text-late" : "text-muted")} title={dmy(t.due_date)}>{dueLabel(t.due_date, t.due_time, today)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <h2 className="label mb-3">Communication</h2>
        <Timeline items={activities} showProject empty="Nothing logged with this contact yet." />
      </section>

      <Sheet open={editing} onOpenChange={setEditing} title="Edit contact">
        {editing && <ContactForm accountId={c.account_id} contact={c} onDone={() => setEditing(false)} />}
      </Sheet>
    </div>
  );
}
