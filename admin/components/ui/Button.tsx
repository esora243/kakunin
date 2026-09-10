import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-orange-600 text-white hover:bg-orange-700",
  secondary: "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-stone-600 hover:bg-stone-100",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3.5 py-2 text-sm",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md"): string {
  return cx(
    "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 disabled:cursor-not-allowed disabled:opacity-50",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return <button className={cx(buttonClasses(variant, size), className)} {...props} />;
}
