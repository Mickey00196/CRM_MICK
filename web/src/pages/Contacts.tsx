import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { buyingRoleLabel, type Contact } from "@shared/model";
import { api, useLoad } from "@/lib/api";
import { dmy } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUI } from "@/components/ui-context";

export function Contacts() {
  const { data, error } = useLoad(() => api<Contact[]>("/contacts"), []);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const ui = useUI();

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data ?? []).filter((c) => !t || [c.name, c.role, c.email, c.account_name].some((s) => s?.toLowerCase().includes(t)));
  }, [data, q]);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="title text-2xl">Contacts</h1>
        <Button variant="ghost" size="sm" onClick={() => ui.openCapture("contact")}>
          + Add contact
        </Button>
      </header>

      <div className="relative mb-4 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name, role, account…" className="h-8 pl-8 text-[13px]" />
      </div>

      {error && <p className="text-sm text-late">{error}</p>}
      {data && rows.length === 0 ? (
        <p className="py-12 text-center text-muted">{data.length ? "No contacts match." : "No contacts yet."}</p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[13px] text-muted">
                <th className="py-2 pr-4 font-normal">Name</th>
                <th className="py-2 pr-4 font-normal">Account</th>
                <th className="py-2 pr-4 font-normal">Role</th>
                <th className="py-2 pr-4 font-normal">Email</th>
                <th className="py-2 pr-4 font-normal">Phone</th>
                <th className="py-2 pr-4 font-normal">Last contact</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} onClick={() => navigate(`/contacts/${c.id}`)} className="cursor-pointer border-b border-line hover:bg-hover/60">
                  <td className="py-3 pr-4 font-medium">
                    {c.name}
                    {c.do_not_contact && <span className="ml-2 text-[13px] font-normal text-late">Do not contact</span>}
                  </td>
                  <td className="py-3 pr-4 text-muted">{c.account_name}</td>
                  <td className="py-3 pr-4 text-muted">{[c.role, buyingRoleLabel(c.buying_role)].filter(Boolean).join(" · ")}</td>
                  <td className="py-3 pr-4 text-muted">{c.email}</td>
                  <td className="py-3 pr-4 text-muted">{c.phone}</td>
                  <td className="py-3 pr-4 text-muted">{dmy(c.last_contacted_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
