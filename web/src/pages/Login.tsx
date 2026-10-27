import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ErrorText, Field, Input } from "@/components/ui/input";
import { Mark } from "@/components/Brand";

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
    <div className="dot-grid grid min-h-dvh place-items-center px-4">
      <form onSubmit={submit} className="grid w-full max-w-sm gap-5 rounded-xl border border-line bg-surface p-7 shadow-[0_12px_40px_-12px_rgb(15_20_26/0.18)]">
        <div className="flex items-center gap-2.5">
          <Mark className="size-8" />
          <h1 className="title text-xl">Mick CRM</h1>
        </div>
        <Field label="Email">
          <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
        </Field>
        <Field label="Password">
          <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button disabled={busy}>Log in</Button>
      </form>
    </div>
  );
}
