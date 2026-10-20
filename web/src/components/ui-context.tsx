import { createContext, useContext } from "react";
import type { LogPreset } from "./LogForm";
import type { PickedAccount } from "./AccountPicker";

export type CaptureKind = "todo" | "log" | "account" | "contact";

export interface UIActions {
  openCapture: (kind?: CaptureKind, preset?: { account?: PickedAccount | null }) => void;
  openLog: (preset: LogPreset) => void;
  openTask: (id: string, step?: "view" | "complete") => void;
}

export const UIContext = createContext<UIActions>({
  openCapture: () => {},
  openLog: () => {},
  openTask: () => {},
});

export const useUI = () => useContext(UIContext);

/** Window event with the id of a to-do that was just completed or snoozed from the panel. */
export const TASK_DONE = "crm:task-done";
