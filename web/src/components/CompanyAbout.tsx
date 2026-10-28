import { useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import type { Account, CompanyProfile } from "@shared/model";
import { api } from "@/lib/api";
import { dmy } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "./Toast";

/**
 * "About": what the company does and where its offices are, looked up by AI from its website.
 * Shows a placeholder while the lookup runs (the page polls), and a retry when it fails.
 */
export function CompanyAbout({ account, aiEnabled, onEditCompany }: { account: Account; aiEnabled: boolean; onEditCompany: () => void }) {
  const [starting, setStarting] = useState(false);
  const profile = account.ai_profile;
  const pending = account.ai_status === "pending" || starting;
  const site = account.domain || account.website.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  async function lookup() {
    setStarting(true);
    try {
      await api(`/accounts/${account.id}/lookup`, "POST");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  const refresh = profile && aiEnabled && (
    <button onClick={lookup} disabled={pending} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg disabled:opacity-50">
      <RefreshCw className={pending ? "size-3 animate-spin" : "size-3"} />
      {pending ? "Updating…" : "Refresh"}
    </button>
  );
  const badge = <Sparkles className="size-3.5 text-accent-text" aria-hidden="true" />;

  if (profile) {
    return (
      <Card title="About" icon={badge} action={refresh}>
        <Profile profile={profile} />
        <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-3 text-xs text-faint">
          AI summary from public sources{account.ai_updated_at && ` · ${dmy(account.ai_updated_at)}`}. Can be wrong; check before you rely on it.
          {profile.sources.length > 0 && (
            <span className="flex flex-wrap gap-x-2">
              {profile.sources.map((s) => (
                <a key={s} href={s} target="_blank" rel="noreferrer noopener" className="underline-offset-2 hover:text-fg hover:underline">
                  {hostOf(s)}
                </a>
              ))}
            </span>
          )}
        </p>
        {account.ai_status === "failed" && <p className="mt-2 text-xs text-late">Refresh failed: {account.ai_error}</p>}
      </Card>
    );
  }

  if (pending) {
    return (
      <Card title="About" icon={badge}>
        <div aria-busy="true">
          <p className="mb-4 flex items-center gap-2 text-sm text-muted">
            <Sparkles className="size-3.5 animate-pulse text-accent-text" />
            Looking up {site || "the company"}: what they do and where their offices are. Takes about half a minute.
          </p>
          <div className="grid animate-pulse gap-2">
            <div className="h-3.5 w-11/12 rounded bg-subtle" />
            <div className="h-3.5 w-10/12 rounded bg-subtle" />
            <div className="h-3.5 w-7/12 rounded bg-subtle" />
          </div>
        </div>
      </Card>
    );
  }

  // Nothing yet: offer the lookup, or say what's needed for it.
  return (
    <Card title="About" icon={badge}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {account.ai_status === "failed" ? (
          <p className="text-sm text-late">Couldn't look this company up: {account.ai_error}</p>
        ) : !site ? (
          <p className="text-sm text-muted">
            Add their website and the CRM can look up what they do and where their offices are.{" "}
            <button onClick={onEditCompany} className="text-accent-text hover:underline">
              Add website
            </button>
          </p>
        ) : aiEnabled ? (
          <p className="text-sm text-muted">Get a short summary of what {account.name} does and where their offices are, from {site}.</p>
        ) : (
          <p className="text-sm text-muted">AI lookup is off. Add ANTHROPIC_API_KEY to the crm service in Railway to get a summary from {site}.</p>
        )}
        {site && aiEnabled && (
          <Button size="sm" onClick={lookup} disabled={pending}>
            <Sparkles /> {account.ai_status === "failed" ? "Try again" : "Look up with AI"}
          </Button>
        )}
      </div>
    </Card>
  );
}

function Profile({ profile: p }: { profile: CompanyProfile }) {
  // Offices grouped by country: "Netherlands  Amsterdam, Rotterdam".
  const byCountry = new Map<string, string[]>();
  for (const o of p.offices) {
    const k = o.country ?? "Other";
    if (!byCountry.has(k)) byCountry.set(k, []);
    if (o.city) byCountry.get(k)!.push(o.city);
  }
  const hq = p.headquarters ? [p.headquarters.city, p.headquarters.country].filter(Boolean).join(", ") : null;

  return (
    <div className="grid gap-5">
      <p className="max-w-prose text-[15px] leading-relaxed">{p.summary}</p>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Fact label="Industry" value={p.industry} />
        <Fact label="Employees" value={p.employees} />
        <Fact label="Headquarters" value={hq} />
        <Fact label="Offices" value={p.offices.length ? `${p.offices.length} in ${byCountry.size} ${byCountry.size === 1 ? "country" : "countries"}` : null} />
      </dl>
      {byCountry.size > 0 && (
        <div>
          <p className="mb-1.5 text-[13px] text-muted">Office locations</p>
          <ul className="grid gap-1 text-sm">
            {[...byCountry].map(([country, cities]) => (
              <li key={country} className="grid grid-cols-[9rem_1fr] gap-3">
                <span className="truncate text-muted">{country}</span>
                <span>{cities.length ? cities.join(", ") : "–"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className={value ? "mt-0.5 truncate text-sm" : "mt-0.5 text-sm text-faint"}>{value || "–"}</dd>
    </div>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
