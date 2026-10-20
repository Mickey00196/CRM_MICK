import { useEffect, useState } from "react";
import { api, useLoad, useStored } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Chips } from "@/components/ui/input";

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

  async function logout() {
    await api("/logout", "POST").catch(() => {});
    onLogout();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="title mb-10 text-2xl">Settings</h1>

      <Row label="Appearance">
        <Chips
          options={[
            { key: "system", label: "System" },
            { key: "light", label: "Light" },
            { key: "dark", label: "Dark" },
          ]}
          value={theme}
          onChange={setTheme}
          size="sm"
        />
      </Row>

      <Row label="Daily reminder email">
        {data?.reminders ? (
          <div className="grid gap-2 text-sm">
            <p className="text-muted">Weekdays at 07:30 to {data.reminder_to}: overdue, today, and accounts without a next step.</p>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={testEmail}>
                Send a test now
              </Button>
              {testResult && <span className="text-[13px] text-muted">{testResult}</span>}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">Off. Set RESEND_API_KEY and DIGEST_TO on the server to turn it on.</p>
        )}
      </Row>

      <Row label="Your data">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/api/accounts/export.csv" download>
              Export accounts (CSV)
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/api/export.json" download>
              Export everything (JSON)
            </a>
          </Button>
        </div>
      </Row>

      <Row label="Keyboard">
        <dl className="grid grid-cols-[5rem_1fr] gap-y-1.5 text-sm">
          {[
            ["⌘K / Ctrl K", "Quick capture"],
            ["N", "New to-do"],
            ["L", "Log communication (on an account: for that account)"],
            ["/", "Search"],
          ].map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Row>

      <Row label="Account">
        <Button variant="outline" size="sm" onClick={logout}>
          Log out
        </Button>
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 border-t border-line py-6 sm:grid-cols-[12rem_1fr]">
      <h2 className="text-sm font-medium">{label}</h2>
      <div>{children}</div>
    </section>
  );
}
