import { useEffect, useRef, type ReactNode } from "react";
import { Check, ChevronRight } from "lucide-react";
import { ACCOUNT_STATUSES, FLOW, OPPORTUNITY_STAGES, nextStatus, phaseOf, type AccountStatus } from "@shared/model";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const label = (s: AccountStatus) => ACCOUNT_STATUSES.find((x) => x.key === s)!.label;

/**
 * Where the account is: Lead, the seven opportunity steps, Invoicing. Click a step to see what was
 * captured there (shown underneath); the buttons move the account ("Next: Viewing", "Move to RFP").
 */
export function StageFlow({
  status,
  selected,
  onSelect,
  onMove,
  footer,
}: {
  status: AccountStatus;
  /** The step whose details are shown below. */
  selected: AccountStatus;
  onSelect: (s: AccountStatus) => void;
  onMove: (s: AccountStatus) => void;
  /** A strip at the bottom of the card, e.g. the next follow-up. */
  footer?: ReactNode;
}) {
  const parked = status === "not_now";
  const at = FLOW.indexOf(status);
  const next = nextStatus(status);
  const phase = phaseOf(status);
  const step = OPPORTUNITY_STAGES.indexOf(status) + 1;
  const browsing = selected !== status && selected !== "not_now";

  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    const cur = el?.querySelector<HTMLElement>("[data-selected]");
    if (!el || !cur || el.scrollWidth <= el.clientWidth) return;
    const offset = cur.getBoundingClientRect().left - el.getBoundingClientRect().left;
    el.scrollLeft += offset - el.clientWidth / 2 + cur.offsetWidth / 2;
  }, [selected]);

  const action =
    status === "lead"
      ? "Start opportunity"
      : status === "agreement"
        ? "Move to invoicing"
        : next
          ? `Next: ${label(next)}`
          : null;

  return (
    <section className="rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgb(15_20_26/0.04)]" aria-label="Stage">
      <div className="p-4 sm:p-5">
        <div className="mb-4 flex min-h-8 flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            {browsing ? (
              <>
                <span className="font-medium">Looking at {label(selected)}</span>
                <span className="text-muted"> · {parked ? "parked as Not now" : `now at ${label(status)}`}</span>
              </>
            ) : parked ? (
              <span className="text-muted">Parked as Not now</span>
            ) : (
              <>
                <span className="font-medium">{label(status)}</span>
                <span className="text-muted">
                  {phase === "opportunity" ? ` · Opportunity, step ${step} of ${OPPORTUNITY_STAGES.length}` : phase === "invoicing" ? " · Final stage" : " · Company info and tracking"}
                </span>
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            {browsing ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => onSelect(status)}>
                  Back to {label(status)}
                </Button>
                <Button size="sm" variant="outline" onClick={() => onMove(selected)}>
                  Move to {label(selected)}
                </Button>
              </>
            ) : parked ? (
              <Button size="sm" onClick={() => onMove("lead")}>
                Reopen as lead
              </Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => onMove("not_now")} title="Parked or lost: drops off the board and out of the follow-up checks">
                  Not now
                </Button>
                {action && next && (
                  <Button size="sm" onClick={() => onMove(next)}>
                    {action} <ChevronRight />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* The steps. Scrolls sideways on narrow screens, starting at the selected step. */}
        <div ref={scroller} className="-mx-1 overflow-x-auto px-1">
          <div className={cn("grid min-w-[540px] grid-cols-9", parked && "[&_.dot]:opacity-50")}>
            <PhaseLabel span={1} text="Lead" active={phase === "lead"} />
            <PhaseLabel span={7} text="Opportunity" active={phase === "opportunity"} bracket />
            <PhaseLabel span={1} text="Invoicing" active={phase === "invoicing"} />
            {FLOW.map((s, i) => {
              const done = !parked && i < at;
              const current = !parked && i === at;
              const isSelected = s === selected;
              return (
                <button
                  key={s}
                  onClick={() => onSelect(s)}
                  className="group relative flex flex-col items-center gap-2 pb-3 pt-1 text-center"
                  aria-current={current ? "step" : undefined}
                  aria-pressed={isSelected}
                  data-selected={isSelected || undefined}
                  title={`Show ${label(s)}`}
                >
                  {/* line to the next step */}
                  {i < FLOW.length - 1 && (
                    <span aria-hidden="true" className={cn("dot absolute left-1/2 top-[11px] h-[2px] w-full", done ? "bg-accent" : "bg-line")} />
                  )}
                  <span
                    className={cn(
                      "dot relative grid size-[18px] place-items-center rounded-full border-2 transition-colors",
                      done && "border-accent bg-accent text-accent-fg",
                      current && "border-accent bg-surface shadow-[0_0_0_4px_var(--accent-soft)]",
                      !done && !current && "border-line-strong bg-surface group-hover:border-accent/60",
                    )}
                  >
                    {done && <Check className="size-2.5" strokeWidth={3.5} />}
                    {current && <span className="size-2 rounded-full bg-accent" />}
                  </span>
                  <span
                    className={cn(
                      "px-0.5 text-[12px] leading-tight",
                      isSelected ? "font-medium text-accent-text" : current ? "font-medium text-fg" : done ? "text-muted" : "text-faint group-hover:text-muted",
                    )}
                  >
                    {label(s)}
                  </span>
                  {/* marks the step shown below */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute bottom-0 left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-full transition-colors",
                      isSelected ? "bg-accent" : "bg-transparent group-hover:bg-line",
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {footer && <div className="rounded-b-xl border-t border-line bg-subtle/50 px-4 py-3 sm:px-5">{footer}</div>}
    </section>
  );
}

function PhaseLabel({ span, text, active, bracket }: { span: number; text: string; active: boolean; bracket?: boolean }) {
  // The bracket runs from the first step's dot to the last one's: half a column in from each side.
  const inset = `${50 / span}%`;
  return (
    <div className="mb-2 text-center" style={{ gridColumn: `span ${span} / span ${span}` }}>
      <span className={cn("text-[11px] font-medium uppercase tracking-[0.08em]", active ? "text-accent-text" : "text-faint")}>{text}</span>
      {bracket && (
        <div
          aria-hidden="true"
          className={cn("mt-1 h-1.5 rounded-t-sm border-x border-t", active ? "border-accent/40" : "border-line")}
          style={{ marginLeft: inset, marginRight: inset }}
        />
      )}
    </div>
  );
}
