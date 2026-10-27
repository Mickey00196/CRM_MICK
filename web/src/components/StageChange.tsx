import { useState, type ReactNode } from "react";
import type { ProjectStage } from "@shared/model";
import { shortDate } from "@shared/dates";
import { api } from "@/lib/api";
import { addDays, todayISO, workday } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Chips, ErrorText, Field, Input, Textarea } from "@/components/ui/input";
import { toast } from "./Toast";

export interface StageTarget {
  id: string;
  name: string;
  stage: ProjectStage;
  waiting_on?: string | null;
  open_tasks?: number;
}

/**
 * Changing a project's stage. Waiting asks who you're waiting on and when to check back
 * (that becomes a to-do), Done offers to close open to-dos and note the outcome.
 * Other stages change straight away.
 */
export function useStageChange(onChanged?: () => void): [(p: StageTarget, stage: ProjectStage) => void, ReactNode] {
  const [pending, setPending] = useState<{ project: StageTarget; stage: "waiting" | "done" } | null>(null);

  function change(project: StageTarget, stage: ProjectStage) {
    if (stage === project.stage) return;
    if (stage === "waiting" || stage === "done") {
      setPending({ project, stage });
      return;
    }
    api(`/projects/${project.id}`, "PATCH", { stage })
      .then(onChanged)
      .catch((e) => toast((e as Error).message));
  }

  const close = () => setPending(null);
  const element = (
    <Dialog open={pending !== null} onOpenChange={(o) => !o && close()} title={pending?.stage === "done" ? "Mark as done" : "Waiting on someone"}>
      {pending?.stage === "waiting" && (
        <WaitingForm
          project={pending.project}
          onDone={() => {
            close();
            onChanged?.();
          }}
        />
      )}
      {pending?.stage === "done" && (
        <DoneForm
          project={pending.project}
          onDone={() => {
            close();
            onChanged?.();
          }}
        />
      )}
    </Dialog>
  );
  return [change, element];
}

const CHECK_BACK = [
  { key: "3", label: "In 3 days" },
  { key: "7", label: "Next week" },
  { key: "14", label: "In 2 weeks" },
] as const;

function WaitingForm({ project, onDone }: { project: StageTarget; onDone: () => void }) {
  const today = todayISO();
  const [waitingOn, setWaitingOn] = useState(project.waiting_on ?? "");
  const [checkBack, setCheckBack] = useState(workday(addDays(today, 7)));
  const [followUp, setFollowUp] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preset = CHECK_BACK.find((c) => workday(addDays(today, Number(c.key))) === checkBack)?.key ?? null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/projects/${project.id}`, "PATCH", {
        stage: "waiting",
        waiting_on: waitingOn.trim(),
        follow_up: followUp && checkBack ? { title: `Follow up: ${waitingOn.trim() || project.name}`, due_date: checkBack } : undefined,
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4 p-5">
      <Field label="What are you waiting for?">
        <Input value={waitingOn} onChange={(e) => setWaitingOn(e.target.value)} placeholder="e.g. landlord's counter-offer" autoFocus />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-[var(--fg)]" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} />
        Remind me to follow up
      </label>
      {followUp && (
        <div className="flex flex-wrap items-center gap-2">
          <Chips options={CHECK_BACK} value={preset} onChange={(k) => setCheckBack(workday(addDays(today, Number(k))))} size="sm" />
          <Input type="date" value={checkBack} min={today} onChange={(e) => setCheckBack(e.target.value)} className="h-7 w-auto px-2 text-[13px]" aria-label="Follow up on" />
        </div>
      )}
      {followUp && checkBack && (
        <p className="text-[13px] text-muted">
          Adds “Follow up: {waitingOn.trim() || project.name}” on {shortDate(checkBack, today)}.
        </p>
      )}
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end">
        <Button disabled={busy}>Move to Waiting</Button>
      </div>
    </form>
  );
}

function DoneForm({ project, onDone }: { project: StageTarget; onDone: () => void }) {
  const open = project.open_tasks ?? 0;
  const [outcome, setOutcome] = useState("");
  const [closeTasks, setCloseTasks] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/projects/${project.id}`, "PATCH", {
        stage: "done",
        outcome_note: outcome.trim() || undefined,
        close_open_tasks: open > 0 && closeTasks,
      });
      toast(`Done: ${project.name}`);
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4 p-5">
      <Field label="How did it end? (optional, goes in the log)">
        <Textarea rows={3} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="e.g. Signed 5 years at Zuidas, 1,200 m²" autoFocus />
      </Field>
      {open > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--fg)]" checked={closeTasks} onChange={(e) => setCloseTasks(e.target.checked)} />
          Close the {open === 1 ? "open to-do" : `${open} open to-dos`}
        </label>
      )}
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end">
        <Button disabled={busy}>Mark as done</Button>
      </div>
    </form>
  );
}
