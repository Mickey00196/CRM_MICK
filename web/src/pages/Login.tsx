import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/login", "POST", { email, password });
      onLogin();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[1.05fr_1fr]">
      {/* Ink panel: one line, set in the serif. */}
      <aside className="relative flex min-h-64 flex-col justify-between overflow-hidden bg-[#1b1a17] p-8 text-[#f2efe8] sm:p-12 lg:min-h-dvh lg:p-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-1/4 -top-1/3 size-[70vmax] rounded-full bg-[radial-gradient(closest-side,rgb(60_80_120/0.35),transparent)]"
        />
        <span className="relative flex items-baseline gap-2">
          <span className="serif text-[26px] leading-none">Mick</span>
          <span className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-[#f2efe8]/55">CRM</span>
        </span>
        <div className="relative mt-12 lg:mt-0">
          <p className="display max-w-md text-[40px] sm:text-[56px]">
            Every project.
            <br />
            <span className="italic text-[#f2efe8]/60">And what comes next.</span>
          </p>
        </div>
        <p className="relative mt-10 hidden text-[12.5px] text-[#f2efe8]/45 lg:block">Private workspace · Hosted in Amsterdam</p>
      </aside>

      <main className="grid place-items-center px-6 py-14">
        <form onSubmit={submit} className="rise w-full max-w-[360px]">
          <h1 className="display text-[34px]">Sign in</h1>
          <p className="mt-2 text-[14px] text-muted">Welcome back.</p>

          <div className="mt-10 grid gap-4">
            <label className="grid gap-2">
              <span className="text-[13px] text-muted">Email</span>
              <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required className="h-11" />
            </label>
            <label className="grid gap-2">
              <span className="text-[13px] text-muted">Password</span>
              <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11" />
            </label>
          </div>
          {error && <p className="mt-4 text-[13px] text-late-text">{error}</p>}
          <Button disabled={busy} className="mt-7 h-11 w-full text-[14px]">
            {busy ? "Signing in…" : "Continue"}
          </Button>
        </form>
      </main>
    </div>
  );
}
