import { createContext, useContext, useEffect } from "react";
import type { Channel } from "@shared/model";
import type { PickedAccount, PickedProject } from "./Pickers";

export type CaptureKind = "todo" | "project" | "log" | "account" | "contact";

/** What the open page is about, so capture and "L" default to it. */
export interface PageContext {
  account?: PickedAccount | null;
  project?: PickedProject | null;
}

export interface LogPreset extends PageContext {
  contact_id?: string | null;
  channel?: Channel;
}

export interface UIActions {
  openCapture: (kind?: CaptureKind, preset?: PageContext) => void;
  openLog: (preset: LogPreset) => void;
  openTask: (id: string, step?: "view" | "complete") => void;
  setPageContext: (ctx: PageContext | null) => void;
}

export const UIContext = createContext<UIActions>({
  openCapture: () => {},
  openLog: () => {},
  openTask: () => {},
  setPageContext: () => {},
});

export const useUI = () => useContext(UIContext);

/** Registers the page's company and/or project while it's mounted. */
export function usePageContext(ctx: PageContext | null) {
  const { setPageContext } = useUI();
  const key = JSON.stringify(ctx ?? null);
  useEffect(() => {
    setPageContext(JSON.parse(key));
    return () => setPageContext(null);
  }, [key, setPageContext]);
}

/** Window event with the id of a to-do that was just completed or snoozed, so lists can fade it out. */
export const TASK_DONE = "crm:task-done";
