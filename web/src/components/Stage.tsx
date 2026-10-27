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
