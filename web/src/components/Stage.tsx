import type { ProjectStage } from "@shared/model";
import { cn } from "@/lib/utils";

export const STAGE_SHORT: Record<ProjectStage, string> = { todo: "To do", active: "Active", waiting: "Waiting", done: "Done" };

/**
 * Status glyphs instead of colours: an empty ring for to do, a half-filled ring
 * for active, a paused ring for waiting, a filled check for done.
 */
export function StageIcon({ stage, className }: { stage: ProjectStage; className?: string }) {
  const cls = cn("size-3.5 shrink-0", stage === "todo" || stage === "done" ? "text-faint" : "text-fg", className);
  return (
    <svg viewBox="0 0 14 14" className={cls} aria-hidden="true" fill="none">
      {stage === "todo" && <circle cx="7" cy="7" r="5.75" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.2 1.8" />}
      {stage === "active" && (
        <>
          <circle cx="7" cy="7" r="5.75" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 3.25a3.75 3.75 0 0 1 0 7.5z" fill="currentColor" />
        </>
      )}
      {stage === "waiting" && (
        <>
          <circle cx="7" cy="7" r="5.75" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5.6 5v4M8.4 5v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
      {stage === "done" && (
        <>
          <circle cx="7" cy="7" r="6.5" fill="currentColor" />
          <path d="M4.4 7.2l1.8 1.8 3.4-3.6" stroke="var(--surface)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

/** Kept for existing call sites. */
export const StageDot = StageIcon;
