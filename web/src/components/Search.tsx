import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search as SearchIcon } from "lucide-react";
import type { SearchHit } from "@shared/model";
import { api } from "@/lib/api";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useUI } from "./ui-context";

const KIND: Record<SearchHit["kind"], string> = {
  project: "Project",
  account: "Company",
  contact: "Contact",
  task: "To-do",
  activity: "Logged",
};

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const ui = useUI();
  const seq = useRef(0);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    const n = ++seq.current;
    const t = setTimeout(() => {
      api<SearchHit[]>(`/search?q=${encodeURIComponent(term)}`)
        .then((h) => {
          if (n !== seq.current) return;
          setHits(h);
          setActive(0);
        })
        .catch(() => {});
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  function go(h: SearchHit | undefined) {
    if (!h) return;
    onClose();
    if (h.kind === "project") navigate(`/projects/${h.id}`);
    else if (h.kind === "account") navigate(`/accounts/${h.id}`);
    else if (h.kind === "contact") navigate(`/contacts/${h.id}`);
    else if (h.kind === "task") ui.openTask(h.id);
    else if (h.project_id) navigate(`/projects/${h.project_id}`);
    else if (h.account_id) navigate(`/accounts/${h.account_id}?tab=communication`);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title="Search" hideTitle className="glass top-[14vh] bg-elevated/85">
      <div className="flex items-center gap-3 border-b border-line px-4">
        <SearchIcon className="size-5 text-muted" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              go(hits[active]);
            }
          }}
          placeholder="Search projects, companies, people, to-dos, notes…"
          className="h-14 flex-1 bg-transparent text-[20px] outline-none placeholder:text-faint"
          aria-label="Search"
        />
      </div>
      <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
        {q.trim().length >= 2 && hits.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">No matches for “{q.trim()}”.</li>}
        {q.trim().length < 2 && <li className="px-3 py-6 text-center text-sm text-faint">Type at least two letters.</li>}
        {hits.map((h, i) => (
          <li
            key={`${h.kind}-${h.id}`}
            role="option"
            aria-selected={i === active}
            onMouseEnter={() => setActive(i)}
            onClick={() => go(h)}
            className={cn(
              "flex cursor-pointer items-baseline gap-3 rounded-lg px-3 py-2",
              i === active && "bg-accent text-white [&_.text-faint]:text-white/70 [&_.text-muted]:text-white/75",
            )}
          >
            <span className="w-16 shrink-0 text-xs text-faint">{KIND[h.kind]}</span>
            <span className="min-w-0 flex-1 truncate text-[15px]">
              {h.title}
              {h.subtitle && <span className="text-muted"> · {h.subtitle}</span>}
            </span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
