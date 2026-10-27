import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { api, clearCache, setUnauthorizedHandler } from "@/lib/api";
import { setTimezone } from "@/lib/format";
import { Shell } from "@/components/Shell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Login } from "@/pages/Login";
import { Todos } from "@/pages/Todos";
import { Projects } from "@/pages/Projects";
import { ProjectPage } from "@/pages/Project";
import { Accounts } from "@/pages/Accounts";
import { AccountPage } from "@/pages/Account";
import { Contacts } from "@/pages/Contacts";
import { ContactPage } from "@/pages/Contact";
import { Communication } from "@/pages/Communication";
import { SettingsPage } from "@/pages/Settings";
import { Review } from "@/pages/Review";

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearCache();
      setAuthed(false);
    });
    api<{ user: unknown; timezone: string }>("/me")
      .then((r) => {
        setTimezone(r.timezone);
        setAuthed(Boolean(r.user));
      })
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) return null;
  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  return (
    <Shell>
      <Pages
        onLogout={() => {
          clearCache();
          setAuthed(false);
        }}
      />
    </Shell>
  );
}

function Pages({ onLogout }: { onLogout: () => void }) {
  const location = useLocation();
  // Keyed on the path so a crash on one page doesn't stick when you navigate away.
  return (
    <ErrorBoundary key={location.pathname}>
      <Routes>
        <Route path="/" element={<Todos />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectPage />} />
        <Route path="/review" element={<Review />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/accounts/:id" element={<AccountPage />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/contacts/:id" element={<ContactPage />} />
        <Route path="/communication" element={<Communication />} />
        <Route path="/settings" element={<SettingsPage onLogout={onLogout} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
