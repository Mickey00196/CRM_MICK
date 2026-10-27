import * as T from "@radix-ui/react-tabs";
import type { ReactNode } from "react";

export const Tabs = T.Root;
export const TabPanel = T.Content;

/** iOS-style segmented control. */
export function TabList({ tabs }: { tabs: { value: string; label: string }[] }) {
  return (
    <div className="max-w-full overflow-x-auto">
      <T.List className="segmented">
        {tabs.map((t) => (
          <T.Trigger key={t.value} value={t.value} className="min-w-24">
            {t.label}
          </T.Trigger>
        ))}
      </T.List>
    </div>
  );
}

export function TabPanelBody({ value, children }: { value: string; children: ReactNode }) {
  return (
    <T.Content value={value} className="pt-6 focus:outline-none">
      {children}
    </T.Content>
  );
}
