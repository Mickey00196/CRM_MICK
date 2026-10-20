import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { api, setUnauthorizedHandler } from "@/lib/api";
import { Shell } from "@/components/Shell";
import { Login } from "@/pages/Login";
import { Todos } from "@/pages/Todos";
import { Accounts } from "@/pages/Accounts";
import { AccountPage } from "@/pages/Account";
import { Contacts } from "@/pages/Contacts";
import { ContactPage } from "@/pages/Contact";
import { Communication } from "@/pages/Communication";
import { SettingsPage } from "@/pages/Settings";

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    setUnauthorizedHandler(() => setAuthed(false));
    api<{ user: unknown }>("/me")
      .then((r) => setAuthed(Boolean(r.user)))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) return null;
  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Todos />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/accounts/:id" element={<AccountPage />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/contacts/:id" element={<ContactPage />} />
        <Route path="/communication" element={<Communication />} />
        <Route path="/settings" element={<SettingsPage onLogout={() => setAuthed(false)} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
