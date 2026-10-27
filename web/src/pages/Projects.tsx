import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CircleDashed, Flag, Hourglass, Plus, Search, SquareKanban } from "lucide-react";
import { PROJECT_STAGES, type ProjectRow, type ProjectStage } from "@shared/model";
import { api, useApi } from "@/lib/api";
import { dmy, relative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUI } from "@/components/ui-context";
import { DuePill } from "@/components/TodoItem";
import { Avatar } from "@/components/Avatar";
import { STAGE_SHORT, StageIcon } from "@/components/Stage";
import { PageHeader } from "@/components/Panel";

/** Where every project is: four columns, drag a card to move it. */
export function Projects() {
  const [showAllDone, setShowAllDone] = useState(false);
  const { data, error, setData } = useApi<ProjectRow[]>(`/projects${showAllDone ? "?all=1" : ""}`);
  const [q, setQ] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<ProjectStage | null>(null);
  const [mobileStage, setMobileStage] = useState<ProjectStage>("active");
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
      <PageHeader
        title="Projects"
        subtitle={
          data && (
            <>
              {open.length} open
              {columns.waiting.length > 0 && <> · {columns.waiting.length} waiting on others</>}
              {stalled > 0 && <> · {stalled} without a next step</>}
            </>
          )
        }
        actions={
          <>
            <div className="relative flex-1 sm:w-56 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" className="h-9 pl-8" aria-label="Filter projects" />
            </div>
            <Button onClick={() => ui.openCapture("project")}>
              <Plus /> New project
            </Button>
          </>
        }
      />

      {error && <p className="text-sm text-late-text">{error}</p>}
      {data && data.length === 0 && (
        <p className="serif text-[24px] italic text-muted">No projects yet. Press P to add the first.</p>
      )}

      {data && data.length > 0 && (
        <>
          {/* Phones: one stage at a time. */}
          <div className="mb-4 md:hidden">
            <div className="segmented flex w-full" role="radiogroup" aria-label="Stage">
              {PROJECT_STAGES.map(({ key }) => (
                <button key={key} role="radio" aria-checked={mobileStage === key} onClick={() => setMobileStage(key)} className="flex-1 !px-1">
                  {STAGE_SHORT[key]}
                  <span className="mono text-[11px] text-faint">{columns[key].length}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
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
                className={cn("min-w-0", mobileStage !== key && "hidden md:block")}
              >
                <h2 className="mb-4 hidden items-center gap-2.5 border-b border-line pb-3 md:flex">
                  <StageIcon stage={key} />
                  <span className="text-[14px] font-medium">{label}</span>
                  <span className="mono text-[12.5px] text-faint">{columns[key].length}</span>
                </h2>
                <div
                  className={cn(
                    "-m-1.5 grid content-start gap-3 rounded-2xl border border-dashed border-transparent p-1.5 transition-colors duration-200 md:min-h-40 xl:min-h-[60vh]",
                    over === key && "border-line-strong bg-subtle/60",
                  )}
                >
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
                  {columns[key].length === 0 && (
                    <p className="serif py-4 text-[16px] italic text-faint">{dragId ? "Drop here" : "Nothing here"}</p>
                  )}
                  {key === "done" && (
                    <button onClick={() => setShowAllDone((v) => !v)} className="mt-1 text-left text-[13px] text-muted underline-offset-4 hover:text-fg hover:underline">
                      {showAllDone ? "Show last 30 days only" : "Show all done"}
                    </button>
                  )}
                </div>
              </section>
            ))}
          </div>
        </>
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
        "min-w-0 cursor-pointer rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-card)] transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-px hover:border-line-strong hover:shadow-[var(--shadow-lift)]",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-2">
        <StageIcon stage={p.stage} className="mt-[3px]" />
        <h3 className={cn("min-w-0 flex-1 text-[14.5px] font-medium leading-snug", done && "text-muted")}>{p.name}</h3>
      </div>
      {p.account_name && (
        <p className="mt-1 truncate pl-[22px] text-[13px] text-muted">{p.account_name}</p>
      )}

      {done ? (
        <p className="mono mt-3 pl-[22px] text-[12.5px] text-faint">Done {p.done_at ? dmy(p.done_at) : ""}</p>
      ) : (
        <div className="mt-3.5 grid grid-cols-[minmax(0,1fr)] gap-2 border-t border-line pt-3 text-[13px]">
          {p.stage === "waiting" && p.waiting_on && (
            <p className="flex min-w-0 items-center gap-1.5 text-muted">
              <Hourglass className="size-3.5 shrink-0" />
              <span className="truncate">Waiting on {p.waiting_on}</span>
            </p>
          )}
          {next ? (
            <div className="flex min-w-0 items-center gap-1.5">
              <ArrowRight className="size-3.5 shrink-0 text-faint" />
              <span className="min-w-0 flex-1 truncate">{next.title}</span>
              <DuePill due={next.due_date} time={next.due_time} />
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-muted">
              <CircleDashed className="size-3.5" /> No next step
            </p>
          )}
          {p.target_date && (
            <p className="flex items-center gap-1.5 text-faint">
              <Flag className="size-3.5" /> <span className="mono">{dmy(p.target_date)}</span> · {relative(p.target_date)}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
