import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { BRIEF_GROUPS, STAGE_FIELDS, stageChecks, suggestedFee } from "@shared/opportunity";
import { accountStatusLabel, phaseOf, type AccountDetail, type AccountStatus } from "@shared/model";
import { api } from "@/lib/api";
import { dmy, money, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusDot } from "../Brand";
import { toast } from "../Toast";
import { Checklist, FieldGrid, SubHead, type SaveField, type Value } from "./fields";
import { Buildings } from "./Buildings";
import { ChosenBuilding, Comparison, TermsTracker } from "./Offers";

const HINT: Record<AccountStatus, string> = {
  lead: "Who they are and why they might move. Company and contacts are below; their current lease is on Office & lease.",
  overview_sent: "Pin down the brief, put the buildings in the overview and send it.",
  viewing: "Record each viewing: when, a score out of 10 and what they thought.",
  rfp: "Ask the landlords for a proposal on the buildings that made the cut.",
  proposal: "Put the offers side by side and write your advice.",
  negotiation: "Track each term: the landlord's position, your ask, and what's agreed.",
  terms_agreed: "Heads of terms signed, the conditions and the checks.",
  agreement: "The signed lease. Then make the building their current office.",
  invoicing: "Your fee, the invoice and when it's paid.",
  not_now: "Why it stopped, so you know when to pick it up again.",
};

export const saveOpportunity =
  (accountId: string): SaveField =>
  async (key, value) => {
    const res = await api<Record<string, Value>>(`/accounts/${accountId}/opportunity`, "PATCH", { [key]: value });
    return res[key] ?? null;
  };

/** What to capture at one stage: its checklist and fields, plus the brief and buildings where they matter. */
export function StagePanel({ data, stage, onShowOffice }: { data: AccountDetail; stage: AccountStatus; onShowOffice: () => void }) {
  const { account, options } = data;
  const opp = account.opportunity ?? {};
  const save = saveOpportunity(account.id);
  const checks = stageChecks(stage, {
    opp,
    options,
    contacts: data.contacts.length,
    hasCurrentLease: data.offices.some((o) => o.is_current && !!o.lease_end),
  });
  const done = checks.filter((c) => c.done).length;
  const phase = phaseOf(stage);
  const showBrief = phase === "opportunity" || stage === "invoicing";

  return (
    <div className="grid gap-6">
      <Card
        title={
          <>
            <StatusDot status={stage} /> {accountStatusLabel(stage)}
          </>
        }
        action={
          <span className={cn("text-[12px]", done === checks.length ? "text-accent-text" : "text-muted")}>
            <span className="num">
              {done}/{checks.length}
            </span>{" "}
            done
          </span>
        }
      >
        <p className="mb-3 text-sm text-muted">{HINT[stage]}</p>
        <Checklist checks={checks} />
        {STAGE_FIELDS[stage].length > 0 && <FieldGrid className="mt-5 border-t border-line pt-4" defs={STAGE_FIELDS[stage]} values={opp} onSave={save} />}
        {stage === "invoicing" && <FeeHint data={data} />}
      </Card>

      {stage === "overview_sent" && <Brief opp={opp} save={save} defaultOpen />}
      {stage === "overview_sent" && <Buildings account={account} options={options} mode="overview" />}
      {stage === "viewing" && <Buildings account={account} options={options} mode="viewing" />}
      {stage === "rfp" && <Buildings account={account} options={options} mode="rfp" />}
      {stage === "proposal" && <Comparison account={account} options={options} />}
      {stage === "negotiation" && <TermsTracker options={options} />}
      {(stage === "terms_agreed" || stage === "agreement") && (
        <ChosenBuilding account={account} options={options} canAdopt={stage === "agreement"} onShowOffice={onShowOffice} />
      )}
      {showBrief && stage !== "overview_sent" && <Brief opp={opp} save={save} />}
    </div>
  );
}

/** Suggested fee from the mandate (fee % of the first-year rent, or a fixed fee), one click to use it. */
function FeeHint({ data }: { data: AccountDetail }) {
  const opp = data.account.opportunity ?? {};
  const chosen = data.options.find((o) => o.status === "chosen") ?? null;
  const fee = suggestedFee(opp, chosen);
  if (fee === null)
    return <p className="mt-4 text-[13px] text-faint">Set the fee basis in the brief (% of first-year rent or a fixed fee) to get a suggested fee here.</p>;
  if (opp.fee_amount === fee) return null;
  const basis =
    opp.fee_basis === "fixed"
      ? "the fixed fee in the mandate"
      : `${num(Number(opp.fee_pct))}% of ${typeof opp.rent_year === "number" ? "the signed rent" : "the chosen offer's first-year rent"}`;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-accent-soft px-4 py-2.5 text-sm text-accent-text">
      <span>
        Suggested fee <span className="num font-medium">{money(fee)}</span> · {basis}
      </span>
      <Button size="xs" variant="outline" onClick={() => saveOpportunity(data.account.id)("fee_amount", fee).catch((e) => toast((e as Error).message))}>
        Use this
      </Button>
    </div>
  );
}

/** The requirement: what they're looking for. Open at Overview sent, a one-line summary elsewhere. */
function Brief({ opp, save, defaultOpen = false }: { opp: Record<string, Value>; save: SaveField; defaultOpen?: boolean }) {
  const all = BRIEF_GROUPS.flatMap((g) => g.fields);
  const filled = all.filter((f) => opp[f.key] !== undefined && opp[f.key] !== null && opp[f.key] !== "").length;
  const [open, setOpen] = useState(defaultOpen || filled === 0);
  const summary = briefSummary(opp);

  return (
    <Card
      title="Brief"
      action={
        <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg" aria-expanded={open}>
          <span className="num">
            {filled}/{all.length}
          </span>{" "}
          filled
          <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} />
        </button>
      }
    >
      {!open ? (
        <button onClick={() => setOpen(true)} className="block w-full text-left text-sm">
          {summary.length ? (
            <span className="flex flex-wrap gap-x-2 gap-y-1">
              {summary.map((s, i) => (
                <span key={i} className={cn(i > 0 && "before:mr-2 before:text-faint before:content-['·']")}>
                  {s}
                </span>
              ))}
            </span>
          ) : (
            <span className="text-muted">No brief yet. What are they looking for, where, how big, by when and for how much?</span>
          )}
        </button>
      ) : (
        BRIEF_GROUPS.map((g) => (
          <section key={g.title} className="mt-6 first:mt-0">
            <SubHead>{g.title}</SubHead>
            <FieldGrid
              defs={g.fields.filter((f) => !(f.key === "fee_pct" && opp.fee_basis === "fixed") && !(f.key === "fee_fixed" && opp.fee_basis !== "fixed"))}
              values={opp}
              onSave={save}
            />
          </section>
        ))
      )}
    </Card>
  );
}

function briefSummary(o: Record<string, Value>): string[] {
  const out: string[] = [];
  const n = (k: string) => (typeof o[k] === "number" ? (o[k] as number) : null);
  const type = BRIEF_GROUPS[0].fields[0].options?.find((x) => x.key === o.req_type)?.label;
  if (type) out.push(type);
  const lo = n("size_min_m2");
  const hi = n("size_max_m2");
  if (lo !== null || hi !== null) out.push(lo !== null && hi !== null ? `${num(lo)}–${num(hi)} m²` : `${lo !== null ? "from " + num(lo) : "up to " + num(hi)} m²`);
  if (n("headcount_now") !== null) out.push(`${num(n("headcount_now"))} people${n("headcount_future") !== null ? ` → ${num(n("headcount_future"))}` : ""}`);
  if (o.areas) out.push(String(o.areas));
  if (n("budget_rent_m2") !== null) out.push(`max ${money(n("budget_rent_m2"))} /m²`);
  else if (n("budget_year") !== null) out.push(`max ${money(n("budget_year"))} /yr`);
  if (o.move_in_ideal || o.move_in_latest) out.push(`move-in ${dmy(String(o.move_in_ideal || o.move_in_latest))}`);
  if (o.mandate_signed === true) out.push("mandate signed");
  return out;
}
