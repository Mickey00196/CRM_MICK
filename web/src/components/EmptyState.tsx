import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** A friendly first screen: what goes here, and one big button to add it. */
export function EmptyState({ icon: Icon, title, text, children }: { icon: LucideIcon; title: string; text: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-line bg-surface px-6 py-14 text-center sm:py-20">
      <span className="mb-5 grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent-text">
        <Icon className="size-7" strokeWidth={1.75} />
      </span>
      <h2 className="title text-xl">{title}</h2>
      <p className="mt-2 max-w-md text-muted">{text}</p>
      {children && <div className="mt-8 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}
