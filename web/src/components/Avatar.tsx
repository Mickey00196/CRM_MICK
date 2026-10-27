import { cn } from "@/lib/utils";

export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s&]/gu, " ").split(/\s+/).filter((w) => w && w !== "&");
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "·";
}

/**
 * Monogram like Apple Contacts: white initials on a soft grey gradient.
 * People are round; companies are squircles.
 */
export function Avatar({
  name,
  size = "md",
  shape = "square",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  shape?: "round" | "square";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-grid shrink-0 select-none place-items-center bg-gradient-to-b from-[#a8adb9] to-[#858a96] font-semibold tracking-wide text-white dark:from-[#6e7280] dark:to-[#50535d]",
        size === "sm" && "size-6 text-[9.5px]",
        size === "md" && "size-8 text-[12px]",
        size === "lg" && "size-14 text-[20px]",
        size === "xl" && "size-22 text-[32px]",
        shape === "round" ? "rounded-full" : size === "sm" ? "rounded-[6px]" : size === "md" ? "rounded-[8px]" : "rounded-[14px]",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
