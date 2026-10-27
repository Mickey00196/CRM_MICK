import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  CircleCheck,
  SquareKanban,
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
  { to: "/", label: "To-dos", short: "To-dos", icon: CircleCheck, end: true },
  { to: "/projects", label: "Projects", short: "Projects", icon: SquareKanban },
  { to: "/accounts", label: "Companies", short: "Companies", icon: Building2 },
  { to: "/contacts", label: "Contacts", short: "Contacts", icon: Users },
  { to: "/communication", label: "Log", short: "Log", icon: MessagesSquare },
  { to: "/settings", label: "Settings", short: "Settings", icon: Settings },
];

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="mr-0.5 rounded-[4px] bg-subtle px-1 font-sans text-[11px] font-medium text-muted">{children}</kbd>;
}

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
      <div className={cn("min-h-dvh md:grid", collapsed ? "md:grid-cols-[68px_1fr]" : "md:grid-cols-[240px_1fr]")}>
        {/* Sidebar (desktop) */}
        <aside className="glass sticky top-0 z-10 hidden h-dvh flex-col border-r border-line bg-[var(--sidebar)] px-3 pb-4 pt-4 md:flex">
          <div className={cn("mb-4 flex items-center", collapsed ? "flex-col gap-3" : "justify-between pl-1.5")}>
            <NavLink to="/" aria-label="Mick CRM, to-dos" className="rounded-lg">
              <Wordmark collapsed={collapsed} />
            </NavLink>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-hover hover:text-fg"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen className="size-[17px]" /> : <PanelLeftClose className="size-[17px]" />}
            </button>
          </div>

          <div className={cn("mb-4 flex gap-2", collapsed && "flex-col items-center")}>
            <button
              onClick={() => setSearching(true)}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-lg bg-subtle text-[14px] text-muted transition-colors hover:bg-subtle-hover",
                collapsed ? "w-8 justify-center" : "flex-1 px-2.5",
              )}
              aria-label="Search"
            >
              <Search className="size-[15px]" />
              {!collapsed && (
                <>
                  Search
                  <kbd className="ml-auto rounded-[5px] bg-surface/70 px-1.5 font-sans text-[11px] text-faint shadow-[var(--shadow-card)]">/</kbd>
                </>
              )}
            </button>
            <Menu>
              <MenuTrigger asChild>
                <button
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-white shadow-[0_2px_6px_rgb(0_122_255/0.35)] transition hover:bg-accent-hover active:scale-95"
                  aria-label="New"
                  title="New"
                >
                  <Plus className="size-[17px]" strokeWidth={2.5} />
                </button>
              </MenuTrigger>
              <MenuContent align={collapsed ? "start" : "end"}>
                {newItems.map((i) => (
                  <MenuItem key={i.kind} onSelect={() => ui.openCapture(i.kind)}>
                    <i.icon /> {i.label}
                    {i.key && <kbd className="ml-auto pl-4 font-sans text-xs text-faint">{i.key}</kbd>}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
          </div>

          <nav className="grid gap-px">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                title={collapsed ? n.label : undefined}
                className={({ isActive }) =>
                  cn(
                    "flex h-8 items-center gap-2.5 rounded-lg text-[14px] transition-colors",
                    collapsed ? "justify-center" : "px-2.5",
                    isActive ? "bg-[rgb(0_0_0/0.07)] font-semibold dark:bg-white/10" : "text-fg hover:bg-hover",
                  )
                }
              >
                <n.icon className="size-[18px] shrink-0 text-accent" strokeWidth={1.9} />
                {!collapsed && n.label}
              </NavLink>
            ))}
          </nav>

          {!collapsed && (
            <p className="mt-auto px-2.5 text-[12px] leading-relaxed text-faint">
              <Kbd>N</Kbd> to-do <Kbd>P</Kbd> project <Kbd>L</Kbd> log
            </p>
          )}
        </aside>

        {/* Navigation bar (mobile) */}
        <header className="glass sticky top-0 z-20 flex h-12 items-center justify-between border-b border-line bg-[var(--bar)] px-4 md:hidden">
          <Wordmark />
          <div className="-mr-2 flex items-center">
            <button onClick={() => setSearching(true)} className="grid size-10 place-items-center text-accent" aria-label="Search">
              <Search className="size-[21px]" />
            </button>
            <NavLink to="/settings" className="grid size-10 place-items-center text-accent" aria-label="Settings">
              <Settings className="size-[21px]" />
            </NavLink>
          </div>
        </header>

        {/* Page */}
        <main className="min-w-0 px-4 pb-32 pt-5 sm:px-8 md:pb-16 md:pt-10 lg:px-12 xl:px-16">{children}</main>

        {/* Tab bar (mobile) */}
        <nav className="glass fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-[var(--bar)] pb-[env(safe-area-inset-bottom)] md:hidden">
          {[NAV[0], NAV[1], null, NAV[2], NAV[4]].map((n, i) =>
            n ? (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn("flex flex-col items-center gap-0.5 pb-1.5 pt-2 text-[10.5px] font-medium", isActive ? "text-accent" : "text-[#8e8e93]")
                }
              >
                <n.icon className="size-6" strokeWidth={1.8} />
                {n.short}
              </NavLink>
            ) : (
              <button key={i} onClick={() => ui.openCapture("todo")} className="flex items-center justify-center" aria-label="New">
                <span className="grid size-11 place-items-center rounded-full bg-accent text-white shadow-[0_4px_12px_rgb(0_122_255/0.4)] active:scale-95">
                  <Plus className="size-6" strokeWidth={2.4} />
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

