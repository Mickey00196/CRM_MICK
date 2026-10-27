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
      className="glass fixed inset-x-0 bottom-24 z-50 mx-auto flex w-fit max-w-[calc(100vw-32px)] items-center gap-4 rounded-full bg-[rgb(28_28_30/0.86)] py-2.5 pl-5 pr-4 text-[14px] font-medium text-white shadow-[var(--shadow-pop)] [animation:pop-in_.18s_cubic-bezier(.2,.8,.2,1)] md:bottom-8"
    >
      <span className="truncate">{current.message}</span>
      {current.action && (
        <button
          className="shrink-0 font-semibold text-[#0a84ff] hover:text-[#409cff]"
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
