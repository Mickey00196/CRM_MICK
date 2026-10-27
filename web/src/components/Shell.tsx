import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  FolderKanban,
  FolderPlus,
  Building2,
  Users,
  MessagesSquare,
  Settings,
  Plus,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  ListTodo,
  MessageSquarePlus,
  UserPlus,
  Building,
} from "lucide-react";
import { useStored } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/dropdown";
import { Sheet } from "@/components/ui/dialog";
import { UIContext, TASK_DONE, type CaptureKind, type LogPreset, type PageContext, type UIActions } from "./ui-context";
import { QuickCapture } from "./QuickCapture";
import { SearchDialog } from "./Search";
import { LogForm } from "./LogForm";
import { TaskPanel } from "./TaskPanel";
import { Toaster } from "./Toast";
import { Wordmark } from "./Brand";

const NAV = [
  { to: "/", label: "To-dos", short: "To-dos", icon: CheckCircle2, end: true },
  { to: "/projects", label: "Projects", short: "Projects", icon: FolderKanban },
  { to: "/accounts", label: "Companies", short: "Companies", icon: Building2 },
  { to: "/contacts", label: "Contacts", short: "Contacts", icon: Users },
  { to: "/communication", label: "Log", short: "Log", icon: MessagesSquare },
  { to: "/settings", label: "Settings", short: "Settings", icon: Settings },
];

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable;
}

export function Shell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useStored("nav-collapsed", false);
  const [capture, setCapture] = useState<{ kind: CaptureKind; ctx: PageContext } | null>(null);
  const [searching, setSearching] = useState(false);
  const [log, setLog] = useState<LogPreset | null>(null);
  const [task, setTask] = useState<{ id: string; step: "view" | "complete" } | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Close panels when navigating.
  useEffect(() => {
    setTask(null);
  }, [location.pathname]);

  const page = useRef<PageContext | null>(null);
  const pageContext = useCallback((): PageContext => page.current ?? {}, []);
  const setPageContext = useCallback((ctx: PageContext | null) => {
    page.current = ctx;
  }, []);

  const ui: UIActions = useMemo(
    () => ({
      openCapture: (kind = "todo", preset) => setCapture({ kind, ctx: preset ?? pageContext() }),
      openLog: (preset) => setLog(preset),
      openTask: (id, step = "view") => setTask({ id, step }),
      setPageContext,
    }),
    [pageContext, setPageContext],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ui.openCapture("todo");
        return;
      }
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector("[role=dialog]")) return;
      if (e.key === "/") {
        e.preventDefault();
        setSearching(true);
      } else if (e.key === "n") {
        e.preventDefault();
        ui.openCapture("todo");
      } else if (e.key === "p") {
        e.preventDefault();
        ui.openCapture("project");
      } else if (e.key === "l") {
        e.preventDefault();
        const ctx = pageContext();
        ctx.account || ctx.project ? setLog(ctx) : ui.openCapture("log");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ui, pageContext]);

  const newItems: { kind: CaptureKind; label: string; key: string; icon: typeof Plus }[] = [
    { kind: "todo", label: "To-do", key: "N", icon: ListTodo },
    { kind: "project", label: "Project", key: "P", icon: FolderPlus },
    { kind: "log", label: "Log a call, email or note", key: "L", icon: MessageSquarePlus },
    { kind: "account", label: "Company", key: "", icon: Building },
    { kind: "contact", label: "Contact", key: "", icon: UserPlus },
  ];

  return (
    <UIContext.Provider value={ui}>
      <div className={cn("min-h-dvh md:grid", collapsed ? "md:grid-cols-[64px_1fr]" : "md:grid-cols-[224px_1fr]")}>
        {/* Left menu (desktop) */}
        <aside className="sticky top-0 hidden h-dvh flex-col bg-side px-3 pb-4 pt-5 text-side-fg md:flex">
          <div className={cn("mb-6 flex items-center", collapsed ? "flex-col gap-3" : "justify-between pl-1.5")}>
            <NavLink to="/" aria-label="Mick CRM, to-dos">
              <Wordmark collapsed={collapsed} />
            </NavLink>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="rounded-md p-1.5 text-side-muted transition-colors hover:bg-side-hover hover:text-side-fg"
              aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            >
              {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </button>
          </div>

          <Menu>
            <MenuTrigger asChild>
              <button
                className={cn(
                  "mb-2 flex h-10 items-center gap-2 rounded-lg bg-brass text-sm font-semibold text-brass-fg shadow-sm transition hover:brightness-105",
                  collapsed ? "justify-center" : "px-3",
                )}
                aria-label="New"
              >
                <Plus className="size-4" strokeWidth={2.5} />
                {!collapsed && "New"}
              </button>
            </MenuTrigger>
            <MenuContent>
              {newItems.map((i) => (
                <MenuItem key={i.kind} onSelect={() => ui.openCapture(i.kind)}>
                  <i.icon /> {i.label}
                  {i.key && <kbd className="ml-auto pl-4 font-sans text-xs text-faint">{i.key}</kbd>}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>

          <button
            onClick={() => setSearching(true)}
            className={cn(
              "mb-5 flex h-9 items-center gap-2 rounded-lg text-sm text-side-muted ring-1 ring-side-line transition-colors hover:bg-side-hover hover:text-side-fg",
              collapsed ? "justify-center" : "px-3",
            )}
            aria-label="Search"
          >
            <Search className="size-4" />
            {!collapsed && (
              <>
                Search <kbd className="ml-auto rounded border border-side-line px-1.5 text-[11px]">/</kbd>
              </>
            )}
          </button>

          <nav className="grid gap-0.5">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                title={collapsed ? n.label : undefined}
                className={({ isActive }) =>
                  cn(
                    "relative flex h-9 items-center gap-2.5 rounded-lg text-sm transition-colors",
                    collapsed ? "justify-center" : "px-3",
                    isActive ? "bg-side-active font-medium text-white" : "text-side-muted hover:bg-side-hover hover:text-side-fg",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-brass" aria-hidden="true" />}
                    <n.icon className="size-4 shrink-0" />
                    {!collapsed && n.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {!collapsed && (
            <p className="mt-auto px-3 text-xs leading-relaxed text-side-muted/80">
              <kbd className="font-sans">N</kbd> to-do · <kbd className="font-sans">P</kbd> project · <kbd className="font-sans">L</kbd> log
            </p>
          )}
        </aside>

        {/* Top bar (mobile) */}
        <header className="sticky top-0 z-20 flex h-13 items-center justify-between bg-side px-4 text-side-fg md:hidden">
          <Wordmark />
          <div className="flex items-center gap-1">
            <button onClick={() => setSearching(true)} className="rounded-md p-2 text-side-muted hover:text-side-fg" aria-label="Search">
              <Search className="size-[18px]" />
            </button>
            <NavLink to="/settings" className="rounded-md p-2 text-side-muted hover:text-side-fg" aria-label="Settings">
              <Settings className="size-[18px]" />
            </NavLink>
          </div>
        </header>

        {/* Page */}
        <main className="min-w-0 px-4 pb-28 pt-6 sm:px-8 md:pb-16 md:pt-10 lg:px-12 xl:px-16">{children}</main>

        {/* Bottom bar (mobile) */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          {[NAV[0], NAV[1], null, NAV[2], NAV[4]].map((n, i) =>
            n ? (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) => cn("flex flex-col items-center gap-0.5 py-2 text-[11px]", isActive ? "font-medium text-accent" : "text-faint")}
              >
                <n.icon className="size-5" />
                {n.short}
              </NavLink>
            ) : (
              <button key={i} onClick={() => ui.openCapture("todo")} className="flex flex-col items-center justify-center" aria-label="New">
                <span className="grid size-11 place-items-center rounded-full bg-brass text-brass-fg shadow-[var(--shadow-lift)]">
                  <Plus className="size-5" />
                </span>
              </button>
            ),
          )}
        </nav>

      </div>

      <QuickCapture
        open={capture !== null}
        kind={capture?.kind ?? "todo"}
        ctx={capture?.ctx ?? {}}
        onKind={(kind) => setCapture((c) => ({ kind, ctx: c?.ctx ?? {} }))}
        onClose={() => setCapture(null)}
      />
      <SearchDialog open={searching} onClose={() => setSearching(false)} />

      <Sheet open={log !== null} onOpenChange={(o) => !o && setLog(null)} title="Log communication">
        {log && <LogForm key={JSON.stringify(log)} preset={log} onSaved={() => setLog(null)} onCancel={() => setLog(null)} />}
      </Sheet>

      <Sheet open={task !== null} onOpenChange={(o) => !o && setTask(null)} title="To-do" hideTitle>
        {task && (
          <TaskPanel
            taskId={task.id}
            startWith={task.step}
            onClose={() => setTask(null)}
            onDone={(id) => {
              setTask(null);
              // Synchronous, so the To-dos list hears it before it reloads and can fade the row out.
              window.dispatchEvent(new CustomEvent(TASK_DONE, { detail: id }));
            }}
          />
        )}
      </Sheet>

      <Toaster />
    </UIContext.Provider>
  );
}

