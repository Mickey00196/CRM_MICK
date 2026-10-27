import { cn } from "@/lib/utils";

/** Grey placeholder bars while a page loads, so it never looks broken or empty. */
export function Skeleton({ rows = 6, title = true, className }: { rows?: number; title?: boolean; className?: string }) {
  return (
    <div className={cn("mx-auto max-w-2xl animate-pulse", className)} aria-busy="true" aria-label="Loading">
      {title && <div className="mb-10 h-7 w-56 rounded-md bg-subtle" />}
      <div className="grid">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line py-4">
            <div className="size-5 shrink-0 rounded-full bg-subtle" />
            <div className="h-3.5 rounded bg-subtle" style={{ width: `${45 + ((i * 17) % 35)}%` }} />
            <div className="ml-auto h-3.5 w-14 rounded bg-subtle" />
          </div>
        ))}
      </div>
    </div>
  );
}
