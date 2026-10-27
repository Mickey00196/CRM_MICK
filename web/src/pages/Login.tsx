import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
      {/* Soft colour behind frosted glass, like a macOS wallpaper. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-[10%] -top-[20%] size-[60vmax] rounded-full bg-[#4aa3ff] opacity-30 blur-[120px] dark:opacity-25" />
        <div className="absolute -bottom-[25%] -right-[10%] size-[55vmax] rounded-full bg-[#a76bff] opacity-25 blur-[120px] dark:opacity-20" />
        <div className="absolute bottom-[10%] left-[20%] size-[30vmax] rounded-full bg-[#5ee0c8] opacity-20 blur-[110px] dark:opacity-10" />
      </div>

      <form onSubmit={submit} className="rise glass relative w-full max-w-[380px] rounded-[24px] bg-surface/70 px-7 pb-8 pt-9 text-center shadow-[var(--shadow-pop)]">
        <AppIcon className="mx-auto size-16 drop-shadow-[0_6px_14px_rgb(0_98_230/0.35)]" />
        <h1 className="display mt-5 text-[26px]">Mick CRM</h1>
        <p className="mt-1 text-[15px] text-muted">Sign in to see what's next.</p>

        <div className="mt-7 overflow-hidden rounded-[12px] bg-surface text-left shadow-[0_0_0_1px_var(--line-strong)] focus-within:shadow-[0_0_0_1px_var(--accent),0_0_0_4px_var(--accent-soft)]">
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            required
            placeholder="Email"
            aria-label="Email"
            className="h-12 w-full border-b border-line bg-transparent px-4 text-[16px] outline-none placeholder:text-faint"
          />
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Password"
            aria-label="Password"
            className="h-12 w-full bg-transparent px-4 text-[16px] outline-none placeholder:text-faint"
          />
        </div>
        {error && <p className="mt-3 text-[13px] text-late-text">{error}</p>}
        <Button disabled={busy} className="mt-5 h-11 w-full text-[16px] font-semibold">
          {busy ? "Signing in…" : "Sign In"}
        </Button>
      </form>
    </div>
  );
}
