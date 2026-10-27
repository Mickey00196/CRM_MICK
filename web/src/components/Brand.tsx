import { cn } from "@/lib/utils";

/** A stepped canal-house gable: Amsterdam, where the work happens. */
export function GableMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5", className)} aria-hidden="true">
      <path
        d="M5 22V12h2V9h2V6h1.5L12 3l1.5 3H15v3h2v3h2v10z"
        fill="currentColor"
      />
      <rect x="10.5" y="15" width="3" height="7" rx="0.5" fill="var(--side-bg)" />
      <rect x="11" y="8.5" width="2" height="2.5" rx="0.4" fill="var(--side-bg)" />
    </svg>
  );
}

export function Wordmark({ collapsed }: { collapsed?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-lg bg-white/8 text-brass ring-1 ring-white/10">
        <GableMark />
      </span>
      {!collapsed && <span className="title text-[15px] text-side-fg">Mick CRM</span>}
    </span>
  );
}

type Gable = "step" | "neck" | "bell" | "point";
const HOUSES: { w: number; h: number; g: Gable; tone: number }[] = [
  { w: 54, h: 112, g: "point", tone: 0.07 },
  { w: 62, h: 138, g: "step", tone: 0.11 },
  { w: 50, h: 124, g: "neck", tone: 0.08 },
  { w: 58, h: 150, g: "bell", tone: 0.12 },
  { w: 48, h: 118, g: "step", tone: 0.07 },
  { w: 64, h: 132, g: "neck", tone: 0.1 },
  { w: 52, h: 144, g: "point", tone: 0.09 },
  { w: 60, h: 126, g: "bell", tone: 0.11 },
  { w: 50, h: 140, g: "step", tone: 0.08 },
];
const BASE = 210;

function housePath(x: number, w: number, h: number, g: Gable): string {
  const t = BASE - h;
  const m = x + w / 2;
  switch (g) {
    case "step": {
      const s = w / 8;
      return `M${x} ${BASE}V${t}H${x + s}V${t - 9}H${x + 2 * s}V${t - 18}H${x + 3 * s}V${t - 27}H${x + 5 * s}V${t - 18}H${x + 6 * s}V${t - 9}H${x + 7 * s}V${t}H${x + w}V${BASE}Z`;
    }
    case "neck":
      return `M${x} ${BASE}V${t}Q${x + w * 0.22} ${t} ${x + w * 0.28} ${t - 12}V${t - 30}L${m} ${t - 40}L${x + w * 0.72} ${t - 30}V${t - 12}Q${x + w * 0.78} ${t} ${x + w} ${t}V${BASE}Z`;
    case "bell":
      return `M${x} ${BASE}V${t}C${x + w * 0.14} ${t} ${x + w * 0.22} ${t - 8} ${x + w * 0.24} ${t - 22}Q${m} ${t - 46} ${x + w * 0.76} ${t - 22}C${x + w * 0.78} ${t - 8} ${x + w * 0.86} ${t} ${x + w} ${t}V${BASE}Z`;
    case "point":
      return `M${x} ${BASE}V${t}L${m} ${t - 30}L${x + w} ${t}V${BASE}Z`;
  }
}

/** A row of canal houses with a few lit windows, reflected in the water below. */
export function CanalSkyline({ className }: { className?: string }) {
  let x = 0;
  const houses = HOUSES.map((house, i) => {
    const hx = x;
    x += house.w + 2;
    const windows: { x: number; y: number; lit: boolean }[] = [];
    const cols = house.w > 56 ? 3 : 2;
    const gap = house.w / (cols + 1);
    let floor = 0;
    for (let y = BASE - house.h + 14; y < BASE - 40; y += 26, floor++) {
      for (let c = 0; c < cols; c++) windows.push({ x: hx + gap * (c + 1) - 4, y, lit: (i * 7 + floor * 3 + c * 5) % 6 === 0 });
    }
    return { ...house, x: hx, windows };
  });
  const width = x - 2;
  return (
    <svg viewBox={`0 0 ${width} 250`} preserveAspectRatio="xMidYMax slice" className={className} aria-hidden="true">
      {houses.map((h, i) => (
        <g key={i}>
          <path d={housePath(h.x, h.w, h.h, h.g)} fill={`rgb(255 255 255 / ${h.tone})`} />
          {h.windows.map((w, j) => (
            <rect key={j} x={w.x} y={w.y} width={8} height={13} rx={1.5} fill={w.lit ? "var(--brass)" : "rgb(0 0 0 / 0.22)"} opacity={w.lit ? 0.9 : 1} />
          ))}
          <rect x={h.x + h.w / 2 - 6} y={BASE - 24} width={12} height={24} rx={2} fill="rgb(0 0 0 / 0.25)" />
        </g>
      ))}
      <rect x={0} y={BASE} width={width} height={40} fill="rgb(0 0 0 / 0.22)" />
      {houses.flatMap((h, i) =>
        h.windows
          .filter((w) => w.lit)
          .slice(0, 1)
          .map((w, j) => (
            <rect key={`${i}-${j}`} x={w.x - 6} y={BASE + 8 + ((i * 5) % 18)} width={20} height={2} rx={1} fill="var(--brass)" opacity={0.35} />
          )),
      )}
      <rect x={0} y={BASE} width={width} height={1.5} fill="rgb(255 255 255 / 0.12)" />
    </svg>
  );
}
