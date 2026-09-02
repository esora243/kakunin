import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { cx } from "@/components/ui/cx";

type PageHeaderProps = {
  /** 各ルートの h1。1 ページに 1 つだけ、サイズは text-h1 (24px) で固定する。 */
  title: string;
  description?: string;
  /** 右上の操作 (IconButton など) */
  actions?: ReactNode;
  /** 見出し直下に置く検索・フィルタなど */
  children?: ReactNode;
  sticky?: boolean;
  className?: string;
};

/**
 * ページタイトルの唯一の実装。
 * - h1 を必ず 1 つ出す (以前は 5 ルート中 3 ルートに h1 が無かった)。
 * - 帯は全幅の白、内容は Container で揃える。desktop でヘッダーだけ
 *   中央 480px の白い短冊に見える問題を解消する。
 */
export function PageHeader({ title, description, actions, children, sticky = false, className }: PageHeaderProps) {
  return (
    <header
      className={cx(
        "border-b border-subtle bg-surface-card",
        sticky && "sticky top-sticky z-30",
        className,
      )}
    >
      <Container className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-h1 font-bold text-primary">{title}</h1>
            {description ? <p className="mt-1 text-body text-secondary">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
        {children ? <div className="mt-4 space-y-3">{children}</div> : null}
      </Container>
    </header>
  );
}
