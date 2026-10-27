import { useEffect, useState } from "react";
import { api, useLoad, useStored } from "@/lib/api";
import { Archive, Bell, ChevronRight, FileSpreadsheet, Send, SunMoon } from "lucide-react";
import { PageHeader } from "@/components/Panel";

type Theme = "system" | "light" | "dark";

function applyTheme(t: Theme) {
  const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function SettingsPage({ onLogout }: { onLogout: () => void }) {
  const [theme, setTheme] = useStored<Theme>("theme-choice", "system");
  const { data } = useLoad(() => api<{ reminders: boolean; reminder_to: string | null }>("/settings"), [], { live: false });
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem("theme", theme === "system" ? "" : theme);
    } catch {
      /* ignore */
    }
    applyTheme(theme);
  }, [theme]);

  async function testEmail() {
    setTestResult("Sending…");
    const r = await api<{ sent: boolean; reason?: string }>("/digest/test", "POST");
    setTestResult(r.sent ? "Sent. Check your inbox." : r.reason ?? "Not sent.");
  }

  async function logoutEverywhere() {
    if (!confirm("Log out on every device, including this one?")) return;
    await api("/logout-everywhere", "POST").catch(() => {});
    onLogout();
  }

  async function logout() {
    await api("/logout", "POST").catch(() => {});
    onLogout();
  }

  return (
    <div className="rise mx-auto max-w-2xl">
      <PageHeader title="Settings" />

      <div className="grid gap-8">
        <Group>
          <Row icon={SunMoon} tone="bg-indigo" label="Appearance">
            <div className="segmented" role="radiogroup" aria-label="Appearance">
              {(["system", "light", "dark"] as const).map((t) => (
                <button key={t} role="radio" aria-checked={theme === t} onClick={() => setTheme(t)} className="capitalize">
                  {t === "system" ? "Auto" : t}
                </button>
              ))}
            </div>
          </Row>
        </Group>

        <Group
          footer={
            data?.reminders
              ? `Weekdays at 07:30 to ${data.reminder_to}: overdue, today, and projects without a next step.`
              : "Set RESEND_API_KEY and DIGEST_TO on the server to turn it on."
          }
        >
          <Row icon={Bell} tone="bg-late" label="Daily reminder email">
            <span className="mono text-[12px] text-muted">{data?.reminders ? "ON" : "OFF"}</span>
          </Row>
          {data?.reminders && (
            <Row icon={Send} tone="bg-accent" label="Send a test now" onClick={testEmail}>
              <span className="text-[13px] text-muted">{testResult}</span>
            </Row>
          )}
        </Group>

        <Group header="Your data" footer="A full copy of everything in the CRM. Keep one somewhere safe.">
          <Row icon={FileSpreadsheet} tone="bg-green" label="Export companies" href="/api/accounts/export.csv" value="CSV" />
          <Row icon={Archive} tone="bg-accent" label="Export everything" href="/api/export.json" value="JSON" />
        </Group>

        <Group header="Keyboard shortcuts">
          {[
            ["N", "New to-do"],
            ["P", "New project"],
            ["L", "Log a call, email or note"],
            ["/", "Search"],
            ["⌘K", "Quick capture"],
          ].map(([k, v]) => (
            <Row key={k} label={v}>
              <kbd className="mono inline-grid h-5 min-w-5 place-items-center rounded-[4px] border border-line-strong bg-surface px-1 text-[11px] text-muted">{k}</kbd>
            </Row>
          ))}
        </Group>

        <Group footer="Log out on all devices if you lost a phone or laptop. Changing APP_PASSWORD on the server does the same.">
          <Row label="Log out" onClick={logout} />
          <Row label={<span className="text-late-text">Log out on all devices</span>} onClick={logoutEverywhere} />
        </Group>
      </div>
    </div>
  );
}

/** An inset grouped list, as in the iOS Settings app. */
function Group({ header, footer, children }: { header?: string; footer?: string; children: React.ReactNode }) {
  return (
    <section>
      {header && <h2 className="label mb-2">{header}</h2>}
      <ul className="card overflow-hidden">{children}</ul>
      {footer && <p className="mt-2 text-[12.5px] leading-snug text-muted">{footer}</p>}
    </section>
  );
}

function Row({
  icon: Icon,
  tone,
  label,
  value,
  href,
  onClick,
  children,
}: {
  icon?: typeof Bell;
  tone?: string;
  label: React.ReactNode;
  value?: string;
  href?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const body = (
    <>
      {Icon && (
        <span className="grid size-7 shrink-0 place-items-center rounded-md border border-line bg-subtle text-muted" data-tone={tone}>
          <Icon className="size-3.5" />
        </span>
      )}
      <span className="flex min-h-12 min-w-0 flex-1 items-center justify-between gap-3 border-b border-line py-2 pr-4 group-last/row:border-b-0">
        <span className="truncate text-[13.5px]">{label}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {value && <span className="mono text-[12px] text-muted">{value}</span>}
          {children}
          {(href || (onClick && Icon)) && <ChevronRight className="size-4 text-faint" />}
        </span>
      </span>
    </>
  );
  const cls = "flex w-full items-center gap-3 pl-4 text-left";
  return (
    <li className="group/row transition-colors has-[a:hover,button:hover]:bg-hover">
      {href ? (
        <a href={href} download className={cls}>
          {body}
        </a>
      ) : onClick ? (
        <button onClick={onClick} className={cls}>
          {body}
        </button>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
}
