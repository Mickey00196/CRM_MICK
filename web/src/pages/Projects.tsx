import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { PROJECT_STAGES, type ProjectRow, type ProjectStage } from "@shared/model";
import { api, useApi } from "@/lib/api";
import { dmy, relative, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUI } from "@/components/ui-context";
import { dueLabel } from "@/components/TodoItem";

const COLUMN_LABEL: Record<ProjectStage, string> = { todo: "To do", active: "Active", waiting: "Waiting", done: "Done" };

/** Where every project is: four columns, drag a card to move it. */
export function Projects() {
  const [showAllDone, setShowAllDone] = useState(false);
  const { data, error, setData } = useApi<ProjectRow[]>(`/projects${showAllDone ? "?all=1" : ""}`);
  const [q, setQ] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<ProjectStage | null>(null);
  const ui = useUI();

  const columns = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = (data ?? []).filter((p) => !t || p.name.toLowerCase().includes(t) || (p.account_name ?? "").toLowerCase().includes(t));
    const by: Record<ProjectStage, ProjectRow[]> = { todo: [], active: [], waiting: [], done: [] };
    for (const p of list) by[p.stage].push(p);
    // Most urgent next step first; projects without one float to the top so they get seen.
    const urgency = (p: ProjectRow) => (p.next_step ? p.next_step.due_date ?? "9999" : "0000");
    for (const s of ["todo", "active", "waiting"] as const) by[s].sort((a, b) => urgency(a).localeCompare(urgency(b)) || a.name.localeCompare(b.name));
    by.done.sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));
    return by;
  }, [data, q]);

  async function move(id: string, stage: ProjectStage) {
    const p = data?.find((x) => x.id === id);
    if (!p || p.stage === stage) return;
    setData((rows) => rows?.map((x) => (x.id === id ? { ...x, stage, done_at: stage === "done" ? new Date().toISOString() : null } : x)) ?? null);
    await api(`/projects/${id}`, "PATCH", { stage }).catch(() => {});
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="title text-2xl">Projects</h1>
        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" className="h-8 pl-8 text-[13px]" aria-label="Filter projects" />
          </div>
          <Button variant="ghost" size="sm" onClick={() => ui.openCapture("project")}>
            + New project
          </Button>
        </div>
      </header>

      {error && <p className="text-sm text-late">{error}</p>}
      {data && data.length === 0 && (
        <p className="py-12 text-center text-muted">
          No projects yet. Press <kbd className="rounded border border-line px-1 text-xs">P</kbd> to add your first.
        </p>
      )}

      {data && data.length > 0 && (
        <div className="grid gap-8 md:grid-cols-4 md:gap-5">
          {PROJECT_STAGES.map(({ key }) => (
            <section
              key={key}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setOver(key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) move(dragId, key);
                setDragId(null);
                setOver(null);
              }}
              className={cn("min-h-24 min-w-0 rounded-lg transition-colors md:min-h-[60vh]", over === key && "bg-accent-soft/60")}
            >
              <h2 className="label mb-3 flex items-baseline justify-between border-b border-line pb-2">
                {COLUMN_LABEL[key]}
                <span className="font-normal normal-case tracking-normal text-faint">{columns[key].length}</span>
              </h2>
              <div className="grid gap-2">
                {columns[key].map((p) => (
                  <Card
                    key={p.id}
                    project={p}
                    dragging={dragId === p.id}
                    onDragStart={() => setDragId(p.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOver(null);
                    }}
                  />
                ))}
                {key === "done" && (
                  <button onClick={() => setShowAllDone((v) => !v)} className="mt-1 text-left text-[13px] text-muted hover:text-fg">
                    {showAllDone ? "Show last 30 days only" : "Show all done"}
                  </button>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Card({
  project: p,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  project: ProjectRow;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const navigate = useNavigate();
  const today = todayISO();
  const next = p.next_step;
  const late = next?.due_date && next.due_date < today;

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", p.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={() => navigate(`/projects/${p.id}`)}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/projects/${p.id}`)}
      tabIndex={0}
      className={cn(
        "min-w-0 cursor-pointer rounded-lg border border-line bg-surface px-3.5 py-3 transition-colors hover:border-line-strong",
        dragging && "opacity-40",
      )}
    >
      <h3 className="text-[15px] font-medium leading-snug">{p.name}</h3>
      {p.account_name && <p className="mt-0.5 truncate text-[13px] text-muted">{p.account_name}</p>}

      {p.stage === "done" ? (
        <p className="mt-2 text-[13px] text-faint">Done {p.done_at ? dmy(p.done_at) : ""}</p>
      ) : (
        <div className="mt-2.5 border-t border-line pt-2 text-[13px]">
          {p.stage === "waiting" && p.waiting_on && <p className="mb-1 truncate text-muted">Waiting on {p.waiting_on}</p>}
          {next ? (
            <p className="flex items-baseline justify-between gap-3">
              <span className="truncate">{next.title}</span>
              <span className={cn("shrink-0", late ? "text-late" : "text-muted")}>{dueLabel(next.due_date, next.due_time, today)}</span>
            </p>
          ) : (
            <p className="text-missing">No next step</p>
          )}
          {p.target_date && <p className="mt-1 text-faint">Target {dmy(p.target_date)} ({relative(p.target_date)})</p>}
        </div>
      )}
    </article>
  );
}
