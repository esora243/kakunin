import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { cx } from "@/components/ui/cx";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  /** ユーザーの次の行動だけを書く。開発者への指示・実装予定は書かない。 */
  description?: string;
  action?: ReactNode;
  className?: string;
};

/** データ 0 件の唯一の表現。以前は「立派なカード」と「一行の <p>」が混在していた。 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <Card className={cx("p-8 text-center", className)}>
      <Icon className="mx-auto mb-3 text-brand-200" size={40} aria-hidden="true" />
      <p className="text-lead font-bold text-primary">{title}</p>
      {description ? <p className="mt-2 text-body text-secondary">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </Card>
  );
}
