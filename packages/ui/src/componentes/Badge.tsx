"use client";

import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "../lib/utils";

export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "admin";

const badgeVariantClasses: Record<BadgeVariant, string> = {
  default: "bg-[#123e30] text-white dark:bg-[#8cd766] dark:text-[#111815]",
  secondary:
    "bg-[#f1f3ee] text-[#202b25] dark:bg-[#202b26] dark:text-[#f2f5f1]",
  destructive:
    "bg-red-500/15 text-red-700 dark:text-red-400 font-semibold",
  outline: "border border-border text-foreground",
  success:
    "border border-[#5e8b48]/20 bg-[#edf5e2] text-[#4b7652] dark:border-[#9ee285]/30 dark:bg-[#1f3524] dark:text-[#9ee285]",
  warning:
    "border border-[#d5ae4e]/20 bg-[#fbf4df] text-[#947838] dark:border-[#edd67d]/30 dark:bg-[#38311b] dark:text-[#edd67d]",
  admin:
    "rounded-md bg-[#f0f3ed] px-2 py-0.5 text-[11px] font-extrabold tracking-wider text-[#738176] dark:bg-[#24332a] dark:text-[#9bb684]",
};

export interface BadgeProps
  extends Omit<
    HTMLAttributes<HTMLDivElement>,
    "onAnimationStart" | "onDragStart" | "onDragEnd" | "onDrag"
  > {
  variant?: BadgeVariant;
  interactive?: boolean;
  isLive?: boolean;
  pulse?: boolean;
  isSelected?: boolean;
}

/**
 * Badge Component (SCRUM-172)
 */
export const Badge = forwardRef<HTMLDivElement, BadgeProps>(function Badge(
  {
    className,
    variant = "default",
    interactive = false,
    isLive = false,
    pulse = false,
    isSelected,
    role,
    tabIndex,
    onKeyDown,
    children,
    ...props
  },
  ref
) {
  const shouldReduceMotion = useReducedMotion();
  const isClickable = interactive || Boolean(props.onClick);
  const showPulse = isLive || pulse;

  const hoverMotion =
    isClickable && !shouldReduceMotion
      ? { scale: 1.06, transition: { type: "spring" as const, stiffness: 450, damping: 20 } }
      : undefined;

  const tapMotion =
    isClickable && !shouldReduceMotion
      ? { scale: 0.95, transition: { type: "spring" as const, stiffness: 450, damping: 20 } }
      : undefined;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isClickable && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      (e.currentTarget as HTMLElement).click();
    }
    onKeyDown?.(e);
  };

  const resolvedRole =
    role ?? (showPulse ? "status" : isClickable ? "button" : undefined);

  return (
    <motion.div
      ref={ref}
      data-slot="badge"
      data-interactive={isClickable ? "true" : undefined}
      role={resolvedRole}
      aria-live={showPulse ? "polite" : undefined}
      aria-pressed={
        isClickable && typeof isSelected === "boolean" ? isSelected : undefined
      }
      tabIndex={tabIndex ?? (isClickable ? 0 : undefined)}
      onKeyDown={handleKeyDown}
      whileHover={hoverMotion}
      whileTap={tapMotion}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors duration-150 select-none",
        badgeVariantClasses[variant],
        showPulse && !shouldReduceMotion && "animate-pulse",
        isClickable &&
          "interactive-badge cursor-pointer hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 motion-reduce:transform-none motion-reduce:transition-none",
        className
      )}
      {...props}
    >
      {showPulse && (
        <span
          className="inline-block size-1.5 rounded-full bg-current opacity-85"
          aria-hidden="true"
        />
      )}
      {children}
    </motion.div>
  );
});
Badge.displayName = "Badge";
