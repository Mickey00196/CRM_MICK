import * as T from "@radix-ui/react-tabs";
import type { ReactNode } from "react";

export const Tabs = T.Root;
export const TabPanel = T.Content;

export function TabList({ tabs, variant = "underline" }: { tabs: { value: string; label: string }[]; variant?: "underline" | "segmented" }) {
  if (variant === "segmented")
    return (
      <T.List className="inline-flex rounded-lg border border-line bg-subtle p-0.5">
        {tabs.map((t) => (
          <T.Trigger
            key={t.value}
            value={t.value}
            className="rounded-md px-3.5 py-1.5 text-[13px] text-muted transition-colors hover:text-fg data-[state=active]:bg-surface data-[state=active]:font-medium data-[state=active]:text-fg data-[state=active]:shadow-sm"
          >
            {t.label}
          </T.Trigger>
        ))}
      </T.List>
    );
  return (
    <T.List className="flex gap-6 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <T.Trigger
          key={t.value}
          value={t.value}
          className="-mb-px whitespace-nowrap border-b-2 border-transparent pb-2.5 text-sm text-muted transition-colors hover:text-fg data-[state=active]:border-accent data-[state=active]:text-fg"
        >
          {t.label}
        </T.Trigger>
      ))}
    </T.List>
  );
}

export function TabPanelBody({ value, children }: { value: string; children: ReactNode }) {
  return (
    <T.Content value={value} className="pt-8 focus:outline-none">
      {children}
    </T.Content>
  );
}
