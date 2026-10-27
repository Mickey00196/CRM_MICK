import { useId } from "react";
import { cn } from "@/lib/utils";

/** App icon: a white check on a blue squircle. */
export function AppIcon({ className }: { className?: string }) {
  // Unique gradient ids: a hidden copy of the icon (e.g. the desktop sidebar on a phone) would otherwise blank this one.
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7 shrink-0", className)} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4aa3ff" />
          <stop offset="1" stopColor="#0062e6" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7.5" fill={`url(#${id}-fill)`} />
      <rect width="32" height="32" rx="7.5" fill={`url(#${id}-shine)`} />
      <path d="M9.5 16.5l4.2 4.2L22.5 11.5" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ collapsed }: { collapsed?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <AppIcon className="drop-shadow-[0_1px_2px_rgb(0_98_230/0.35)]" />
      {!collapsed && <span className="title text-[15px]">Mick CRM</span>}
    </span>
  );
}
