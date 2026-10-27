import { createContext, useContext, useEffect } from "react";
import type { LogPreset } from "./LogForm";
import type { PickedAccount } from "./AccountPicker";

export type CaptureKind = "todo" | "log" | "account" | "contact";

export interface UIActions {
  openCapture: (kind?: CaptureKind, preset?: { account?: PickedAccount | null }) => void;
  openLog: (preset: LogPreset) => void;
  openTask: (id: string, step?: "view" | "complete") => void;
  /** The account the open page is about, so capture and "L" can default to it. */
  setCurrentAccount: (account: PickedAccount | null) => void;
}

export const UIContext = createContext<UIActions>({
  openCapture: () => {},
  openLog: () => {},
  openTask: () => {},
  setCurrentAccount: () => {},
});

export const useUI = () => useContext(UIContext);

/** Registers the page's account while it's mounted. */
export function useCurrentAccount(account: PickedAccount | null) {
  const { setCurrentAccount } = useUI();
  const id = account?.id ?? null;
  const name = account?.name ?? "";
  useEffect(() => {
    setCurrentAccount(id ? { id, name } : null);
    return () => setCurrentAccount(null);
  }, [id, name, setCurrentAccount]);
}

/** Window event with the id of a to-do that was just completed or snoozed from the panel. */
export const TASK_DONE = "crm:task-done";
