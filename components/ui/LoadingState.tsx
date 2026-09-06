import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cx } from "@/components/ui/cx";

type LoadingStateProps = {
  label?: string;
  className?: string;
};

/**
 * 読み込み中の唯一の表現。
 * 空の <div> を返して白画面を一瞬出す実装 (体感品質を最も落とす) を全廃するための受け皿。
 */
export function LoadingState({ label = "読み込んでいます", className }: LoadingStateProps) {
  return (
    <Card className={cx("p-8 text-center", className)}>
      <Loader2 className="mx-auto mb-3 animate-spin text-brand-300" size={40} aria-hidden="true" />
      <p role="status" className="text-body font-bold text-primary">
        {label}
      </p>
    </Card>
  );
}
