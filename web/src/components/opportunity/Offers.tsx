import { useState } from "react";
import { Building2, Check, CheckCircle2 } from "lucide-react";
import { NEGOTIATION_TERMS, OPTION_FIELD_MAP, TERM_SIDES, offerMetrics, type FieldDef, type OptionRow, type TermSide } from "@shared/opportunity";
import type { Account } from "@shared/model";
import { api } from "@/lib/api";
import { money, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "../Toast";
import { Editable, type Value } from "./fields";
import { OptionDot, isLive, optionStatusLabel, saveOption, statusRank, updateOption } from "./Buildings";

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const nameOf = (o: OptionRow) => String(o.data.name ?? "Building");

const OFFER_ROWS = [
  "offer_area_m2",
  "offer_rent_m2",
  "offer_service_m2",
  "offer_rent_free_months",
  "offer_fitout_m2",
  "offer_term_years",
  "offer_break_years",
  "offer_parking_spaces",
  "offer_parking_rate",
  "offer_indexation",
  "offer_start",
].map((k) => OPTION_FIELD_MAP[k]);

/** Short units for the narrow table cells. */
const cellDef = (d: FieldDef): FieldDef => ({ ...d, unit: d.unit?.replace("/yr", "").replace("/space", "") });

/** The landlords' offers side by side, with what each really costs. */
export function Comparison({ account, options }: { account: Account; options: OptionRow[] }) {
  const opp = account.opportunity ?? {};
  const live = options.filter(isLive);
  const withOffer = live.filter((o) => statusRank(o.status) >= statusRank("rfp") || OFFER_ROWS.some((d) => o.data[d.key] != null));
  const cols = withOffer.length ? withOffer : live;
  const headcount = n(opp.headcount_future) ?? n(opp.headcount_now);
  const budget = n(opp.budget_rent_m2);
  const metrics = cols.map((o) => offerMetrics(o.data, headcount));
  const lowest = (pick: (m: NonNullable<(typeof metrics)[number]>) => number | null) => {
    const vals = metrics.map((m) => (m ? pick(m) : null)).filter((v): v is number => v !== null);
    return vals.length > 1 ? Math.min(...vals) : null;
  };
  const bestNer = lowest((m) => m.nerM2);
  const bestTotal = lowest((m) => m.totalYear);

  if (!cols.length)
    return (
      <Card title="Offers">
        <p className="text-sm text-muted">No buildings yet. Add them at Overview sent, then their offers come in here.</p>
      </Card>
    );

  const computed: { label: string; hint?: string; value: (m: NonNullable<(typeof metrics)[number]>) => string; best?: number | null; pick?: (m: NonNullable<(typeof metrics)[number]>) => number; over?: (m: NonNullable<(typeof metrics)[number]>) => boolean }[] = [
    { label: "Rent per year", value: (m) => money(Math.round(m.rentYear)) },
    { label: "Incentives", hint: "Rent-free plus fit-out contribution", value: (m) => `${money(Math.round(m.incentives))} · ${num(Math.round(m.incentivePct * 1000) / 10)}%` },
    {
      label: "Net effective rent",
      hint: "Rent minus incentives spread over the term, per m² per year",
      value: (m) => `${money(Math.round(m.nerM2))} /m²`,
      best: bestNer,
      pick: (m) => m.nerM2,
      over: (m) => budget !== null && m.nerM2 > budget,
    },
    { label: "All-in per year", hint: "Net rent + service charges + parking", value: (m) => money(Math.round(m.totalYear)), best: bestTotal, pick: (m) => m.totalYear },
    ...(headcount ? [{ label: `Per workstation`, hint: `All-in per year for ${num(headcount)} people`, value: (m: NonNullable<(typeof metrics)[number]>) => (m.perWorkstationYear ? money(Math.round(m.perWorkstationYear)) : "–") }] : []),
    { label: "Total over the term", value: (m) => money(Math.round(m.totalTerm)) },
  ];

  const th = "sticky left-0 z-[1] bg-surface py-1.5 pl-5 pr-3 text-left text-[13px] font-normal text-muted";
  return (
    <Card title="Offers side by side" bodyClassName="px-0 py-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className={cn(th, "w-44")} />
              {cols.map((o) => (
                <th key={o.id} scope="col" className="min-w-[9.5rem] px-3 pb-2.5 text-right align-bottom font-medium">
                  <span className="ml-auto block max-w-[12rem] truncate">{nameOf(o)}</span>
                  <span className="mt-0.5 flex items-center justify-end gap-1.5 text-[12px] font-normal text-muted">
                    <OptionDot status={o.status} /> {optionStatusLabel(o.status)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Section label="The offer" span={cols.length} />
            {OFFER_ROWS.map((d) => (
              <tr key={d.key} className="border-b border-line/60">
                <th scope="row" className={th}>
                  {d.label}
                </th>
                {cols.map((o) => (
                  <td key={o.id} className="px-3 py-0.5">
                    <Editable def={cellDef(d)} value={o.data[d.key] as Value} onSave={(v) => saveOption(o.id)(d.key, v)} align="right" className="text-[13px]" />
                  </td>
                ))}
              </tr>
            ))}
            <Section label="What it costs" span={cols.length} />
            {computed.map((row) => (
              <tr key={row.label} className="border-b border-line/60 last:border-b-0">
                <th scope="row" className={th} title={row.hint}>
                  {row.label}
                </th>
                {cols.map((o, i) => {
                  const m = metrics[i];
                  const best = m && row.pick && row.best !== undefined && row.best !== null && row.pick(m) === row.best;
                  const over = m && row.over?.(m);
                  return (
                    <td key={o.id} className={cn("num px-3 py-2 text-right text-[13px]", !m && "text-faint", best && "font-semibold text-accent-text", over && "text-late")}>
                      {m ? row.value(m) : "–"}
                      {best && <span className="ml-1.5 rounded bg-accent-soft px-1 py-px text-[10px] font-medium uppercase tracking-wide">Lowest</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <th scope="row" className={th} />
              {cols.map((o) => (
                <td key={o.id} className="px-3 pt-3 text-right">
                  {statusRank(o.status) < statusRank("negotiating") ? (
                    <Button size="xs" variant="outline" onClick={() => updateOption(o.id, { status: "negotiating" })}>
                      Negotiate
                    </Button>
                  ) : (
                    <span className="text-[12px] text-muted">{optionStatusLabel(o.status)}</span>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="px-5 pt-3 text-xs text-faint">
        Simple sums, not discounted. Fill in area, rent and term to see the costs.{budget !== null && ` Red is above the budget of ${money(budget)} /m².`}
      </p>
    </Card>
  );
}

function Section({ label, span }: { label: string; span: number }) {
  return (
    <tr>
      <th colSpan={span + 1} scope="colgroup" className="sticky left-0 bg-surface px-5 pb-1 pt-4 text-left">
        <span className="label text-[10px]">{label}</span>
      </th>
    </tr>
  );
}

const SIDE_LABEL: Record<TermSide, string> = { landlord: "Landlord", ask: "Our ask", agreed: "Agreed" };

/** Per building: each term with the landlord's position, our ask and what's agreed. */
export function TermsTracker({ options }: { options: OptionRow[] }) {
  const live = options.filter(isLive);
  const inPlay = live.filter((o) => o.status === "negotiating" || o.status === "chosen");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const picked = inPlay.find((o) => o.id === pickedId) ?? inPlay.find((o) => o.status === "chosen") ?? inPlay[0] ?? null;

  if (!picked) {
    const proposals = live.filter((o) => statusRank(o.status) >= statusRank("rfp"));
    return (
      <Card title="Terms">
        <p className="text-sm text-muted">Pick the building(s) you're negotiating on, then track each term here.</p>
        {(proposals.length ? proposals : live).length > 0 && (
          <ul className="mt-3">
            {(proposals.length ? proposals : live).map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
                <span className="truncate">{nameOf(o)}</span>
                <Button size="xs" variant="outline" onClick={() => updateOption(o.id, { status: "negotiating" })}>
                  Negotiate
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  }

  const terms = picked.terms ?? {};
  const open = NEGOTIATION_TERMS.filter((t) => terms[t.key] && (terms[t.key]!.landlord || terms[t.key]!.ask));
  const agreed = NEGOTIATION_TERMS.filter((t) => terms[t.key]?.agreed);

  async function saveTerm(term: string, side: TermSide, v: unknown): Promise<Value> {
    const res = await api<OptionRow>(`/options/${picked!.id}`, "PATCH", { terms: { [term]: { [side]: v ?? "" } } });
    return res.terms[term]?.[side] || null;
  }

  return (
    <Card
      title="Terms"
      action={
        <span className="text-[12px] text-muted">
          <span className="num">{agreed.length}</span> agreed{open.length > agreed.length && <> · <span className="num">{open.length - agreed.length}</span> open</>}
        </span>
      }
      bodyClassName="px-0 pb-4 pt-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3">
        {inPlay.length > 1 ? (
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Building">
            {inPlay.map((o) => (
              <button
                key={o.id}
                role="tab"
                aria-selected={o.id === picked.id}
                onClick={() => setPickedId(o.id)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[13px]",
                  o.id === picked.id ? "border-accent/50 bg-accent-soft font-medium text-accent-text" : "border-line-strong text-muted hover:text-fg",
                )}
              >
                <OptionDot status={o.status} /> {nameOf(o)}
              </button>
            ))}
          </div>
        ) : (
          <p className="flex items-center gap-2 font-medium">
            <OptionDot status={picked.status} /> {nameOf(picked)}
          </p>
        )}
        {picked.status !== "chosen" ? (
          <Button size="xs" variant="outline" onClick={() => updateOption(picked.id, { status: "chosen" })}>
            <Check /> Choose this building
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1 text-[12px] text-accent-text">
            <CheckCircle2 className="size-3.5" /> Chosen
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <thead>
            <tr className="border-y border-line bg-subtle/50">
              <th className="w-44 py-2 pl-5 pr-3 text-left">
                <span className="label text-[10px]">Term</span>
              </th>
              {TERM_SIDES.map((s) => (
                <th key={s} className="px-3 py-2 text-left">
                  <span className={cn("label text-[10px]", s === "agreed" && "text-accent-text")}>{SIDE_LABEL[s]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {NEGOTIATION_TERMS.map((t) => {
              const row = terms[t.key] ?? {};
              return (
                <tr key={t.key} className="border-b border-line/60 last:border-b-0">
                  <th scope="row" className="py-0.5 pl-5 pr-3 text-left text-[13px] font-normal text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      {row.agreed ? <Check className="size-3 text-accent-text" strokeWidth={3} /> : <span className="size-3" />}
                      {t.label}
                    </span>
                  </th>
                  {TERM_SIDES.map((s) => (
                    <td key={s} className="px-3 py-0.5">
                      <Editable
                        def={{ key: `${t.key}.${s}`, label: `${t.label}: ${SIDE_LABEL[s]}`, type: "text" }}
                        value={row[s] || null}
                        onSave={(v) => saveTerm(t.key, s, v)}
                        className={cn("text-[13px]", s === "agreed" && "font-medium")}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** The building they're going for: the deal at a glance, and at signing, their new office. */
export function ChosenBuilding({ account, options, canAdopt, onShowOffice }: { account: Account; options: OptionRow[]; canAdopt: boolean; onShowOffice: () => void }) {
  const chosen = options.find((o) => o.status === "chosen");
  const [busy, setBusy] = useState(false);
  const live = options.filter(isLive).sort((a, b) => statusRank(b.status) - statusRank(a.status));

  if (!chosen)
    return (
      <Card title="Chosen building">
        {live.length === 0 ? (
          <p className="text-sm text-muted">No buildings on this opportunity yet.</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-muted">Which building did they go for?</p>
            <ul>
              {live.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
                  <span className="flex min-w-0 items-center gap-2">
                    <OptionDot status={o.status} /> <span className="truncate">{nameOf(o)}</span>
                  </span>
                  <Button size="xs" variant="outline" onClick={() => updateOption(o.id, { status: "chosen" })}>
                    Choose
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    );

  const d = chosen.data;
  const m = offerMetrics(d);
  const agreed = NEGOTIATION_TERMS.filter((t) => chosen.terms?.[t.key]?.agreed);
  const adopted = typeof account.opportunity?.adopted_office_id === "string";

  async function adopt() {
    setBusy(true);
    try {
      await api(`/options/${chosen!.id}/adopt`, "POST");
      toast(`${nameOf(chosen!)} is now their current office.`, { label: "View", run: onShowOffice });
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Chosen building">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-md border border-accent/20 bg-accent-soft text-accent-text">
          <Building2 className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{nameOf(chosen)}</p>
          <p className="text-[13px] text-muted">{[d.address, d.city].filter(Boolean).join(", ") || "No address yet"}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm @lg:grid-cols-4">
            <Fact label="Area" value={n(d.offer_area_m2) ?? n(d.area_m2) ? `${num(n(d.offer_area_m2) ?? n(d.area_m2))} m²` : null} />
            <Fact label="Rent" value={n(d.offer_rent_m2) ? `${money(n(d.offer_rent_m2))} /m²` : null} />
            <Fact label="Net effective" value={m ? `${money(Math.round(m.nerM2))} /m²` : null} />
            <Fact label="Term" value={n(d.offer_term_years) ? `${num(n(d.offer_term_years))} years` : null} />
          </dl>
          {agreed.length > 0 && (
            <ul className="mt-4 grid gap-1 border-t border-line pt-3 text-[13px]">
              {agreed.map((t) => (
                <li key={t.key} className="grid grid-cols-[9rem_1fr] gap-3">
                  <span className="text-muted">{t.label}</span>
                  <span>{chosen.terms[t.key]!.agreed}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {canAdopt && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-subtle/50 px-4 py-3">
          {adopted ? (
            <>
              <p className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 text-accent-text" /> This is their current office now.
              </p>
              <Button size="xs" variant="ghost" onClick={onShowOffice}>
                Office & lease
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">Signed? Make it their current office, with the lease dates and rent from here. The old office moves to previous.</p>
              <Button size="sm" onClick={adopt} disabled={busy}>
                Make it the current office
              </Button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className={cn("num truncate", !value && "text-faint")}>{value ?? "–"}</dd>
    </div>
  );
}
