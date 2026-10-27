import { cn } from "@/lib/utils";

/** Monogram: a serif M on an ink tile. */
export function AppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7 shrink-0", className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-fg" />
      <text
        x="16"
        y="23.2"
        textAnchor="middle"
        className="fill-bg"
        style={{ fontFamily: "var(--font-serif)", fontSize: "22px" }}
      >
        M
      </text>
    </svg>
  );
}

export function Wordmark({ collapsed }: { collapsed?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <AppIcon />
      {!collapsed && (
        <span className="flex items-baseline gap-1.5">
          <span className="serif text-[21px] leading-none">Mick</span>
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">CRM</span>
        </span>
      )}
    </span>
  );
}
