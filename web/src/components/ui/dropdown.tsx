import * as M from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;

export function MenuContent({ children, align = "start", className }: { children: ReactNode; align?: "start" | "end"; className?: string }) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={6}
        className={cn(
          "glass z-50 min-w-48 rounded-xl bg-elevated/85 p-1 shadow-[var(--shadow-pop)] [animation:pop-in_.12s_ease]",
          className,
        )}
      >
        {children}
      </M.Content>
    </M.Portal>
  );
}

export function MenuItem({ children, onSelect, className }: { children: ReactNode; onSelect?: () => void; className?: string }) {
  return (
    <M.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-[14px] outline-none data-[highlighted]:bg-accent data-[highlighted]:text-white [&_svg]:size-4 [&_svg]:text-accent data-[highlighted]:[&_svg]:text-white data-[highlighted]:[&_kbd]:text-white/70",
        className,
      )}
    >
      {children}
    </M.Item>
  );
}

export function MenuSeparator() {
  return <M.Separator className="my-1 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <M.Label className="px-2.5 pb-1 pt-1.5 text-[12px] font-semibold text-muted">{children}</M.Label>;
}

export function MenuCheckbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <M.CheckboxItem
      checked={checked}
      onCheckedChange={onChange}
      onSelect={(e) => e.preventDefault()}
      className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-[14px] outline-none data-[highlighted]:bg-accent data-[highlighted]:text-white"
    >
      <span className="grid size-4 place-items-center text-[13px] font-semibold">{checked && "✓"}</span>
      {children}
    </M.CheckboxItem>
  );
}
