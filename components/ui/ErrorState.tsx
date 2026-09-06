import { AlertTriangle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { cx } from "@/components/ui/cx";

type ErrorStateProps = {
  title: string;
  /** ユーザー向けの定型文。既定は「次にどうするか」だけを伝える。 */
  description?: string;
  /**
   * API 由来の技術的な文言。開発時のみ表示する。
   * 本番で `error.message` をそのままユーザーに見せない。
   */
  detail?: string | null;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
};

const DEFAULT_DESCRIPTION = "時間をおいて、もう一度お試しください。";

export function ErrorState({
  title,
  description = DEFAULT_DESCRIPTION,
  detail,
  icon: Icon = AlertTriangle,
  action,
  className,
}: ErrorStateProps) {
  const showDetail = process.env.NODE_ENV !== "production" && Boolean(detail);

  return (
    <Card className={cx("border-danger-100 p-8 text-center", className)}>
      <Icon className="mx-auto mb-3 text-danger-500" size={40} aria-hidden="true" />
      <p className="text-lead font-bold text-primary">{title}</p>
      <p className="mt-2 text-body text-secondary">{description}</p>
      {showDetail ? (
        <p className="mt-3 break-words rounded-control bg-danger-50 px-3 py-2 text-caption text-danger-700">{detail}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </Card>
  );
}
