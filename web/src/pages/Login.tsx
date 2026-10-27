import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppIcon } from "@/components/Brand";

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
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-bg px-5 py-12">
      <div
        aria-hidden="true"
        className="dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_65%)]"
      />

      <form onSubmit={submit} className="rise relative w-full max-w-[340px]">
        <AppIcon className="size-9" />
        <h1 className="display mt-6 text-[22px]">Sign in to Mick CRM</h1>
        <p className="mt-1 text-[13.5px] text-muted">Projects and to-dos, in one place.</p>

        <div className="mt-7 grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-[12.5px] font-medium text-muted">Email</span>
            <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required className="h-9" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[12.5px] font-medium text-muted">Password</span>
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-9" />
          </label>
        </div>
        {error && <p className="mt-3 text-[13px] text-late-text">{error}</p>}
        <Button disabled={busy} className="mt-5 h-9 w-full">
          {busy ? "Signing in…" : "Continue"}
        </Button>
        <p className="mono mt-8 text-[11px] text-faint">EU-HOSTED · PRIVATE</p>
      </form>
    </div>
  );
}
