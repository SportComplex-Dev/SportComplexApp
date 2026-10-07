import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils";

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "admin";

const badgeVariantClasses: Record<BadgeVariant, string> = {
  default: "bg-[#123e30] text-white hover:bg-[#123e30]/80",
  secondary: "bg-[#f1f3ee] text-[#202b25] dark:bg-[#202b26] dark:text-[#f2f5f1]",
  destructive: "bg-red-500/15 text-red-600 hover:bg-red-500/25",
  outline: "border border-border text-foreground",
  success: "border border-[#5e8b48]/20 bg-[#edf5e2] text-[#4b7652] dark:border-[#9ee285]/30 dark:bg-[#1f3524] dark:text-[#9ee285]",
  warning: "border border-[#d5ae4e]/20 bg-[#fbf4df] text-[#947838] dark:border-[#edd67d]/30 dark:bg-[#38311b] dark:text-[#edd67d]",
  admin: "rounded-md bg-[#f0f3ed] px-2 py-0.5 text-[11px] font-extrabold tracking-wider text-[#738176] dark:bg-[#24332a] dark:text-[#9bb684]",
};

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
        badgeVariantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
