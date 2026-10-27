import { useEffect, useState } from "react";

interface ToastData {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

const EVENT = "crm:toast";
let next = 1;

/** Shows a short message at the bottom of the screen, optionally with an action like Undo. */
export function toast(message: string, action?: ToastData["action"]) {
  window.dispatchEvent(new CustomEvent<ToastData>(EVENT, { detail: { id: next++, message, action } }));
}

export function Toaster() {
  const [current, setCurrent] = useState<ToastData | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onToast = (e: Event) => {
      clearTimeout(timer);
      setCurrent((e as CustomEvent<ToastData>).detail);
      timer = setTimeout(() => setCurrent(null), 5000);
    };
    window.addEventListener(EVENT, onToast);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(EVENT, onToast);
    };
  }, []);

  if (!current) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-24 z-50 mx-auto flex w-fit max-w-[calc(100vw-32px)] items-center gap-5 rounded-full bg-fg py-2.5 pl-5 pr-4 text-[13.5px] text-bg shadow-[var(--shadow-pop)] [animation:pop-in_.22s_cubic-bezier(.16,1,.3,1)] md:bottom-8"
    >
      <span className="truncate">{current.message}</span>
      {current.action && (
        <button
          className="shrink-0 rounded-md px-1.5 py-0.5 font-medium underline underline-offset-4 hover:no-underline"
          onClick={() => {
            current.action!.run();
            setCurrent(null);
          }}
        >
          {current.action.label}
        </button>
      )}
    </div>
  );
}
