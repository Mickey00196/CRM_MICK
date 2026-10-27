import { cn } from "@/lib/utils";

/** The mark: a progress ring, half done, on a near-black tile. */
export function AppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-6 shrink-0", className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-fg" />
      <circle cx="16" cy="16" r="7.25" fill="none" strokeWidth="2.5" className="stroke-bg" />
      <path d="M16 8.75a7.25 7.25 0 0 1 0 14.5z" className="fill-bg" />
    </svg>
  );
}

export function Wordmark({ collapsed }: { collapsed?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <AppIcon />
      {!collapsed && <span className="text-[14px] font-semibold tracking-[-0.01em]">Mick CRM</span>}
    </span>
  );
}
