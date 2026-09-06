"use client";

import { BookmarkCheck, BookmarkPlus } from "lucide-react";
import { cx } from "@/components/ui/cx";

type SaveButtonProps = {
  saved: boolean;
  onClick: () => void;
  /** アイコンのみの小型表示。配置は呼び出し側が決める (自前で absolute しない)。 */
  compact?: boolean;
  className?: string;
};

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2";

export function SaveButton({ saved, onClick, compact = false, className }: SaveButtonProps) {
  const label = saved ? "保存済みから外す" : "保存する";

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={saved}
        className={cx(
          "inline-flex min-h-tap min-w-tap items-center justify-center rounded-pill transition-colors",
          FOCUS,
          saved ? "text-brand-500" : "text-brand-200 hover:text-brand-500",
          className,
        )}
      >
        {saved ? (
          <BookmarkCheck size={22} strokeWidth={1.8} aria-hidden="true" />
        ) : (
          <BookmarkPlus size={22} strokeWidth={1.5} aria-hidden="true" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={saved}
      className={cx(
        "flex w-16 shrink-0 flex-col items-center justify-center rounded-control border py-2 transition-colors",
        FOCUS,
        saved
          ? "border-brand-500 bg-brand-500 text-inverse"
          : "border-subtle bg-brand-50 text-brand-500 hover:bg-brand-100",
        className,
      )}
    >
      {saved ? (
        <BookmarkCheck size={20} className="mb-0.5" aria-hidden="true" />
      ) : (
        <BookmarkPlus size={20} className="mb-0.5" aria-hidden="true" />
      )}
      <span className="text-micro font-bold">{saved ? "保存済み" : "保存"}</span>
    </button>
  );
}
