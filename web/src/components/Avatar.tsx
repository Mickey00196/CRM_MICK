import { cn } from "@/lib/utils";

export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s&]/gu, " ").split(/\s+/).filter((w) => w && w !== "&");
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "·";
}

/** Serif monogram on a warm tile. People are round; companies are square. */
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
        "serif inline-grid shrink-0 select-none place-items-center border border-line bg-subtle leading-none text-fg/75",
        size === "sm" && "size-5 text-[10px]",
        size === "md" && "size-8 text-[14px]",
        size === "lg" && "size-14 text-[22px]",
        size === "xl" && "size-16 text-[26px]",
        shape === "round" ? "rounded-full" : size === "sm" ? "rounded-[5px]" : size === "md" ? "rounded-[8px]" : "rounded-[12px]",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
