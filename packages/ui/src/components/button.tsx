"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "../lib/utils";

export type ButtonVariant =
  | "default"
  | "brand"
  | "accent"
  | "outline"
  | "secondary"
  | "ghost"
  | "destructive"
  | "link";
export type ButtonSize = "default" | "sm" | "lg" | "icon" | "icon-sm";

const variantClasses: Record<ButtonVariant, string> = {
  default:
    "bg-[#123e30] text-white hover:bg-[#1d6048] dark:bg-[#8cd766] dark:text-[#111815] dark:hover:bg-[#a2e87d]",
  brand:
    "bg-[#123e30] text-white hover:bg-[#1d6048] dark:bg-[#8cd766] dark:text-[#111815] dark:hover:bg-[#a2e87d]",
  accent:
    "bg-[#c9ef75] text-[#19352a] hover:bg-[#d6f694] font-bold shadow-xs",
  outline:
    "border border-border bg-background hover:bg-muted hover:text-foreground text-foreground",
  secondary:
    "border border-border bg-[#f1f3ee] text-[#202b25] hover:bg-[#e6eae2] dark:bg-[#202b26] dark:text-[#f2f5f1] dark:border-[#303c35]",
  ghost: "hover:bg-muted hover:text-foreground text-foreground",
  destructive:
    "bg-red-500/15 text-red-700 dark:text-red-400 font-semibold hover:bg-red-500/25",
  link: "text-primary underline-offset-4 hover:underline p-0 h-auto min-h-0",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-11 min-h-[44px] gap-2 px-4 text-sm",
  sm: "h-9 min-h-[36px] gap-1.5 px-3 text-xs",
  lg: "h-12 min-h-[48px] gap-2.5 px-6 text-base",
  icon: "size-11 min-h-[44px] min-w-[44px]",
  "icon-sm": "size-9 min-h-[36px] min-w-[36px]",
};

export interface ButtonProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "onAnimationStart" | "onDragStart" | "onDragEnd" | "onDrag"
  > {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  children?: ReactNode;
}

/**
 * Button Component (SCRUM-172)
 * Enhanced with Motion / React Bits spring microinteractions:
 * - whileHover: { scale: 1.025, filter: "brightness(1.06)" }
 * - whileTap: { scale: 0.96 }
 * - spring: { stiffness: 450, damping: 17 }
 * - Accessible focus ring meeting WCAG 2.2 Level AA/AAA (> 4.5:1 contrast)
 * - Automatic prefers-reduced-motion fallback
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "default",
      size = "default",
      isLoading = false,
      disabled = false,
      className,
      children,
      type = "button",
      ...rest
    },
    ref
  ) {
    const shouldReduceMotion = useReducedMotion();
    const isLink = variant === "link";
    const isDisabled = disabled || isLoading;

    // React Bits pattern: microinteracciones táctiles suaves con spring
    const hoverAnimation = isDisabled
      ? undefined
      : shouldReduceMotion
        ? { opacity: 0.92 }
        : isLink
          ? { opacity: 0.88 }
          : { scale: 1.025, filter: "brightness(1.05)" };

    const tapAnimation = isDisabled
      ? undefined
      : shouldReduceMotion
        ? { opacity: 0.82 }
        : isLink
          ? { opacity: 0.78 }
          : { scale: 0.96 };

    return (
      <motion.button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-disabled={isDisabled ? "true" : undefined}
        aria-busy={isLoading ? "true" : undefined}
        whileHover={hoverAnimation}
        whileTap={tapAnimation}
        transition={{ type: "spring" as const, stiffness: 450, damping: 17 }}
        className={cn(
          "interactive-button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent font-semibold cursor-pointer select-none transition-colors",
          "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#111815]",
          "disabled:pointer-events-none disabled:opacity-50 disabled:transform-none disabled:cursor-not-allowed motion-reduce:transform-none motion-reduce:transition-none",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...rest}
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>{children}</span>
          </span>
        ) : (
          children
        )}
      </motion.button>
    );
  }
);
Button.displayName = "Button";
