import * as T from "@radix-ui/react-tabs";
import type { ReactNode } from "react";

export const Tabs = T.Root;
export const TabPanel = T.Content;

/** Underlined tabs. */
export function TabList({ tabs }: { tabs: { value: string; label: string }[] }) {
  return (
    <T.List className="flex gap-7 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <T.Trigger
          key={t.value}
          value={t.value}
          className="-mb-px whitespace-nowrap border-b border-transparent pb-3 text-[14px] text-muted transition-colors duration-200 hover:text-fg data-[state=active]:border-fg data-[state=active]:text-fg"
        >
          {t.label}
        </T.Trigger>
      ))}
    </T.List>
  );
}

export function TabPanelBody({ value, children }: { value: string; children: ReactNode }) {
  return (
    <T.Content value={value} className="pt-10 focus:outline-none">
      {children}
    </T.Content>
  );
}
