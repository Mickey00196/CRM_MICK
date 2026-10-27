import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, Flag, FolderKanban, Hourglass, Plus, Search } from "lucide-react";
import { PROJECT_STAGES, type ProjectRow, type ProjectStage } from "@shared/model";
import { api, useApi } from "@/lib/api";
import { dmy, relative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUI } from "@/components/ui-context";
import { DuePill } from "@/components/TodoItem";
import { Avatar } from "@/components/Avatar";
import { StageDot } from "@/components/Stage";

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

  const open = (data ?? []).filter((p) => p.stage !== "done");
  const stalled = open.filter((p) => !p.next_step).length;

  return (
    <div className="rise mx-auto max-w-7xl">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[28px] sm:text-[34px]">Projects</h1>
          {data && (
            <p className="mt-1.5 text-sm text-muted">
              {open.length} open
              {columns.waiting.length > 0 && <> · {columns.waiting.length} waiting on others</>}
              {stalled > 0 && <span className="text-missing"> · {stalled} without a next step</span>}
            </p>
          )}
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-60 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter projects" className="h-9 bg-surface pl-8 text-[13px]" aria-label="Filter projects" />
          </div>
          <Button variant="accent" onClick={() => ui.openCapture("project")}>
            <Plus /> New project
          </Button>
        </div>
      </header>

      {error && <p className="text-sm text-late">{error}</p>}
      {data && data.length === 0 && (
        <div className="card flex flex-col items-center px-6 py-14 text-center">
          <FolderKanban className="mb-3 size-9 text-accent" strokeWidth={1.5} />
          <p className="title text-lg">No projects yet</p>
          <p className="mt-1 text-sm text-muted">
            Press <kbd className="rounded border border-line bg-subtle px-1 text-xs">P</kbd> to add your first.
          </p>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PROJECT_STAGES.map(({ key, label }) => (
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
              className={cn(
                "min-w-0 rounded-2xl border border-transparent bg-subtle/70 p-2 transition-colors xl:min-h-[60vh]",
                over === key && "border-accent/40 bg-accent-soft",
              )}
            >
              <h2 className="flex items-center gap-2 px-2 pb-2.5 pt-1.5">
                <StageDot stage={key} className="size-2.5" />
                <span className="title text-[14px]">{label}</span>
                <span className="ml-auto rounded-full bg-surface px-2 py-px text-[12px] font-semibold tabular-nums text-muted shadow-[var(--shadow-card)]">
                  {columns[key].length}
                </span>
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
                {columns[key].length === 0 && key !== "done" && (
                  <p className="rounded-xl border border-dashed border-line-strong px-3 py-5 text-center text-[13px] text-faint">
                    {dragId ? "Drop here" : "Nothing here"}
                  </p>
                )}
                {key === "done" && (
                  <button onClick={() => setShowAllDone((v) => !v)} className="mx-2 mb-1 mt-1 text-left text-[13px] text-muted hover:text-fg">
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
  const next = p.next_step;
  const done = p.stage === "done";

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
        "group min-w-0 cursor-pointer rounded-xl border border-line bg-surface p-3.5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-px hover:border-line-strong hover:shadow-[var(--shadow-lift)]",
        dragging && "rotate-1 opacity-40",
        done && "bg-surface/70",
      )}
    >
      <div className="flex items-start gap-2.5">
        {p.account_name && <Avatar name={p.account_name} size="sm" className="mt-px" />}
        <div className="min-w-0 flex-1">
          <h3 className={cn("text-[14.5px] font-semibold leading-snug", done && "text-muted line-through decoration-line-strong")}>{p.name}</h3>
          {p.account_name && <p className="mt-0.5 truncate text-[12.5px] text-muted">{p.account_name}</p>}
        </div>
      </div>

      {done ? (
        <p className="mt-2.5 flex items-center gap-1.5 text-[12.5px] text-faint">
          <CheckCircle2 className="size-3.5" /> Done {p.done_at ? dmy(p.done_at) : ""}
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-1.5 text-[12.5px]">
          {p.stage === "waiting" && p.waiting_on && (
            <p className="flex items-center gap-1.5 truncate text-muted">
              <Hourglass className="size-3.5 shrink-0 text-stage-waiting" />
              <span className="truncate">Waiting on {p.waiting_on}</span>
            </p>
          )}
          {next ? (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-subtle/70 px-2.5 py-1.5">
              <span className="flex min-w-0 items-center gap-1.5">
                <ArrowRight className="size-3.5 shrink-0 text-accent" />
                <span className="truncate">{next.title}</span>
              </span>
              <DuePill due={next.due_date} time={next.due_time} />
            </div>
          ) : (
            <p className="flex items-center gap-1.5 rounded-lg bg-missing-soft px-2.5 py-1.5 font-medium text-missing">
              <AlertTriangle className="size-3.5" /> No next step
            </p>
          )}
          {p.target_date && (
            <p className="flex items-center gap-1.5 text-faint">
              <Flag className="size-3.5" /> Target {dmy(p.target_date)} · {relative(p.target_date)}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
