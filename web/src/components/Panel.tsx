import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Section label above a card: monospace caps, a count, actions on the right. */
export function PanelHead({
  title,
  count,
  tone,
  children,
}: {
  title: ReactNode;
  count?: number;
  tone?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-2 flex min-h-7 flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h2 className={cn("label flex items-center gap-2", tone)}>
        {title}
        {count != null && count > 0 && <span className="text-faint">{count}</span>}
      </h2>
      {children && <div className="-mr-1.5 flex flex-wrap items-center gap-0.5">{children}</div>}
    </div>
  );
}

/** A titled, bordered group. */
export function Panel({
  title,
  count,
  tone,
  actions,
  children,
  className,
  id,
}: {
  title: ReactNode;
  count?: number;
  tone?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("min-w-0 scroll-mt-20", className)}>
      <PanelHead title={title} count={count} tone={tone}>
        {actions}
      </PanelHead>
      <div className="card overflow-hidden">{children}</div>
    </section>
  );
}

/** Quiet text for an empty group. */
export function PanelEmpty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-4 text-[13px] text-muted">{children}</p>;
}

/** Page title with an optional monospace line above and actions on the right. */
export function PageHeader({
  title,
  eyebrow,
  subtitle,
  actions,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        {eyebrow && <p className="label mb-2">{eyebrow}</p>}
        <h1 className="display text-[26px] sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[13.5px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex w-full items-center gap-2 sm:w-auto">{actions}</div>}
    </header>
  );
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-fg">
      <ArrowLeft className="size-3.5" />
      {children}
    </Link>
  );
}

/** A row of small bordered buttons for quick actions. */
export function ActionTiles({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap gap-1.5", className)}>{children}</div>;
}

export function ActionTile({
  icon: Icon,
  label,
  onClick,
  href,
}: {
  icon: typeof ArrowLeft;
  label: string;
  onClick?: () => void;
  href?: string;
}) {
  const cls =
    "inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] font-medium shadow-[var(--shadow-card)] transition-colors hover:bg-subtle [&_svg]:text-muted";
  const inner = (
    <>
      <Icon className="size-[15px]" />
      {label}
    </>
  );
  return href ? (
    <a href={href} className={cls} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
      {inner}
    </a>
  ) : (
    <button onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
