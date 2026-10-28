import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A white panel with a quiet header: the building block of the account page. */
export function Card({
  title,
  icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("@container rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgb(15_20_26/0.04)] [--row-bg:var(--surface)]", className)}>
      {title && (
        <header className="flex min-h-12 items-center justify-between gap-3 border-b border-line px-5 py-2.5">
          <h2 className="label flex items-center gap-2">
            {icon}
            {title}
          </h2>
          {action}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
