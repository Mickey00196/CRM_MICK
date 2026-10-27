import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Plus, Search as SearchIcon } from "lucide-react";
import type { SearchHit } from "@shared/model";
import { api } from "@/lib/api";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useUI } from "./ui-context";

const KIND: Record<SearchHit["kind"], string> = {
  project: "Project",
  account: "Account",
  contact: "Contact",
  task: "To-do",
  activity: "Logged",
};

interface Command {
  label: string;
  key?: string;
  icon: typeof Plus;
  run: () => void;
}

type Item = { kind: "command"; command: Command } | { kind: "hit"; hit: SearchHit };

/** ⌘K: search everything, or type what you want to do ("new project", "go to log"). */
export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const ui = useUI();
  const seq = useRef(0);

  const commands: Command[] = useMemo(
    () => [
      { label: "New to-do", key: "N", icon: Plus, run: () => ui.openCapture("todo") },
      { label: "New account", key: "A", icon: Plus, run: () => ui.openCapture("account") },
      { label: "Log a call, email or note", key: "L", icon: Plus, run: () => ui.openCapture("log") },
      { label: "New contact", icon: Plus, run: () => ui.openCapture("contact") },
      { label: "Go to To-dos", icon: ArrowRight, run: () => navigate("/") },
      { label: "Go to Accounts", icon: ArrowRight, run: () => navigate("/accounts") },
      { label: "Go to Weekly review", icon: ArrowRight, run: () => navigate("/review") },
      { label: "Go to Contacts", icon: ArrowRight, run: () => navigate("/contacts") },
      { label: "Go to Log", icon: ArrowRight, run: () => navigate("/communication") },
      { label: "Go to Settings", icon: ArrowRight, run: () => navigate("/settings") },
    ],
    [ui, navigate],
  );

  useEffect(() => {
    if (!open) {
      setQ("");
      setHits([]);
      setActive(0);
    }
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
        })
        .catch(() => {});
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  // Matching commands first (a few), then records.
  const items: Item[] = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matching = commands.filter((c) => words.every((w) => c.label.toLowerCase().includes(w)));
    const shown = words.length ? matching.slice(0, 4) : matching.slice(0, 5);
    return [...shown.map((command) => ({ kind: "command" as const, command })), ...hits.map((hit) => ({ kind: "hit" as const, hit }))];
  }, [q, hits, commands]);

  useEffect(() => setActive(0), [items.length]);

  function choose(item: Item | undefined) {
    if (!item) return;
    onClose();
    if (item.kind === "command") return item.command.run();
    const h = item.hit;
    if (h.kind === "project") navigate(`/projects/${h.id}`);
    else if (h.kind === "account") navigate(`/accounts/${h.id}`);
    else if (h.kind === "contact") navigate(`/contacts/${h.id}`);
    else if (h.kind === "task") ui.openTask(h.id);
    else if (h.project_id) navigate(`/projects/${h.project_id}`);
    else if (h.account_id) navigate(`/accounts/${h.account_id}?tab=communication`);
  }

  const term = q.trim();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title="Search or run a command" hideTitle className="top-[10vh]">
      <div className="flex items-center gap-3 border-b border-line px-4">
        <SearchIcon className="size-4 text-accent-text" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(items[active]);
            }
          }}
          placeholder="Search, or type a command like “new account”"
          className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-faint"
          aria-label="Search or run a command"
        />
      </div>
      <ul className="max-h-[55vh] overflow-y-auto p-2" role="listbox">
        {items.map((item, i) => (
          <li
            key={item.kind === "command" ? `c-${item.command.label}` : `${item.hit.kind}-${item.hit.id}`}
            role="option"
            aria-selected={i === active}
            onMouseEnter={() => setActive(i)}
            onClick={() => choose(item)}
            className={cn("flex cursor-pointer items-baseline gap-3 rounded-md px-3 py-2", i === active && "bg-accent-soft [&_svg]:text-accent-text")}
          >
            {item.kind === "command" ? (
              <>
                <item.command.icon className="relative top-[2px] size-3.5 w-16 shrink-0 text-faint" />
                <span className="min-w-0 flex-1 truncate text-sm">{item.command.label}</span>
                {item.command.key && <kbd className="keycap">{item.command.key}</kbd>}
              </>
            ) : (
              <>
                <span className="w-16 shrink-0 text-xs text-faint">{KIND[item.hit.kind]}</span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {item.hit.title}
                  {item.hit.subtitle && <span className="text-muted"> · {item.hit.subtitle}</span>}
                </span>
              </>
            )}
          </li>
        ))}
        {term.length >= 2 && items.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">No matches for “{term}”.</li>}
      </ul>
    </Dialog>
  );
}
