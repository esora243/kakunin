import type { ReactNode } from "react";
import { Circle } from "lucide-react";
import { cx } from "./cn";

export type StatusBadgeVariant = "success" | "info" | "warning" | "danger" | "neutral" | "muted";

const STATUS_STYLES: Record<StatusBadgeVariant, { badge: string; dot: string }> = {
  success: { badge: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "text-emerald-500" },
  info: { badge: "border-sky-200 bg-sky-50 text-sky-700", dot: "text-sky-500" },
  warning: { badge: "border-amber-200 bg-amber-50 text-amber-700", dot: "text-amber-500" },
  danger: { badge: "border-red-200 bg-red-50 text-red-700", dot: "text-red-500" },
  neutral: { badge: "border-stone-200 bg-stone-100 text-stone-600", dot: "text-stone-400" },
  muted: { badge: "border-stone-200 bg-stone-200 text-stone-500", dot: "text-stone-400" },
};

type StatusBadgeProps = {
  variant: StatusBadgeVariant;
  children: ReactNode;
};

export function StatusBadge({ variant, children }: StatusBadgeProps) {
  const styles = STATUS_STYLES[variant];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium", styles.badge)}>
      <Circle size={6} className={cx("shrink-0 fill-current", styles.dot)} aria-hidden="true" />
      {children}
    </span>
  );
}
