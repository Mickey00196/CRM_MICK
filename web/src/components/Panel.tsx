import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Header row of a card: a title, an optional count and actions on the right. */
export function PanelHead({ title, count, children }: { title: string; count?: number; children?: ReactNode }) {
  return (
    <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2 sm:px-5">
      <h2 className="flex items-center gap-2">
        <span className="title text-[15px]">{title}</span>
        {count != null && count > 0 && (
          <span className="rounded-full bg-subtle px-1.5 text-[11px] font-semibold tabular-nums text-muted">{count}</span>
        )}
      </h2>
      {children}
    </div>
  );
}

/** A white card with a header row. */
export function Panel({
  title,
  count,
  actions,
  children,
  className,
}: {
  title: string;
  count?: number;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("card overflow-hidden", className)}>
      <PanelHead title={title} count={count}>
        {actions}
      </PanelHead>
      {children}
    </section>
  );
}

/** Quiet text for an empty panel. */
export function PanelEmpty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-5 text-sm text-muted sm:px-5">{children}</p>;
}
