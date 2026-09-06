import type { ElementType, ReactNode } from "react";
import { cx } from "@/components/ui/cx";

type CardProps = {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  /** ホバーで浮かせる (一覧カードなど、全体が導線になっている場合のみ) */
  interactive?: boolean;
};

/**
 * コンテンツ面の唯一の定義。
 * 以前は `border` / `border-brand-50` / `border-brand-100` / `border-brand-light` が
 * 混在し、ルートを移動するとカードの質感が変わっていた。
 */
export function Card({ as: Component = "div", className, children, interactive = false }: CardProps) {
  return (
    <Component
      className={cx(
        "rounded-card border border-subtle bg-surface-card shadow-card",
        interactive && "transition-shadow hover:shadow-raised",
        className,
      )}
    >
      {children}
    </Component>
  );
}
