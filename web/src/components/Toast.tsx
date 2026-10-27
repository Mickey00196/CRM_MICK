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
      className="fixed inset-x-0 bottom-20 z-50 mx-auto flex w-fit max-w-[calc(100vw-32px)] items-center gap-4 rounded-lg bg-fg px-4 py-2.5 text-sm text-bg shadow-lg [animation:pop-in_.15s_ease] md:bottom-6"
    >
      <span className="truncate">{current.message}</span>
      {current.action && (
        <button
          className="shrink-0 font-medium text-[#8db2ff] underline-offset-2 dark:text-accent hover:underline"
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
