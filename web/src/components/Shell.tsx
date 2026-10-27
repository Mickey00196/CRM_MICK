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
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line px-3 py-4 md:flex">
          <div className={cn("mb-5 flex items-center", collapsed ? "justify-center" : "justify-between pl-2")}>
            {!collapsed && <span className="title text-[15px]">Mick CRM</span>}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="rounded-md p-1.5 text-faint hover:bg-hover hover:text-fg"
              aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            >
              {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </button>
          </div>

          <Menu>
            <MenuTrigger asChild>
              <button
                className={cn(
                  "mb-2 flex h-9 items-center gap-2 rounded-md bg-fg text-sm font-medium text-bg transition-colors hover:bg-accent hover:text-accent-fg",
                  collapsed ? "justify-center" : "px-3",
                )}
                aria-label="New"
              >
                <Plus className="size-4" />
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
              "mb-4 flex h-9 items-center gap-2 rounded-md text-sm text-muted transition-colors hover:bg-hover hover:text-fg",
              collapsed ? "justify-center" : "px-3",
            )}
            aria-label="Search"
          >
            <Search className="size-4" />
            {!collapsed && (
              <>
                Search <kbd className="ml-auto rounded border border-line px-1.5 text-[11px] text-faint">/</kbd>
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
                    "flex h-9 items-center gap-2.5 rounded-md text-sm transition-colors",
                    collapsed ? "justify-center" : "px-3",
                    isActive ? "bg-hover font-medium text-fg" : "text-muted hover:bg-hover hover:text-fg",
                  )
                }
              >
                <n.icon className="size-4 shrink-0" />
                {!collapsed && n.label}
              </NavLink>
            ))}
          </nav>

          {!collapsed && (
            <p className="mt-auto px-3 text-xs leading-relaxed text-faint">
              <kbd className="font-sans">N</kbd> to-do · <kbd className="font-sans">P</kbd> project · <kbd className="font-sans">L</kbd> log
            </p>
          )}
        </aside>

        {/* Top bar (mobile) */}
        <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-line bg-bg/95 px-4 backdrop-blur md:hidden">
          <span className="title text-[15px]">Mick CRM</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setSearching(true)} className="rounded-md p-2 text-muted hover:text-fg" aria-label="Search">
              <Search className="size-[18px]" />
            </button>
            <NavLink to="/settings" className="rounded-md p-2 text-muted hover:text-fg" aria-label="Settings">
              <Settings className="size-[18px]" />
            </NavLink>
          </div>
        </header>

        {/* Page */}
        <main className="min-w-0 px-4 pb-28 pt-6 sm:px-8 md:pb-16 md:pt-10 lg:px-12">{children}</main>

        {/* Bottom bar (mobile) */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          {[NAV[0], NAV[1], null, NAV[2], NAV[4]].map((n, i) =>
            n ? (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) => cn("flex flex-col items-center gap-0.5 py-2 text-[11px]", isActive ? "text-fg" : "text-faint")}
              >
                <n.icon className="size-5" />
                {n.short}
              </NavLink>
            ) : (
              <button key={i} onClick={() => ui.openCapture("todo")} className="flex flex-col items-center justify-center" aria-label="New">
                <span className="grid size-10 place-items-center rounded-full bg-fg text-bg">
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

