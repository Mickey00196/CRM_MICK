// AI company lookup: from a website, a short summary of what the company does and where its offices are.
// Claude does the browsing (Anthropic's server-side web search and web fetch), so this server never
// fetches arbitrary URLs itself. Off unless ANTHROPIC_API_KEY is set. No database in here, so it's easy to test.
import type { CompanyProfile } from "../../shared/model.js";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.AI_MODEL || "claude-haiku-5-5";
/** A lookup that has been "pending" longer than this is treated as failed (e.g. the server restarted). */
export const PENDING_TIMEOUT_MS = 3 * 60 * 1000;

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

const SYSTEM = `You research companies for a tenant-representation broker in Amsterdam who helps companies find office space.
Use the company's own website first (home, about, contact, locations or offices pages), then web search if offices are unclear.
Only state facts you found. If something is unknown, use null or an empty list. Never guess office locations.
Reply with one JSON object and nothing else, in this shape:
{
  "summary": "2-3 plain sentences in English: what they do, for whom, and anything that matters for office space (size, growth, hybrid work)",
  "industry": "short label, e.g. 'Logistics software'",
  "employees": "approximate headcount as text, e.g. '200-500', or null",
  "headquarters": { "city": "...", "country": "..." } or null,
  "offices": [{ "city": "...", "country": "..." }],
  "sources": ["https://..."]
}
List every office location you found worldwide (headquarters included), at most 30. Use English city and country names.`;

type Fetch = typeof fetch;

/** Asks Claude to research the company. Follows pause_turn continuations. Throws with a readable message. */
export async function researchCompany(website: string, name: string, fetchImpl: Fetch = fetch): Promise<CompanyProfile> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("AI lookup is off. Add ANTHROPIC_API_KEY to the crm service in Railway.");
  const url = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  const messages: { role: "user" | "assistant"; content: unknown }[] = [
    { role: "user", content: `Company: ${name}\nWebsite: ${url}\n\nWhat do they do, and where are their offices?` },
  ];

  for (let round = 0; round < 4; round++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120_000);
    let res: Response;
    try {
      res = await fetchImpl(API_URL, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 2000,
          system: SYSTEM,
          messages,
          tools: [
            { type: "web_fetch_20250910", name: "web_fetch", max_uses: 4, max_content_tokens: 15000 },
            { type: "web_search_20250305", name: "web_search", max_uses: 3 },
          ],
        }),
      });
    } catch (e) {
      throw new Error((e as Error).name === "AbortError" ? "The lookup took too long." : "Couldn't reach the AI service.");
    } finally {
      clearTimeout(timer);
    }
    const body = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      const msg = body?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(res.status === 401 ? "The ANTHROPIC_API_KEY was rejected." : `AI service error: ${String(msg).slice(0, 200)}`);
    }
    if (body?.stop_reason === "pause_turn") {
      // A long turn was paused: send it back unchanged to let Claude carry on.
      messages.push({ role: "assistant", content: body.content });
      continue;
    }
    const text = (body?.content ?? [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");
    return parseProfile(text);
  }
  throw new Error("The lookup didn't finish.");
}

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const place = (v: any) => {
  const city = str(v?.city, 80);
  const country = str(v?.country, 80);
  return city || country ? { city, country } : null;
};

/** Pulls the JSON object out of Claude's reply and keeps only well-formed, bounded fields. */
export function parseProfile(text: string): CompanyProfile {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The AI reply had no summary in it.");
  let raw: any;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("The AI reply couldn't be read.");
  }
  const summary = str(raw.summary, 1200);
  if (!summary) throw new Error("The AI couldn't find enough about this company.");
  const seen = new Set<string>();
  const offices = (Array.isArray(raw.offices) ? raw.offices : [])
    .map(place)
    .filter((o: ReturnType<typeof place>): o is NonNullable<typeof o> => {
      if (!o) return false;
      const k = `${o.city ?? ""}|${o.country ?? ""}`.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 30);
  const sources = (Array.isArray(raw.sources) ? raw.sources : [])
    .filter((s: unknown): s is string => typeof s === "string" && /^https?:\/\/[^\s"<>]+$/i.test(s))
    .slice(0, 8);
  return {
    summary,
    industry: str(raw.industry, 80),
    employees: str(raw.employees, 40),
    headquarters: place(raw.headquarters),
    offices,
    sources,
  };
}
