import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

type ListRowBaseProps = {
  icon?: LucideIcon;
  label: string;
  value?: ReactNode;
  className?: string;
};

type ListRowProps = ListRowBaseProps & {
  /** 遷移先。href も onClick も無い行は「押せない行」として chevron と hover を出さない。 */
  href?: string;
  onClick?: () => void;
};

const ROW_BASE = "flex w-full items-center justify-between gap-3 px-4 py-3 text-left";
const INTERACTIVE =
  "min-h-tap transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500";

function RowBody({ icon: Icon, label, value }: ListRowBaseProps) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      {Icon ? (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-brand-50 text-brand-500">
          <Icon size={16} aria-hidden="true" />
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="block text-caption font-bold text-tertiary">{label}</span>
        {value ? <span className="block truncate text-body font-medium text-primary">{value}</span> : null}
      </span>
    </span>
  );
}

/**
 * 一覧の行。
 * 押せる行だけが chevron と hover を持つ。以前は押せない <div> に
 * `hover:bg-gray-50` と ChevronRight が付いており、押せる行と区別できなかった。
 */
export function ListRow({ href, onClick, className, ...body }: ListRowProps) {
  if (href) {
    return (
      <Link href={href} prefetch={false} className={cx(ROW_BASE, INTERACTIVE, className)}>
        <RowBody {...body} />
        <ChevronRight size={16} className="shrink-0 text-tertiary" aria-hidden="true" />
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cx(ROW_BASE, INTERACTIVE, className)}>
        <RowBody {...body} />
        <ChevronRight size={16} className="shrink-0 text-tertiary" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className={cx(ROW_BASE, className)}>
      <RowBody {...body} />
    </div>
  );
}
