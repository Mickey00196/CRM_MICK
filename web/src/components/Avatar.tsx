import { cn } from "@/lib/utils";

export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s&]/gu, " ").split(/\s+/).filter((w) => w && w !== "&");
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "·";
}

/** Initials in a quiet bordered tile. People are round; companies are square. */
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
        "inline-grid shrink-0 select-none place-items-center border border-line bg-subtle font-mono font-medium text-muted",
        size === "sm" && "size-5 text-[8.5px]",
        size === "md" && "size-7 text-[10.5px]",
        size === "lg" && "size-11 text-[14px]",
        size === "xl" && "size-14 text-[17px]",
        shape === "round" ? "rounded-full" : size === "sm" ? "rounded-[5px]" : size === "md" ? "rounded-[7px]" : "rounded-[10px]",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
