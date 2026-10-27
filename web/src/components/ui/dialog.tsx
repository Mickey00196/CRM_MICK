import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Centered dialog. */
export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  className,
  hideTitle,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
  hideTitle?: boolean;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[3px] [animation:overlay-in_.15s_ease] dark:bg-black/55" />
        <D.Content
          aria-describedby={undefined}
          className={cn(
            "fixed left-1/2 top-[12vh] z-50 max-h-[80vh] w-[min(560px,calc(100vw-24px))] -translate-x-1/2 overflow-y-auto rounded-[18px] bg-elevated shadow-[var(--shadow-pop)] [animation:pop-in_.18s_cubic-bezier(.2,.8,.2,1)] focus:outline-none",
            className,
          )}
        >
          <D.Title className={hideTitle ? "sr-only" : "title px-5 pt-5 text-[17px]"}>{title}</D.Title>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** Calm panel that slides in from the right (full screen on phones). */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  hideTitle,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  children: ReactNode;
  hideTitle?: boolean;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-black/15 [animation:overlay-in_.15s_ease] dark:bg-black/45" />
        <D.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-40 flex w-full flex-col bg-elevated shadow-[var(--shadow-pop)] [animation:sheet-in_.25s_cubic-bezier(.2,.8,.2,1)] focus:outline-none sm:inset-y-3 sm:left-auto sm:right-3 sm:w-[440px] sm:rounded-[18px]"
        >
          <div className={cn("flex items-center px-6 pt-5", hideTitle ? "justify-end pb-0" : "justify-between pb-2")}>
            <D.Title className={hideTitle ? "sr-only" : "title text-[20px]"}>{title}</D.Title>
            <D.Close className="-mr-2 grid size-7 place-items-center rounded-full bg-subtle text-muted hover:bg-subtle-hover hover:text-fg" aria-label="Close">
              <X className="size-3.5" strokeWidth={2.5} />
            </D.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-8">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
