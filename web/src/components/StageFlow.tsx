import { Check, ChevronRight } from "lucide-react";
import { ACCOUNT_STATUSES, FLOW, OPPORTUNITY_STAGES, nextStatus, phaseOf, type AccountStatus } from "@shared/model";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const label = (s: AccountStatus) => ACCOUNT_STATUSES.find((x) => x.key === s)!.label;

/**
 * Where the account is: Lead, the seven opportunity steps, Invoicing. Click any step to jump there;
 * the button moves it one step on ("Start opportunity", "Next: Viewing", "Move to invoicing").
 */
export function StageFlow({ status, onChange }: { status: AccountStatus; onChange: (s: AccountStatus) => void }) {
  const parked = status === "not_now";
  const at = FLOW.indexOf(status);
  const next = nextStatus(status);
  const phase = phaseOf(status);
  const step = OPPORTUNITY_STAGES.indexOf(status) + 1;

  const action =
    status === "lead"
      ? "Start opportunity"
      : status === "agreement"
        ? "Move to invoicing"
        : next
          ? `Next: ${label(next)}`
          : null;

  return (
    <section className="mt-6 rounded-xl border border-line bg-surface p-4 sm:p-5" aria-label="Stage">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          {parked ? (
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
          {parked ? (
            <Button size="sm" onClick={() => onChange("lead")}>
              Reopen as lead
            </Button>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => onChange("not_now")} title="Parked or lost: drops off the board and out of the follow-up checks">
                Not now
              </Button>
              {action && next && (
                <Button size="sm" onClick={() => onChange(next)}>
                  {action} <ChevronRight />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* The steps. Scrolls sideways on narrow screens. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className={cn("grid min-w-[620px] grid-cols-9", parked && "opacity-50")}>
          <PhaseLabel span={1} text="Lead" active={phase === "lead"} />
          <PhaseLabel span={7} text="Opportunity" active={phase === "opportunity"} bracket />
          <PhaseLabel span={1} text="Invoicing" active={phase === "invoicing"} />
          {FLOW.map((s, i) => {
            const done = !parked && i < at;
            const current = !parked && i === at;
            return (
              <button
                key={s}
                onClick={() => s !== status && onChange(s)}
                className="group relative flex flex-col items-center gap-2 pt-1 text-center"
                aria-current={current ? "step" : undefined}
                title={current ? label(s) : `Move to ${label(s)}`}
              >
                {/* line to the next step */}
                {i < FLOW.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={cn("absolute left-1/2 top-[11px] h-[2px] w-full", done ? "bg-accent" : "bg-line")}
                  />
                )}
                <span
                  className={cn(
                    "relative grid size-[18px] place-items-center rounded-full border-2 transition-colors",
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
                    current ? "font-medium text-fg" : done ? "text-muted" : "text-faint group-hover:text-muted",
                  )}
                >
                  {label(s)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
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
