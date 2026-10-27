import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Search } from "lucide-react";
import { PROJECT_STAGES, type ProjectRow, type ProjectStage } from "@shared/model";
import { api, useApi } from "@/lib/api";
import { daysBetween, dmy, relative, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Chips, Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/dropdown";
import { Skeleton } from "@/components/Skeleton";
import { useStageChange } from "@/components/StageChange";
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
  const [mobileStage, setMobileStage] = useState<ProjectStage>("active");
  const ui = useUI();
  const [changeStage, stageDialog] = useStageChange();

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
    // Waiting and Done ask a quick question first; the board updates once it's saved.
    if (stage === "waiting" || stage === "done") return changeStage(p, stage);
    setData((rows) => rows?.map((x) => (x.id === id ? { ...x, stage, done_at: null } : x)) ?? null);
    await api(`/projects/${id}`, "PATCH", { stage }).catch(() => {});
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="title text-2xl">Projects</h1>
        <div className="flex items-center gap-2">
          <div className="relative w-44 sm:w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" className="h-8 pl-8 text-[13px]" aria-label="Filter projects" />
          </div>
          <Button variant="ghost" size="sm" onClick={() => ui.openCapture("project")} title="New project (P)">
            + New project
          </Button>
        </div>
      </header>

      {error && <p className="text-sm text-late">{error}</p>}
      {!data && !error && <Skeleton title={false} rows={5} className="max-w-none" />}
      {data && data.length === 0 && (
        <p className="py-12 text-center text-muted">
          No projects yet. Press <kbd className="rounded border border-line px-1 text-xs">P</kbd> to add your first.
        </p>
      )}

      {data && data.length > 0 && (
        <>
          {/* Phones: one stage at a time instead of four stacked columns. */}
          <Chips
            className="mb-5 md:hidden"
            size="sm"
            options={PROJECT_STAGES.map(({ key }) => ({ key, label: `${COLUMN_LABEL[key]} ${columns[key].length}` }))}
            value={mobileStage}
            onChange={setMobileStage}
          />
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
                className={cn(
                  "min-h-24 min-w-0 rounded-lg transition-colors md:block md:min-h-[60vh]",
                  over === key && "bg-accent-soft/60",
                  key !== mobileStage && "hidden",
                )}
              >
                <h2 className="label mb-3 hidden items-baseline justify-between border-b border-line pb-2 md:flex">
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
                      onMove={(stage) => move(p.id, stage)}
                    />
                  ))}
                  {columns[key].length === 0 && <p className="py-6 text-center text-[13px] text-faint md:hidden">Nothing here.</p>}
                  {key === "done" && (
                    <button onClick={() => setShowAllDone((v) => !v)} className="mt-1 text-left text-[13px] text-muted hover:text-fg">
                      {showAllDone ? "Show last 30 days only" : "Show all done"}
                    </button>
                  )}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
      {stageDialog}
    </div>
  );
}

/** Days since anything happened on an open project, or null when it's recent. */
function quietFor(p: ProjectRow, today: string): number | null {
  if (p.stage === "done") return null;
  const last = (p.last_activity_at ?? p.stage_changed_at)?.slice(0, 10);
  if (!last) return null;
  const days = daysBetween(last, today);
  return days >= 14 ? days : null;
}

function Card({
  project: p,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  project: ProjectRow;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (stage: ProjectStage) => void;
}) {
  const navigate = useNavigate();
  const ui = useUI();
  const today = todayISO();
  const next = p.next_step;
  const late = next?.due_date && next.due_date < today;
  const quiet = quietFor(p, today);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

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
      onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && navigate(`/projects/${p.id}`)}
      tabIndex={0}
      className={cn(
        "group/card min-w-0 cursor-pointer rounded-lg border border-line bg-surface px-3.5 py-3 transition-colors hover:border-line-strong",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-medium leading-snug">{p.name}</h3>
        {/* Clicks inside the menu (it renders in a portal) still bubble to the card; stop them here. */}
        <span onClick={stop} onKeyDown={stop} className="contents">
        <Menu>
          <MenuTrigger asChild>
            <button
              onClick={stop}
              className="-mr-1.5 -mt-1 grid size-7 shrink-0 place-items-center rounded-md text-faint opacity-0 transition-opacity hover:bg-hover hover:text-fg focus:opacity-100 group-hover/card:opacity-100 [@media(hover:none)]:opacity-100"
              aria-label={`Move ${p.name}`}
              title="Move to…"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuLabel>Move to</MenuLabel>
            {PROJECT_STAGES.filter((s) => s.key !== p.stage).map((s) => (
              <MenuItem key={s.key} onSelect={() => onMove(s.key)}>
                {s.label}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
        </span>
      </div>
      {p.account_name && <p className="mt-0.5 truncate text-[13px] text-muted">{p.account_name}</p>}

      {p.stage === "done" ? (
        <p className="mt-2 text-[13px] text-faint">Done {p.done_at ? dmy(p.done_at) : ""}</p>
      ) : (
        <div className="mt-2.5 border-t border-line pt-2 text-[13px]">
          {p.stage === "waiting" && p.waiting_on && <p className="mb-1 truncate text-muted">Waiting on {p.waiting_on}</p>}
          {next ? (
            <p className="flex items-baseline justify-between gap-3">
              <span className="truncate">{next.title}</span>
              <span className={cn("shrink-0", late ? "text-late" : "text-muted")} title={next.due_date ? dmy(next.due_date) : undefined}>
                {dueLabel(next.due_date, next.due_time, today)}
              </span>
            </p>
          ) : (
            <p className="flex items-center justify-between gap-3">
              <span className="text-missing">No next step</span>
              <button
                onClick={(e) => {
                  stop(e);
                  ui.openCapture("todo", {
                    project: { id: p.id, name: p.name, account_id: p.account_id, account_name: p.account_name },
                    account: p.account_id ? { id: p.account_id, name: p.account_name ?? "" } : null,
                  });
                }}
                className="rounded-md px-1.5 py-0.5 font-medium text-missing hover:bg-missing/10"
              >
                + Add
              </button>
            </p>
          )}
          {quiet !== null && <p className="mt-1 text-faint">No update in {quiet < 60 ? `${Math.round(quiet / 7)} weeks` : `${Math.round(quiet / 30.44)} months`}</p>}
          {p.target_date && <p className="mt-1 text-faint">Target {dmy(p.target_date)} ({relative(p.target_date)})</p>}
        </div>
      )}
    </article>
  );
}
