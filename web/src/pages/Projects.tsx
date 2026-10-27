import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleAlert, CircleCheck, Flag, Hourglass, Plus, Search, SquareKanban } from "lucide-react";
import { PROJECT_STAGES, type ProjectRow, type ProjectStage } from "@shared/model";
import { api, useApi } from "@/lib/api";
import { dmy, relative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUI } from "@/components/ui-context";
import { DuePill } from "@/components/TodoItem";
import { Avatar } from "@/components/Avatar";
import { STAGE_SHORT, StageDot } from "@/components/Stage";
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
              {stalled > 0 && <span className="text-missing"> · {stalled} need a next step</span>}
            </>
          )
        }
        actions={
          <>
            <div className="relative flex-1 sm:w-56 sm:flex-none">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-9 pl-8" aria-label="Filter projects" />
            </div>
            <Button onClick={() => ui.openCapture("project")}>
              <Plus /> New Project
            </Button>
          </>
        }
      />

      {error && <p className="text-sm text-late-text">{error}</p>}
      {data && data.length === 0 && (
        <div className="card flex flex-col items-center px-6 py-14 text-center">
          <SquareKanban className="mb-3 size-12 text-accent" strokeWidth={1.5} />
          <p className="title text-[20px]">No projects yet</p>
          <p className="mt-1 text-[15px] text-muted">Press P to add your first.</p>
        </div>
      )}

      {data && data.length > 0 && (
        <>
          {/* Phones: one stage at a time. */}
          <div className="mb-4 md:hidden">
            <div className="segmented flex w-full" role="radiogroup" aria-label="Stage">
              {PROJECT_STAGES.map(({ key }) => (
                <button key={key} role="radio" aria-checked={mobileStage === key} onClick={() => setMobileStage(key)} className="flex-1 !px-1">
                  {STAGE_SHORT[key]}
                  <span className="text-[12px] font-medium text-faint">{columns[key].length}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
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
                <h2 className="mb-2.5 hidden items-center gap-2 px-1 md:flex">
                  <StageDot stage={key} className="size-2.5" />
                  <span className="title text-[15px]">{label}</span>
                  <span className="text-[14px] font-medium text-faint">{columns[key].length}</span>
                </h2>
                <div
                  className={cn(
                    "grid content-start gap-2.5 rounded-[18px] p-0 transition-colors md:min-h-40 md:bg-[rgb(118_118_128/0.07)] md:p-2 xl:min-h-[60vh] dark:md:bg-white/[0.04]",
                    over === key && "bg-accent-soft ring-2 ring-accent/50 md:bg-accent-soft",
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
                    <p className="rounded-xl px-3 py-6 text-center text-[13px] text-faint">{dragId ? "Drop here" : "No projects"}</p>
                  )}
                  {key === "done" && (
                    <button onClick={() => setShowAllDone((v) => !v)} className="mx-2 mb-1 mt-0.5 text-left text-[13px] font-medium text-accent">
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
        "min-w-0 cursor-pointer rounded-[14px] bg-surface p-3.5 shadow-[var(--shadow-card)] transition-[box-shadow,transform] hover:-translate-y-px hover:shadow-[var(--shadow-lift)] active:scale-[0.99]",
        dragging && "opacity-40",
      )}
    >
      <h3 className={cn("text-[15px] font-semibold leading-snug", done && "text-muted")}>{p.name}</h3>
      {p.account_name && (
        <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
          <Avatar name={p.account_name} size="sm" className="!size-[18px] !rounded-[5px] !text-[8px]" />
          <span className="truncate">{p.account_name}</span>
        </p>
      )}

      {done ? (
        <p className="mt-3 flex items-center gap-1.5 text-[13px] text-green-text">
          <CircleCheck className="size-4" /> Done {p.done_at ? dmy(p.done_at) : ""}
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2 border-t border-line pt-2.5 text-[13px]">
          {p.stage === "waiting" && p.waiting_on && (
            <p className="flex min-w-0 items-center gap-1.5 text-muted">
              <Hourglass className="size-3.5 shrink-0 text-orange" />
              <span className="truncate">Waiting on {p.waiting_on}</span>
            </p>
          )}
          {next ? (
            <div className="flex min-w-0 items-center gap-2">
              <span className="size-3.5 shrink-0 rounded-full border-[1.5px] border-check" />
              <span className="min-w-0 flex-1 truncate">{next.title}</span>
              <DuePill due={next.due_date} time={next.due_time} />
            </div>
          ) : (
            <p className="flex items-center gap-1.5 font-medium text-missing">
              <CircleAlert className="size-4" /> No next step
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
