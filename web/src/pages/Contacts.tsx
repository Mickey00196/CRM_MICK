import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { buyingRoleLabel, type Contact } from "@shared/model";
import { api, useApi } from "@/lib/api";
import { dmy } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUI } from "@/components/ui-context";
import { Avatar } from "@/components/Avatar";

export function Contacts() {
  const { data, error } = useApi<Contact[]>("/contacts");
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const ui = useUI();

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data ?? []).filter((c) => !t || [c.name, c.role, c.email, c.account_name].some((s) => s?.toLowerCase().includes(t)));
  }, [data, q]);

  return (
    <div className="rise mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[28px] sm:text-[34px]">Contacts</h1>
          <p className="mt-1.5 text-sm text-muted">{data ? `${data.length} people` : "\u00a0"}</p>
        </div>
        <Button variant="accent" onClick={() => ui.openCapture("contact")}>
          <Plus /> Add contact
        </Button>
      </header>

      <div className="relative mb-4 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name, role, company…" className="h-9 pl-8 text-[13px]" />
      </div>

      {error && <p className="text-sm text-late">{error}</p>}
      {data && rows.length === 0 ? (
        <p className="card py-12 text-center text-muted">{data.length ? "No contacts match." : "No contacts yet."}</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="data min-w-[680px]">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Role</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Last contact</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} onClick={() => navigate(`/contacts/${c.id}`)} className="cursor-pointer">
                  <td>
                    <span className="flex items-center gap-2.5">
                      <Avatar name={c.name} size="sm" className="rounded-full" />
                      <span className="font-semibold">{c.name}</span>
                      {c.do_not_contact && <span className="rounded-full bg-late-soft px-2 py-0.5 text-[11.5px] font-semibold text-late">Do not contact</span>}
                    </span>
                  </td>
                  <td className="text-muted">{c.account_name}</td>
                  <td className="text-muted">{[c.role, buyingRoleLabel(c.buying_role)].filter(Boolean).join(" · ")}</td>
                  <td className="text-muted">{c.email}</td>
                  <td className="whitespace-nowrap text-muted">{c.phone}</td>
                  <td className="whitespace-nowrap text-muted">{dmy(c.last_contacted_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
