import { useState } from "react";
import { Check, ChevronDown, Link2, Trash2 } from "lucide-react";
import { OPTION_FIELD_MAP, OPTION_STATUSES, buildingLabel, type OptionRow, type OptionStatus } from "@shared/opportunity";
import type { Account } from "@shared/model";
import { api } from "@/lib/api";
import { todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/dropdown";
import { toast } from "../Toast";
import { Editable, type SaveField, type Value } from "./fields";

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

const ADDRESS = OPTION_FIELD_MAP.address;
const SIZE = OPTION_FIELD_MAP.area_m2;
const PRICE = OPTION_FIELD_MAP.asking_rent_m2;

/** The buildings you proposed: address, size and price, with a status per building. */
export function Buildings({ account, options, mode }: { account: Account; options: OptionRow[]; mode: BuildingsMode }) {
  const [importing, setImporting] = useState(false);
  const [showDropped, setShowDropped] = useState(false);
  const live = options.filter(isLive);
  const dropped = options.filter((o) => !isLive(o));
  const link = typeof account.opportunity?.overview_link === "string" ? account.opportunity.overview_link : "";

  return (
    <Card
      title={<>Buildings <span className="num font-normal text-faint">{live.length || ""}</span></>}
      action={
        <Button size="xs" variant="ghost" onClick={() => setImporting((v) => !v)}>
          <Link2 /> {link ? "Sync shortlist" : "Import shortlist"}
        </Button>
      }
      bodyClassName="px-5 pb-4 pt-2"
    >
      {importing && <ImportBar accountId={account.id} initial={link} onDone={() => setImporting(false)} />}

      <ul>
        {live.map((o) => (
          <Row key={o.id} option={o} mode={mode} />
        ))}
      </ul>
      {live.length === 0 && options.length > 0 && <p className="py-3 text-sm text-muted">All buildings are dropped.</p>}

      <QuickAdd accountId={account.id} first={options.length === 0} />

      {dropped.length > 0 && (
        <div className="mt-3 border-t border-line pt-2">
          <button onClick={() => setShowDropped((v) => !v)} className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg">
            <ChevronDown className={cn("size-3.5 transition-transform", !showDropped && "-rotate-90")} /> Dropped ({dropped.length})
          </button>
          {showDropped && (
            <ul className="opacity-70">
              {dropped.map((o) => (
                <Row key={o.id} option={o} mode={mode} />
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * One building, edited in place. Wide cards: address | size | price | status in columns.
 * Narrow cards: address and status on top, size and price underneath.
 */
function Row({ option: o, mode }: { option: OptionRow; mode: BuildingsMode }) {
  const save = saveOption(o.id);
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-b border-line py-1.5 last:border-b-0 @lg:grid-cols-[minmax(0,1fr)_6.5rem_8.5rem_auto]">
      <Editable def={ADDRESS} value={(o.data.address ?? o.data.name) as Value} onSave={(v) => save("address", v)} className="font-medium" />
      <div className="order-last col-span-full flex gap-6 @lg:contents">
        <Editable def={SIZE} value={o.data.area_m2 as Value} onSave={(v) => save("area_m2", v)} placeholder="Size" align="right" className="w-auto text-[13px] @lg:w-[calc(100%+1rem)]" />
        <Editable def={PRICE} value={o.data.asking_rent_m2 as Value} onSave={(v) => save("asking_rent_m2", v)} placeholder="Price" align="right" className="w-auto text-[13px] @lg:w-[calc(100%+1rem)]" />
      </div>
      <StatusControl option={o} mode={mode} />
    </li>
  );
}

/** The building's status, with the next step of this stage as a one-click action. */
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

  async function remove() {
    if (!confirm(`Remove ${buildingLabel(o.data)}? To keep it on record, set it to Dropped instead.`)) return;
    try {
      await api(`/options/${o.id}`, "DELETE");
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {quick && (
        <Button size="xs" variant="outline" onClick={() => updateOption(o.id, quick.body)} title={`Mark as ${quick.label.toLowerCase()}, dated today`}>
          <Check /> {quick.label}
        </Button>
      )}
      <Menu>
        <MenuTrigger asChild>
          <button
            className="inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-[12.5px] text-muted hover:bg-hover hover:text-fg"
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
          <MenuSeparator />
          <MenuItem onSelect={remove} className="text-late">
            <Trash2 /> Remove
          </MenuItem>
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

/** Add a building in one line: address, size and price. Enter saves. */
function QuickAdd({ accountId, first }: { accountId: string; first: boolean }) {
  const blank = { address: "", area_m2: "", asking_rent_m2: "" };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!f.address.trim() || busy) return;
    setBusy(true);
    try {
      await api(`/accounts/${accountId}/options`, "POST", { data: f });
      setF(blank);
      (document.getElementById(`add-address-${accountId}`) as HTMLInputElement | null)?.focus();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={add} className={cn("grid grid-cols-2 gap-2 @lg:grid-cols-[minmax(0,1fr)_6.5rem_8.5rem_auto]", first ? "mt-1" : "mt-3")}>
      <Input
        id={`add-address-${accountId}`}
        value={f.address}
        onChange={set("address")}
        placeholder={first ? "Address of the first building" : "Add a building: address"}
        aria-label="Address"
        className="col-span-2 @lg:col-span-1"
      />
      <Input value={f.area_m2} onChange={set("area_m2")} placeholder="Size m²" inputMode="decimal" aria-label="Size in m²" className="text-right" />
      <Input value={f.asking_rent_m2} onChange={set("asking_rent_m2")} placeholder="Price €/m²/yr" inputMode="decimal" aria-label="Price in € per m² per year" className="text-right" />
      <Button size="sm" className={cn("col-span-2 h-9 @lg:col-span-1", !f.address.trim() && "hidden @lg:inline-flex")} disabled={!f.address.trim() || busy}>
        Add
      </Button>
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
        Paste the live link of the client's shortlist (ending in <span className="num">/s/…</span>). Each building comes in with its address, size and price; anything you've changed here is kept.
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
