import type { ProjectStage } from "@shared/model";
import { cn } from "@/lib/utils";

export const STAGE_DOT: Record<ProjectStage, string> = {
  todo: "bg-stage-todo",
  active: "bg-stage-active",
  waiting: "bg-stage-waiting",
  done: "bg-stage-done",
};

export const STAGE_TEXT: Record<ProjectStage, string> = {
  todo: "text-stage-todo",
  active: "text-stage-active",
  waiting: "text-stage-waiting",
  done: "text-stage-done",
};

export const STAGE_SHORT: Record<ProjectStage, string> = { todo: "To do", active: "Active", waiting: "Waiting", done: "Done" };

export function StageDot({ stage, className }: { stage: ProjectStage; className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-2 shrink-0 rounded-full", STAGE_DOT[stage], className)} />;
}

/** Small rounded label with the stage colour. */
export function StagePill({ stage, className }: { stage: ProjectStage; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-subtle px-2 py-0.5 text-xs font-medium", STAGE_TEXT[stage], className)}>
      <StageDot stage={stage} />
      {STAGE_SHORT[stage]}
    </span>
  );
}
