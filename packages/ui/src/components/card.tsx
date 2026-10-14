"use client";

import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "../lib/utils";

export interface CardProps
  extends Omit<
    HTMLAttributes<HTMLDivElement>,
    "onAnimationStart" | "onDragStart" | "onDragEnd" | "onDrag"
  > {
  interactive?: boolean;
}

/**
 * Card Component (SCRUM-172)
 * Enhanced with Motion / React Bits physical elevation:
 * - Interactive hover: y: -5, shadow-xl, hover:border-primary/50
 * - Spring curve: { type: "spring", stiffness: 320, damping: 22 }
 * - Accessible keyboard navigation: Enter & Space trigger click
 * - Purely informational cards remain static without deceptive hovers
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    className,
    interactive = false,
    tabIndex,
    role,
    onKeyDown,
    children,
    ...props
  },
  ref
) {
  const shouldReduceMotion = useReducedMotion();
  const isClickable = interactive || Boolean(props.onClick);

  const hoverMotion =
    isClickable && !shouldReduceMotion
      ? { y: -5, transition: { type: "spring" as const, stiffness: 320, damping: 20 } }
      : undefined;

  const tapMotion =
    isClickable && !shouldReduceMotion
      ? {
          scale: 0.98,
          y: -2,
          transition: { type: "spring" as const, stiffness: 400, damping: 25 },
        }
      : undefined;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isClickable && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      (e.currentTarget as HTMLElement).click();
    }
    onKeyDown?.(e);
  };

  return (
    <motion.div
      ref={ref}
      data-slot="card"
      data-interactive={isClickable ? "true" : undefined}
      role={role ?? (isClickable ? "button" : undefined)}
      tabIndex={tabIndex ?? (isClickable ? 0 : undefined)}
      onKeyDown={handleKeyDown}
      whileHover={hoverMotion}
      whileTap={tapMotion}
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground shadow-xs transition-colors",
        isClickable
          ? "interactive-card cursor-pointer hover:shadow-xl hover:shadow-primary/5 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#111815] motion-reduce:transform-none motion-reduce:transition-none"
          : "transition-colors duration-200",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
});
Card.displayName = "Card";

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1.5 p-5", className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      data-slot="card-title"
      className={cn(
        "font-semibold leading-none tracking-tight text-foreground",
        className
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-content"
      className={cn("p-5 pt-0", className)}
      {...props}
    />
  );
}

export function CardFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center p-5 pt-0", className)}
      {...props}
    />
  );
}
