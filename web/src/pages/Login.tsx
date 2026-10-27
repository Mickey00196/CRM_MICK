import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ErrorText, Field, Input } from "@/components/ui/input";
import { CanalSkyline, Wordmark } from "@/components/Brand";

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
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative flex min-h-56 flex-col overflow-hidden bg-side p-6 text-side-fg sm:p-10 lg:min-h-dvh">
        <Wordmark />
        <div className="relative z-10 mt-8 hidden max-w-sm lg:block">
          <p className="display text-[40px] text-white">Every project, and what's next.</p>
          <p className="mt-4 text-side-muted">Where each project stands, what you're waiting on, and the to-dos that move them forward.</p>
        </div>
        <CanalSkyline className="absolute inset-x-0 bottom-0 h-40 w-full lg:h-72" />
      </aside>
      <main className="grid justify-items-center px-5 py-10 lg:place-items-center lg:py-12">
        <form onSubmit={submit} className="rise grid w-full max-w-sm gap-5">
          <div>
            <h1 className="display text-[28px]">Welcome back</h1>
            <p className="mt-1 text-sm text-muted">Log in to see today's to-dos.</p>
          </div>
          <Field label="Email">
            <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required className="h-10" />
          </Field>
          <Field label="Password">
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-10" />
          </Field>
          <ErrorText>{error}</ErrorText>
          <Button disabled={busy} className="h-10">
            {busy ? "Logging in…" : "Log in"}
          </Button>
        </form>
      </main>
    </div>
  );
}
