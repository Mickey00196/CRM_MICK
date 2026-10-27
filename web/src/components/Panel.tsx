import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Section title above a grouped list, with actions on the right (iOS style). */
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
    <div className="mb-2 flex min-h-8 flex-wrap items-end justify-between gap-x-3 gap-y-1 px-1">
      <h2 className={cn("title flex items-baseline gap-2 text-[20px]", tone)}>
        {title}
        {count != null && count > 0 && <span className="text-[15px] font-medium text-faint">{count}</span>}
      </h2>
      {children && <div className="-mr-2 flex flex-wrap items-center">{children}</div>}
    </div>
  );
}

/** A titled, rounded group. */
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
  return <p className="px-4 py-4 text-[15px] text-muted">{children}</p>;
}

/** Large title with an optional line above and actions on the right. */
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
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[13px] font-semibold uppercase tracking-[0.02em] text-muted">{eyebrow}</p>}
        <h1 className="display text-[32px] sm:text-[36px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex w-full items-center gap-2 sm:w-auto">{actions}</div>}
    </header>
  );
}

/** "‹ Projects" in the accent colour, like an iOS back button. */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="-ml-1.5 mb-3 inline-flex items-center text-[15px] text-accent hover:opacity-70">
      <ChevronLeft className="size-[22px]" strokeWidth={2.2} />
      {children}
    </Link>
  );
}

/** Row of quick actions, like the call / message / mail buttons on an iOS contact card. */
export function ActionTiles({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0", className)}>{children}</div>;
}

export function ActionTile({
  icon: Icon,
  label,
  onClick,
  href,
}: {
  icon: typeof ChevronLeft;
  label: string;
  onClick?: () => void;
  href?: string;
}) {
  const inner = (
    <>
      <Icon className="size-[20px]" strokeWidth={2} />
      <span className="text-[11px] font-medium">{label}</span>
    </>
  );
  const cls =
    "card flex min-w-[72px] flex-1 flex-col items-center gap-1 px-2 pb-2 pt-2.5 text-accent transition-transform hover:bg-[color-mix(in_srgb,var(--surface)_94%,var(--accent))] active:scale-[0.97] sm:max-w-[96px]";
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
