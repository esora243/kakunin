import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { ComponentProps } from "react";
import { cx } from "@/components/ui/cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "line";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * すべての操作の見た目とフォーカス設計をここに集約する。
 * - focus-visible リングを内蔵する (以前は 21 ファイル中 3 ファイルにしか無かった)。
 * - どのサイズでも最小タップ領域 44px を満たす。
 * - グラデーション CTA は作らない。主役は 1 画面 1 つ、単色で示す。
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand-500 text-inverse hover:bg-brand-600 active:bg-brand-700 shadow-card",
  secondary: "bg-surface-card text-brand-600 border border-strong hover:bg-brand-50",
  ghost: "bg-transparent text-secondary hover:bg-brand-50 hover:text-brand-600",
  danger: "bg-surface-card text-danger-700 border border-danger-100 hover:bg-danger-50",
  // LINE 緑は LINE 連携の操作にのみ使う。
  line: "bg-line text-inverse hover:bg-line-hover shadow-card",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-tap px-3 text-meta gap-1.5",
  md: "min-h-tap px-4 text-body gap-2",
  lg: "min-h-[3.25rem] px-5 text-body gap-2",
};

export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2";

export function buttonClassName({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return cx(
    "inline-flex items-center justify-center rounded-control font-bold transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-60",
    FOCUS_RING,
    VARIANTS[variant],
    SIZES[size],
    fullWidth && "w-full",
    className,
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: ReactNode;
};

export function Button({ variant, size, fullWidth, className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={buttonClassName({ variant, size, fullWidth, className })} {...rest} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

export function ButtonLink({ variant, size, fullWidth, className, ...rest }: ButtonLinkProps) {
  return <Link className={buttonClassName({ variant, size, fullWidth, className })} {...rest} />;
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** アイコンのみのボタンは必ず読み上げ名を持つ */
  label: string;
  children: ReactNode;
  variant?: "ghost" | "outline";
};

/** アイコンのみの操作。44px のタップ領域とフォーカスリングを強制する。 */
export function IconButton({ label, children, className, variant = "ghost", type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cx(
        "inline-flex min-h-tap min-w-tap items-center justify-center rounded-pill transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-60",
        FOCUS_RING,
        variant === "outline"
          ? "border border-strong text-secondary hover:bg-brand-50 hover:text-brand-600"
          : "text-tertiary hover:bg-brand-50 hover:text-brand-600",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
