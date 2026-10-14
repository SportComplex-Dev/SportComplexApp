import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils";

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "admin";

const badgeVariantClasses: Record<BadgeVariant, string> = {
  default: "bg-[#123e30] text-white dark:bg-[#8cd766] dark:text-[#111815]",
  secondary: "bg-[#f1f3ee] text-[#202b25] dark:bg-[#202b26] dark:text-[#f2f5f1]",
  destructive: "bg-red-500/15 text-red-600 dark:bg-red-500/20 dark:text-red-400",
  outline: "border border-border text-foreground",
  success: "border border-[#5e8b48]/20 bg-[#edf5e2] text-[#4b7652] dark:border-[#9ee285]/30 dark:bg-[#1f3524] dark:text-[#9ee285]",
  warning: "border border-[#d5ae4e]/20 bg-[#fbf4df] text-[#947838] dark:border-[#edd67d]/30 dark:bg-[#38311b] dark:text-[#edd67d]",
  admin: "rounded-md bg-[#f0f3ed] px-2 py-0.5 text-[11px] font-extrabold tracking-wider text-[#738176] dark:bg-[#24332a] dark:text-[#9bb684]",
};

const badgeInteractiveClasses: Record<BadgeVariant, string> = {
  default: "hover:bg-[#1d6048] dark:hover:bg-[#a2e87d]",
  secondary: "hover:bg-[#e6eae2] dark:hover:bg-[#2c3d31]",
  destructive: "hover:bg-red-500/25 dark:hover:bg-red-500/30",
  outline: "hover:bg-muted hover:text-foreground",
  success: "hover:bg-[#e2eed4] dark:hover:bg-[#28442e]",
  warning: "hover:bg-[#f5eac7] dark:hover:bg-[#473e22]",
  admin: "hover:bg-[#e5ebe1] dark:hover:bg-[#2f4237]",
};

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
  interactive?: boolean;
}

export function Badge({ className, variant = "default", interactive = false, ...props }: BadgeProps) {
  return (
    <div
      data-slot="badge"
      data-interactive={interactive ? "true" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors duration-150",
        badgeVariantClasses[variant],
        interactive &&
          `interactive-badge cursor-pointer select-none transition-all duration-150 ease-out hover:-translate-y-0.5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6048] dark:focus-visible:ring-[#8cd766] focus-visible:ring-offset-1 motion-reduce:transform-none motion-reduce:transition-none ${badgeInteractiveClasses[variant]}`,
        className,
      )}
      {...props}
    />
  );
}
