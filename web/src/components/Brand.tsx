import { useId } from "react";
import { cn } from "@/lib/utils";
import type { ProjectStage } from "@shared/model";

/** The mark: a blue tile with a ticked circle. Same drawing as the favicon. */
export function Mark({ className }: { className?: string }) {
  // Each copy needs its own gradient id: a hidden copy (desktop sidebar on a phone) can't lend its gradient to another.
  const id = "mark" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg viewBox="0 0 32 32" className={cn("size-6 shrink-0", className)} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b7bff" />
          <stop offset="1" stopColor="#1d4fd8" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${id})`} />
      <circle cx="16" cy="16" r="7" fill="none" stroke="#fff" strokeWidth="2.5" />
      <path d="M12.6 16.2l2.4 2.4 4.6-5" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <Mark className="size-[22px]" />
      <span className="title text-[15px]">Mick CRM</span>
    </span>
  );
}

/** A small status light per stage: open ring, live blue, paused grey, done ink. */
export function StageDot({ stage, className }: { stage: ProjectStage; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        stage === "todo" && "border-[1.5px] border-faint",
        stage === "active" && "bg-accent shadow-[0_0_0_3px_var(--accent-soft)]",
        stage === "waiting" && "bg-faint",
        stage === "done" && "bg-fg",
        className,
      )}
    />
  );
}
