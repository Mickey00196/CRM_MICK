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
        <D.Overlay className="fixed inset-0 z-50 bg-[#0b1915]/30 backdrop-blur-[2px] [animation:overlay-in_.15s_ease] dark:bg-black/50" />
        <D.Content
          aria-describedby={undefined}
          className={cn(
            "fixed left-1/2 top-[12vh] z-50 max-h-[80vh] w-[min(560px,calc(100vw-24px))] -translate-x-1/2 overflow-y-auto rounded-xl border border-line bg-surface shadow-2xl [animation:pop-in_.16s_ease] focus:outline-none",
            className,
          )}
        >
          <D.Title className={hideTitle ? "sr-only" : "title px-5 pt-5 text-base"}>{title}</D.Title>
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
        <D.Overlay className="fixed inset-0 z-40 bg-[#0b1915]/20 [animation:overlay-in_.15s_ease] dark:bg-black/40" />
        <D.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-xl [animation:sheet-in_.2s_ease] focus:outline-none sm:w-[460px]"
        >
          <div className={cn("flex items-center px-6 pt-5", hideTitle ? "justify-end pb-0" : "justify-between pb-2")}>
            <D.Title className={hideTitle ? "sr-only" : "title text-[17px]"}>{title}</D.Title>
            <D.Close className="-mr-2 rounded-md p-1.5 text-faint hover:bg-hover hover:text-fg" aria-label="Close">
              <X className="size-4" />
            </D.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-8">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
