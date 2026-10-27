import * as T from "@radix-ui/react-tabs";
import type { ReactNode } from "react";

export const Tabs = T.Root;
export const TabPanel = T.Content;

/** Underlined tabs. */
export function TabList({ tabs }: { tabs: { value: string; label: string }[] }) {
  return (
    <T.List className="flex gap-5 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <T.Trigger
          key={t.value}
          value={t.value}
          className="-mb-px whitespace-nowrap border-b-2 border-transparent pb-2.5 text-[13px] font-medium text-muted transition-colors hover:text-fg data-[state=active]:border-fg data-[state=active]:text-fg"
        >
          {t.label}
        </T.Trigger>
      ))}
    </T.List>
  );
}

export function TabPanelBody({ value, children }: { value: string; children: ReactNode }) {
  return (
    <T.Content value={value} className="pt-6 focus:outline-none">
      {children}
    </T.Content>
  );
}
