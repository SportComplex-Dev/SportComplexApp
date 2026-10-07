import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/utils";

export type ButtonVariant = "default" | "brand" | "accent" | "outline" | "secondary" | "ghost" | "destructive" | "link";
export type ButtonSize = "default" | "sm" | "lg" | "icon" | "icon-sm";

const variantClasses: Record<ButtonVariant, string> = {
  default: "bg-[#123e30] text-white hover:bg-[#1d6048] dark:bg-[#8cd766] dark:text-[#111815] dark:hover:bg-[#a2e87d]",
  brand: "bg-[#123e30] text-white hover:bg-[#1d6048] dark:bg-[#8cd766] dark:text-[#111815] dark:hover:bg-[#a2e87d]",
  accent: "bg-[#c9ef75] text-[#19352a] hover:bg-[#d6f694] font-bold shadow-xs",
  outline: "border border-border bg-background hover:bg-muted hover:text-foreground",
  secondary: "border border-border bg-[#f1f3ee] text-[#202b25] hover:bg-[#e6eae2] dark:bg-[#202b26] dark:text-[#f2f5f1] dark:border-[#303c35]",
  ghost: "hover:bg-muted hover:text-foreground",
  destructive: "bg-red-500/15 text-red-600 hover:bg-red-500/25",
  link: "text-primary underline-offset-4 hover:underline p-0 h-auto min-h-0",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-11 min-h-[44px] gap-2 px-4 text-sm",
  sm: "h-9 min-h-[36px] gap-1.5 px-3 text-xs",
  lg: "h-12 min-h-[48px] gap-2.5 px-6 text-base",
  icon: "size-11 min-h-[44px] min-w-[44px]",
  "icon-sm": "size-9 min-h-[36px] min-w-[36px]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = "default", size = "default", className, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent font-semibold transition-all cursor-pointer disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    />
  );
}
