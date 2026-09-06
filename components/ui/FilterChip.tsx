"use client";

import type { ReactNode } from "react";
import { FOCUS_RING } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";

type FilterChipProps = {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
};

/**
 * 絞り込み chip の唯一の実装。
 * 以前は 5 種類 (角丸長方形 / ピル 2 サイズ / 大きい角丸 / 大きいピル) に発散し、
 * 非選択時の文字色も画面ごとに違っていた。
 */
export function FilterChip({ selected, onClick, children, className }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-4",
        "min-h-tap text-body font-medium transition-colors",
        FOCUS_RING,
        selected
          ? "bg-brand-500 text-inverse shadow-card"
          : "bg-surface-inset text-secondary hover:bg-brand-100 hover:text-brand-600",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * chip の横スクロール行。Container の gutter までブリードさせ、
 * 最後の chip が画面端で不自然に切れないようにする。
 */
export function FilterChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="-mx-gutter flex gap-2 overflow-x-auto px-gutter pb-0.5 hide-scrollbar"
    >
      {children}
    </div>
  );
}
