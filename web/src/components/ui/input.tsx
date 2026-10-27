import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full min-w-0 rounded-lg border border-line-strong bg-surface px-3 text-sm text-fg placeholder:text-faint transition-colors focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent-soft disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(base, "h-9", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(base, "min-h-20 py-2 leading-relaxed", className)} {...props} />,
);
Textarea.displayName = "Textarea";

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%239a9da1' stroke-width='1.5'/%3E%3C/svg%3E\")";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, style, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(base, "h-9 appearance-none pr-8", className)}
    style={{ backgroundImage: CHEVRON, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", backgroundSize: "10px", ...style }}
    {...props}
  />
));
Select.displayName = "Select";

export function Field({ label, children, className, hint }: { label: string; children: ReactNode; className?: string; hint?: string }) {
  return (
    <label className={cn("grid min-w-0 content-start gap-1.5", className)}>
      <span className="text-[13px] text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </label>
  );
}

/** A row of pill toggles; one value selected. */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "md",
}: {
  options: readonly { key: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} role="group">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-full border px-3 transition-colors",
            size === "sm" ? "h-7 text-[13px]" : "h-8 text-sm",
            value === o.key
              ? "border-accent bg-accent text-accent-fg"
              : "border-line-strong text-muted hover:border-faint hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="text-[13px] text-late">{children}</p>;
}
