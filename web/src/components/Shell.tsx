import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  MoreHorizontal,
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
import { Brand } from "./Brand";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Plus;
  end?: boolean;
}

// What you use every day first; the address book below it; settings out of the way.
const MAIN: NavItem[] = [
  { to: "/", label: "To-dos", icon: CheckCircle2, end: true },
  { to: "/accounts", label: "Accounts", icon: Building2 },
  { to: "/review", label: "Weekly review", icon: CalendarCheck },
];
const ADDRESS_BOOK: NavItem[] = [
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/communication", label: "Log", icon: MessagesSquare },
];
const SETTINGS: NavItem = { to: "/settings", label: "Settings", icon: Settings };

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
        setSearching(true);
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
      } else if (e.key === "a") {
        e.preventDefault();
        ui.openCapture("account");
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
    { kind: "account", label: "Account", key: "A", icon: Building },
    { kind: "log", label: "Log a call, email or note", key: "L", icon: MessageSquarePlus },
    { kind: "contact", label: "Contact", key: "", icon: UserPlus },
  ];

  return (
    <UIContext.Provider value={ui}>
      <div className={cn("min-h-dvh md:grid", collapsed ? "md:grid-cols-[64px_1fr]" : "md:grid-cols-[224px_1fr]")}>
        {/* Left menu (desktop) */}
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line px-3 py-4 md:flex">
          <div className={cn("mb-5 flex items-center", collapsed ? "justify-center" : "justify-between pl-2")}>
            {!collapsed && <Brand />}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="rounded-md p-1.5 text-faint hover:bg-hover hover:text-fg"
              aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            >
              {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </button>
          </div>

          {/* New to-do in one click; everything else behind the arrow. */}
          <div className={cn("mb-2 flex", collapsed && "flex-col gap-1")}>
            <button
              onClick={() => ui.openCapture("todo")}
              className={cn(
                "flex h-9 flex-1 items-center gap-2 bg-accent text-sm font-medium text-accent-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.14)] transition-colors hover:bg-accent-hover",
                collapsed ? "justify-center rounded-md" : "rounded-l-md px-3",
              )}
              aria-label="New to-do"
              title="New to-do (N)"
            >
              <Plus className="size-4" />
              {!collapsed && "New to-do"}
            </button>
            <Menu>
              <MenuTrigger asChild>
                <button
                  className={cn(
                    "grid h-9 place-items-center bg-accent text-accent-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.14)] transition-colors hover:bg-accent-hover",
                    collapsed ? "rounded-md" : "w-8 rounded-r-md border-l border-white/20",
                  )}
                  aria-label="New something else"
                  title="New account, log or contact"
                >
                  <ChevronDown className="size-4" />
                </button>
              </MenuTrigger>
              <MenuContent align="end">
                {newItems.map((i) => (
                  <MenuItem key={i.kind} onSelect={() => ui.openCapture(i.kind)}>
                    <i.icon /> {i.label}
                    {i.key && <kbd className="keycap ml-auto">{i.key}</kbd>}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
          </div>

          <button
            onClick={() => setSearching(true)}
            className={cn(
              "mb-4 flex h-9 items-center gap-2 rounded-md text-sm text-muted transition-colors hover:bg-hover hover:text-fg",
              collapsed ? "justify-center" : "px-3",
            )}
            aria-label="Search or run a command"
            title="Search or run a command (⌘K or /)"
          >
            <Search className="size-4" />
            {!collapsed && (
              <>
                Search or jump to <kbd className="keycap ml-auto">⌘K</kbd>
              </>
            )}
          </button>

          <SideNav items={MAIN} collapsed={collapsed} />
          {!collapsed ? <p className="label mb-1 mt-6 px-3 text-[11px]">Address book</p> : <div className="my-3 border-t border-line" />}
          <SideNav items={ADDRESS_BOOK} collapsed={collapsed} />
          <div className="mt-auto">
            <SideNav items={[SETTINGS]} collapsed={collapsed} />
          </div>

          {!collapsed && (
            <p className="mt-3 flex items-center gap-1 whitespace-nowrap px-3 text-xs text-faint">
              <kbd className="keycap">N</kbd> to-do <kbd className="keycap ml-1.5">A</kbd> account <kbd className="keycap ml-1.5">L</kbd> log
            </p>
          )}
        </aside>

        {/* Top bar (mobile) */}
        <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-line bg-bg/95 px-4 backdrop-blur md:hidden">
          <Brand />
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
          <TabLink item={MAIN[0]} />
          <TabLink item={MAIN[1]} />
          <button onClick={() => ui.openCapture("todo")} className="flex flex-col items-center justify-center" aria-label="New to-do">
            <span className="grid size-11 place-items-center rounded-full bg-accent text-accent-fg shadow-[0_6px_16px_-4px_var(--accent-glow)]">
              <Plus className="size-5" />
            </span>
          </button>
          <TabLink item={ADDRESS_BOOK[0]} />
          <Menu>
            <MenuTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[11px]",
                  [...ADDRESS_BOOK.slice(1), MAIN[2], SETTINGS].some((n) => location.pathname.startsWith(n.to)) ? "text-accent-text" : "text-faint",
                )}
              >
                <MoreHorizontal className="size-5" />
                More
              </button>
            </MenuTrigger>
            <MenuContent align="end">
              {[...ADDRESS_BOOK.slice(1), MAIN[2], SETTINGS].map((n) => (
                <MenuItem key={n.to} onSelect={() => navigate(n.to)}>
                  <n.icon /> {n.label}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
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

function SideNav({ items, collapsed }: { items: NavItem[]; collapsed: boolean }) {
  return (
    <nav className="grid gap-0.5">
      {items.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          title={collapsed ? n.label : undefined}
          className={({ isActive }) =>
            cn(
              "flex h-9 items-center gap-2.5 rounded-md text-sm transition-colors",
              collapsed ? "justify-center" : "px-3",
              isActive ? "bg-accent-soft font-medium text-accent-text" : "text-muted hover:bg-hover hover:text-fg",
            )
          }
        >
          <n.icon className="size-4 shrink-0" />
          {!collapsed && n.label}
        </NavLink>
      ))}
    </nav>
  );
}

function TabLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) => cn("flex flex-col items-center gap-0.5 py-2 text-[11px]", isActive ? "font-medium text-accent-text" : "text-faint")}
    >
      <item.icon className="size-5" />
      {item.label}
    </NavLink>
  );
}
