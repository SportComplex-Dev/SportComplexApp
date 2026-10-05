import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/utils";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "outline" };

export function Button({ variant = "default", className, ...rest }: Props) {
  return (
    <button
      className={cn(
        "rounded-md px-4 py-2 text-sm font-medium",
        variant === "default" ? "bg-black text-white" : "border border-black",
        className,
      )}
      {...rest}
    />
  );
}
