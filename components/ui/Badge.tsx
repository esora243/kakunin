import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

export type BadgeTone = "brand" | "neutral" | "success" | "warning" | "danger" | "info";

const TONES: Record<BadgeTone, string> = {
  brand: "bg-brand-100 text-brand-600",
  neutral: "bg-surface-inset text-secondary",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-700",
  info: "bg-info-50 text-info-700",
};

/** ラベル用の小バッジ。装飾目的で任意の色を直接当てないための受け皿。 */
export function Badge({
  tone = "brand",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cx("inline-flex items-center rounded-badge px-2 py-0.5 text-micro font-bold", TONES[tone], className)}>
      {children}
    </span>
  );
}
