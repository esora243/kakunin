"use client";

import { Search, X } from "lucide-react";
import { useId } from "react";
import { cx } from "@/components/ui/cx";

type SearchInputProps = {
  /** スクリーンリーダー向けの名前。placeholder 依存にしない。 */
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** クリアボタンの読み上げ名 */
  clearLabel?: string;
  className?: string;
};

/**
 * 検索入力の唯一の実装。
 * 以前は 4 種類 (白+境界+影 / gray-50 / gray-50 px-3 / border+focus ring) があり、
 * ラベル・クリア・フォーカスリングの有無も画面ごとにばらついていた。
 */
export function SearchInput({
  label,
  value,
  onChange,
  placeholder,
  clearLabel = "検索キーワードをクリア",
  className,
}: SearchInputProps) {
  const inputId = useId();

  return (
    <div className={className}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <div
        className={cx(
          "flex items-center gap-2 rounded-control border border-subtle bg-surface-card px-3",
          "focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/25",
        )}
      >
        <Search size={18} className="shrink-0 text-tertiary" aria-hidden="true" />
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-h-tap w-full bg-transparent text-body text-primary outline-none placeholder:text-tertiary"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={clearLabel}
            className="-mr-1 inline-flex min-h-tap min-w-tap items-center justify-center rounded-pill text-tertiary transition-colors hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
