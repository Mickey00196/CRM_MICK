import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-[15px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-fg shadow-[0_1px_2px_rgb(0_0_0/0.12)] hover:bg-accent-hover",
        accent: "bg-accent text-accent-fg shadow-[0_1px_2px_rgb(0_0_0/0.12)] hover:bg-accent-hover",
        outline: "border border-line-strong bg-surface text-fg shadow-[var(--shadow-card)] hover:bg-subtle [&_svg]:text-muted",
        ghost: "text-muted hover:bg-subtle hover:text-fg",
        link: "px-0 text-fg underline-offset-4 hover:underline",
        danger: "text-late-text hover:bg-late-soft",
      },
      size: {
        default: "h-8 px-3",
        sm: "h-7 px-2.5 text-[12.5px]",
        xs: "h-7 px-2 text-[12.5px]",
        icon: "size-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = "Button";
