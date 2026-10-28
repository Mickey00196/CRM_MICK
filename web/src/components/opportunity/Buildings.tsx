import { useState } from "react";
import { Building2, Check, ChevronDown, Link2, Plus, Trash2 } from "lucide-react";
import { OPTION_FIELD_MAP, OPTION_STATUSES, offerMetrics, type FieldDef, type OptionRow, type OptionStatus } from "@shared/opportunity";
import type { Account } from "@shared/model";
import { api } from "@/lib/api";
import { dmy, money, num, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chips, Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/dropdown";
import { toast } from "../Toast";
import { Editable, FieldGrid, SubHead, type SaveField, type Value } from "./fields";

export type BuildingsMode = "overview" | "viewing" | "rfp";

const ORDER: OptionStatus[] = ["overview", "viewed", "rfp", "proposal", "negotiating", "chosen"];
export const statusRank = (s: OptionStatus) => ORDER.indexOf(s);
export const optionStatusLabel = (s: OptionStatus) => OPTION_STATUSES.find((x) => x.key === s)?.label ?? s;
export const isLive = (o: OptionRow) => o.status !== "dropped";

export const saveOption =
  (id: string): SaveField =>
  async (key, value) => {
    const res = await api<OptionRow>(`/options/${id}`, "PATCH", { data: { [key]: value } });
    return (res.data[key] as Value) ?? null;
  };

export async function updateOption(id: string, body: { status?: OptionStatus; data?: Record<string, unknown> }) {
  try {
    await api(`/options/${id}`, "PATCH", body);
  } catch (e) {
    toast((e as Error).message);
  }
}

const F = (key: string): FieldDef => OPTION_FIELD_MAP[key];

/** Which details each view shows per building, beside its name. */
const COLUMNS: Record<BuildingsMode, { def: FieldDef; head: string }[]> = {
  overview: [
    { def: F("area_m2"), head: "Area" },
    { def: { ...F("asking_rent_m2"), unit: "€/m²" }, head: "Asking" },
    { def: F("reaction"), head: "Reaction" },
  ],
  viewing: [
    { def: F("viewing_date"), head: "Viewed" },
    { def: { ...F("viewing_score"), unit: "/ 10" }, head: "Score" },
    { def: F("reaction"), head: "Reaction" },
  ],
  rfp: [
    { def: F("rfp_sent_at"), head: "RFP sent" },
    { def: F("rfp_received_at"), head: "Response" },
  ],
};

/** The buildings of an opportunity, shown for the stage you're looking at. */
export function Buildings({ account, options, mode }: { account: Account; options: OptionRow[]; mode: BuildingsMode }) {
  const [open, setOpen] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [showDropped, setShowDropped] = useState(false);
  const live = options.filter(isLive);
  const dropped = options.filter((o) => !isLive(o));
  const cols = COLUMNS[mode];
  const link = typeof account.opportunity?.overview_link === "string" ? account.opportunity.overview_link : "";
  const selected = options.find((o) => o.id === open) ?? null;

  const action = (
    <div className="flex items-center gap-1">
      <Button size="xs" variant="ghost" onClick={() => setImporting((v) => !v)}>
        <Link2 /> {link ? "Sync shortlist" : "Import shortlist"}
      </Button>
    </div>
  );

  return (
    <Card
      title={<>Buildings <span className="num font-normal text-faint">{live.length || ""}</span></>}
      action={action}
      bodyClassName="px-5 pb-4 pt-2"
    >
      {(importing || (options.length === 0 && mode === "overview")) && (
        <ImportBar accountId={account.id} initial={link} onDone={() => setImporting(false)} />
      )}

      {live.length > 0 && (
        <div className="hidden items-center gap-3 border-b border-line py-2 @2xl:flex" aria-hidden="true">
          <span className="w-10 shrink-0" />
          <span className="label min-w-0 flex-1 text-[10px]">Building</span>
          {cols.map((c) => (
            <span key={c.head} className="label w-[5.5rem] shrink-0 text-right text-[10px]">
              {c.head}
            </span>
          ))}
          <span className="label w-28 shrink-0 text-right text-[10px]">Status</span>
        </div>
      )}

      <ul>
        {live.map((o) => (
          <Row key={o.id} option={o} mode={mode} onOpen={() => setOpen(o.id)} />
        ))}
      </ul>

      {live.length === 0 && options.length > 0 && <p className="py-3 text-sm text-muted">All buildings are dropped.</p>}

      <QuickAdd accountId={account.id} />

      {dropped.length > 0 && (
        <div className="mt-3 border-t border-line pt-2">
          <button onClick={() => setShowDropped((v) => !v)} className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg">
            <ChevronDown className={cn("size-3.5 transition-transform", !showDropped && "-rotate-90")} /> Dropped ({dropped.length})
          </button>
          {showDropped && (
            <ul className="opacity-70">
              {dropped.map((o) => (
                <Row key={o.id} option={o} mode={mode} onOpen={() => setOpen(o.id)} />
              ))}
            </ul>
          )}
        </div>
      )}

      <Sheet open={selected !== null} onOpenChange={(v) => !v && setOpen(null)} title="Building">
        {selected && <BuildingDetail option={selected} onClose={() => setOpen(null)} />}
      </Sheet>
    </Card>
  );
}

function Thumb({ option }: { option: OptionRow }) {
  const [broken, setBroken] = useState(false);
  const photo = typeof option.data.photo === "string" && !broken ? option.data.photo : null;
  return photo ? (
    <img src={photo} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="size-10 shrink-0 rounded-md border border-line object-cover" />
  ) : (
    <span className="grid size-10 shrink-0 place-items-center rounded-md border border-line bg-subtle text-faint">
      <Building2 className="size-4" />
    </span>
  );
}

function Row({ option: o, mode, onOpen }: { option: OptionRow; mode: BuildingsMode; onOpen: () => void }) {
  const d = o.data;
  const where = [d.address, d.city].filter(Boolean).join(", ") || String(d.submarket ?? "");
  const save = saveOption(o.id);
  // On narrow cards the key facts go under the name instead of in columns.
  const facts =
    mode === "overview"
      ? [d.area_m2 != null && `${num(Number(d.area_m2))} m²`, d.asking_rent_m2 != null && `${money(Number(d.asking_rent_m2))}/m²`]
      : mode === "viewing"
        ? [d.viewing_score != null && `${num(Number(d.viewing_score))}/10`, d.viewing_date && `viewed ${dmy(String(d.viewing_date))}`]
        : [d.rfp_sent_at && `RFP ${dmy(String(d.rfp_sent_at))}`, d.rfp_received_at && `response ${dmy(String(d.rfp_received_at))}`];
  return (
    <li className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
      <Thumb option={o} />
      <button onClick={onOpen} className="group min-w-0 flex-1 text-left">
        <p className="truncate font-medium group-hover:text-accent-text">{String(d.name ?? "Building")}</p>
        <p className="truncate text-[13px] text-muted">
          {facts.some(Boolean) && <span className="@2xl:hidden">{facts.filter(Boolean).join(" · ")} · </span>}
          {where || "No address yet"}
          {mode === "overview" && d.available_from ? ` · ${d.available_from}` : ""}
        </p>
      </button>
      {COLUMNS[mode].map((c) => (
        <div key={c.head} className="hidden w-[5.5rem] shrink-0 @2xl:block">
          <Editable def={c.def} value={d[c.def.key] as Value} onSave={(v) => save(c.def.key, v)} align="right" className="text-[13px]" />
        </div>
      ))}
      <div className="flex w-28 shrink-0 justify-end">
        <StatusControl option={o} mode={mode} />
      </div>
    </li>
  );
}

/** The building's status, with the next step of the current view as a one-click action. */
function StatusControl({ option: o, mode }: { option: OptionRow; mode: BuildingsMode }) {
  const today = todayISO();
  const rank = statusRank(o.status);
  const quick =
    o.status === "dropped"
      ? null
      : mode === "viewing" && rank < statusRank("viewed")
        ? { label: "Viewed", body: { status: "viewed" as const, data: o.data.viewing_date ? {} : { viewing_date: today } } }
        : mode === "rfp" && rank < statusRank("rfp")
          ? { label: "RFP sent", body: { status: "rfp" as const, data: o.data.rfp_sent_at ? {} : { rfp_sent_at: today } } }
          : mode === "rfp" && o.status === "rfp"
            ? { label: "Offer in", body: { status: "proposal" as const, data: o.data.rfp_received_at ? {} : { rfp_received_at: today } } }
            : null;

  return (
    <div className="flex items-center gap-1">
      {quick && (
        <Button size="xs" variant="outline" onClick={() => updateOption(o.id, quick.body)} title={`Mark as ${quick.label.toLowerCase()}, dated today`}>
          <Check /> {quick.label}
        </Button>
      )}
      <Menu>
        <MenuTrigger asChild>
          <button
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-[12.5px] text-muted hover:bg-hover hover:text-fg",
              quick && "px-1.5",
            )}
            aria-label={`Status: ${optionStatusLabel(o.status)}`}
          >
            <OptionDot status={o.status} />
            {!quick && <span className="whitespace-nowrap">{optionStatusLabel(o.status)}</span>}
            <ChevronDown className="size-3 opacity-60" />
          </button>
        </MenuTrigger>
        <MenuContent align="end">
          {OPTION_STATUSES.map((s) => (
            <MenuItem key={s.key} onSelect={() => s.key !== o.status && updateOption(o.id, { status: s.key })}>
              <OptionDot status={s.key} /> <span className={cn(s.key === o.status && "font-medium")}>{s.label}</span>
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
    </div>
  );
}

export function OptionDot({ status }: { status: OptionStatus }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        status === "overview" && "border-[1.5px] border-faint",
        (status === "viewed" || status === "rfp" || status === "proposal") && "border-[1.5px] border-accent",
        status === "negotiating" && "bg-accent",
        status === "chosen" && "bg-accent shadow-[0_0_0_3px_var(--accent-soft)]",
        status === "dropped" && "bg-line-strong",
      )}
    />
  );
}

function QuickAdd({ accountId }: { accountId: string }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await api(`/accounts/${accountId}/options`, "POST", { data: { name: name.trim() } });
      setName("");
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={add} className="mt-2 flex items-center gap-2">
      <span className="grid size-10 shrink-0 place-items-center rounded-md border border-dashed border-line-strong text-faint">
        <Plus className="size-4" />
      </span>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a building by name" aria-label="Building name" className="h-9 flex-1" />
      {name.trim() && (
        <Button size="sm" disabled={busy}>
          Add
        </Button>
      )}
    </form>
  );
}

function ImportBar({ accountId, initial, onDone }: { accountId: string; initial: string; onDone: () => void }) {
  const [url, setUrl] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || busy) return;
    setBusy(true);
    try {
      const r = await api<{ added: number; updated: number; skipped: number; name: string }>(`/accounts/${accountId}/options/import`, "POST", { url: url.trim() });
      const parts = [r.added && `${r.added} added`, r.updated && `${r.updated} already here`, r.skipped && `${r.skipped} you removed left out`].filter(Boolean);
      toast(`${r.name}: ${parts.join(", ") || "no buildings in it"}.`);
      onDone();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={go} className="my-2 rounded-lg border border-line bg-subtle/50 p-3">
      <p className="mb-2 text-[13px] text-muted">
        Paste the live link of the client's shortlist (the one ending in <span className="num">/s/…</span>). Its buildings come in here; anything you've edited here is kept.
      </p>
      <div className="flex gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/s/client-name" aria-label="Shortlist link" className="flex-1 bg-surface" />
        <Button size="sm" className="h-9" disabled={!url.trim() || busy}>
          {busy ? "Importing…" : "Import"}
        </Button>
      </div>
    </form>
  );
}

const GROUPS: { title: string; keys: string[] }[] = [
  { title: "Building", keys: ["name", "address", "city", "submarket", "area_m2", "asking_rent_m2", "service_m2", "available_from", "energy_label", "landlord", "agent", "link", "reaction", "notes"] },
  { title: "Viewing", keys: ["viewing_date", "viewing_score", "viewing_notes"] },
  { title: "RFP", keys: ["rfp_sent_at", "rfp_received_at"] },
  {
    title: "Landlord's offer",
    keys: [
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
      "offer_guarantee",
      "offer_delivery",
      "offer_start",
    ],
  },
];

/** Everything about one building, editable in place. */
function BuildingDetail({ option: o, onClose }: { option: OptionRow; onClose: () => void }) {
  const save = saveOption(o.id);
  const m = offerMetrics(o.data);
  const photo = typeof o.data.photo === "string" ? o.data.photo : null;

  async function remove() {
    if (!confirm(`Remove ${o.data.name ?? "this building"} from the opportunity? To keep it on record, set it to Dropped instead.`)) return;
    try {
      await api(`/options/${o.id}`, "DELETE");
      onClose();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <div className="grid gap-1">
      {photo && <img src={photo} alt="" referrerPolicy="no-referrer" className="mb-3 aspect-[16/9] w-full rounded-lg border border-line object-cover" />}
      <h2 className="title text-xl">{String(o.data.name ?? "Building")}</h2>
      <p className="mb-3 text-sm text-muted">{[o.data.address, o.data.city].filter(Boolean).join(", ")}</p>
      <Chips size="sm" options={OPTION_STATUSES} value={o.status} onChange={(s) => updateOption(o.id, { status: s })} />
      {o.status === "dropped" && (
        <div className="mt-3">
          <FieldGrid defs={[{ ...F("drop_reason"), wide: true }]} values={o.data} onSave={save} />
        </div>
      )}
      {m && (
        <p className="mt-4 rounded-lg bg-accent-soft px-3 py-2 text-[13px] text-accent-text">
          Net effective rent <span className="num font-medium">{money(Math.round(m.nerM2))}</span> /m²/yr · all-in{" "}
          <span className="num font-medium">{money(Math.round(m.totalYear))}</span> per year
        </p>
      )}
      {GROUPS.map((g) => (
        <section key={g.title} className="mt-5">
          <SubHead>{g.title}</SubHead>
          <FieldGrid
            defs={g.keys.map((k) => (["notes", "viewing_notes", "link"].includes(k) ? { ...F(k), wide: true } : F(k)))}
            values={o.data}
            onSave={save}
          />
        </section>
      ))}
      <div className="mt-8 border-t border-line pt-4">
        <Button variant="danger" size="sm" onClick={remove}>
          <Trash2 /> Remove building
        </Button>
      </div>
    </div>
  );
}
