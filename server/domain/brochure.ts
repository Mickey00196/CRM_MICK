// Import buildings from a live client link of the Office Shortlist tool (".../s/<slug>").
// The CRM only ever calls that tool's own public, read-only endpoint (/public/clients/<slug>) on a
// configured host, so a pasted link can't make this server fetch anything else.
import type { OptionRow } from "../../shared/opportunity.js";

export const BROCHURE_API_URL = (process.env.BROCHURE_API_URL || "https://proposal-engine-backend-production.up.railway.app").replace(/\/$/, "");

/** The slug from a live link, or null when it isn't one. */
export function brochureSlug(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  const m = /^\/s\/([A-Za-z0-9_-]{1,120})\/?$/.exec(url.pathname);
  return m ? m[1] : null;
}

interface PublicUnit {
  available_area_m2?: number | null;
  rent_eur_per_m2_year?: number | null;
}
interface PublicBuilding {
  building_id: string;
  name?: string;
  address?: string;
  units?: PublicUnit[];
}
export interface PublicShortlist {
  display_name: string;
  buildings: PublicBuilding[];
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** One building from the shortlist as a CRM option: its address, the space on offer, the lowest asking rent. */
export function buildingToOption(b: PublicBuilding): { source_id: string; data: OptionRow["data"] } {
  const units = b.units ?? [];
  const areas = units.map((u) => num(u.available_area_m2)).filter((x): x is number => x !== null);
  const rents = units.map((u) => num(u.rent_eur_per_m2_year)).filter((x): x is number => x !== null);
  return {
    source_id: `brochure:${b.building_id}`,
    data: {
      address: (b.address || b.name || "Building").slice(0, 500),
      area_m2: areas.length ? Math.round(areas.reduce((s, a) => s + a, 0)) : null,
      asking_rent_m2: rents.length ? Math.min(...rents) : null,
    },
  };
}

/** Fetches the shortlist behind a live link. Throws with a readable message. */
export async function fetchShortlist(link: string, fetchImpl: typeof fetch = fetch): Promise<PublicShortlist> {
  const slug = brochureSlug(link);
  if (!slug) throw new Error("That isn't a live shortlist link (it should end in /s/…).");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetchImpl(`${BROCHURE_API_URL}/public/clients/${encodeURIComponent(slug)}`, { signal: ctrl.signal });
    if (res.status === 404) throw new Error("That shortlist isn't live (or doesn't exist). Turn on the live link in the shortlist tool.");
    if (!res.ok) throw new Error(`The shortlist tool answered ${res.status}.`);
    const body = (await res.json()) as PublicShortlist;
    if (!body || !Array.isArray(body.buildings)) throw new Error("The shortlist tool sent something unexpected.");
    return body;
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("The shortlist tool took too long to answer.");
    if (e instanceof TypeError) throw new Error("Couldn't reach the shortlist tool.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
