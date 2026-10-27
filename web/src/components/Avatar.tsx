import { cn } from "@/lib/utils";

// Muted pairs (background, text) that sit well on the sage palette, light and dark.
const TONES = [
  "bg-[#dfece6] text-[#1d5a48] dark:bg-[#17332a] dark:text-[#8fd3b6]",
  "bg-[#e3e8f2] text-[#33507f] dark:bg-[#1c2538] dark:text-[#9fb4dd]",
  "bg-[#f4e9d2] text-[#80601c] dark:bg-[#352a14] dark:text-[#e2bd6f]",
  "bg-[#f2e2de] text-[#8b3a2b] dark:bg-[#3a1f1a] dark:text-[#eca594]",
  "bg-[#e8e4f1] text-[#4f4180] dark:bg-[#26213a] dark:text-[#b9addf]",
  "bg-[#ddecee] text-[#1f5f6b] dark:bg-[#15302f] dark:text-[#8ccbd3]",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s&]/gu, " ").split(/\s+/).filter((w) => w && w !== "&");
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "·";
}

/** Initials in a soft tile; the colour is stable per name. */
export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-grid shrink-0 place-items-center font-semibold",
        size === "sm" && "size-6 rounded-md text-[10px]",
        size === "md" && "size-8 rounded-lg text-xs",
        size === "lg" && "size-12 rounded-xl text-base",
        TONES[hash(name) % TONES.length],
        className,
      )}
      style={{ fontStretch: "110%" }}
    >
      {initials(name)}
    </span>
  );
}
