"use client";

import { Check } from "lucide-react";
import { useRef } from "react";
import { cx } from "@/components/ui/cx";

export type SelectableOption = { id: string; name: string };

type CommonProps = {
  legend: string;
  description?: string;
  options: SelectableOption[];
  columns?: 1 | 2;
  className?: string;
};

type SingleProps = CommonProps & {
  mode?: "single";
  value: string | null;
  onChange: (id: string) => void;
};

type MultipleProps = CommonProps & {
  mode: "multiple";
  value: string[];
  onChange: (ids: string[]) => void;
};

type OptionSelectorProps = SingleProps | MultipleProps;

/**
 * 選択肢 UI の唯一の実装。
 *
 * - `/register` と `/profile/edit` が同じ 5 項目を別デザインで二重実装していたのを共通化する。
 * - 選択済みの表現は反転 (`bg-brand-500 text-inverse`) の 1 種類に決める。
 * - 単一選択は radiogroup + roving tabindex + 矢印キー、複数選択は checkbox セマンティクス。
 *   以前はどちらも素の <button> の羅列で、読み上げでは選択状態が伝わらなかった。
 */
export function OptionSelector(props: OptionSelectorProps) {
  const { legend, description, options, columns = 1, className } = props;
  const multiple = props.mode === "multiple";
  const selectedIds = multiple ? props.value : props.value === null ? [] : [props.value];
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isSelected = (id: string) => selectedIds.includes(id);

  const toggle = (id: string) => {
    if (props.mode === "multiple") {
      props.onChange(props.value.includes(id) ? props.value.filter((item) => item !== id) : [...props.value, id]);
      return;
    }
    props.onChange(id);
  };

  // radiogroup は矢印キーで移動できることが期待される。
  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>, index: number) => {
    if (multiple) return;
    const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const delta = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + delta + options.length) % options.length;
    const next = options[nextIndex];
    if (!next) return;
    props.onChange(next.id);
    containerRef.current?.querySelectorAll<HTMLButtonElement>("[data-option]")[nextIndex]?.focus();
  };

  // roving tabindex: 未選択なら先頭だけがタブ順に入る
  const activeIndex = options.findIndex((option) => isSelected(option.id));
  const tabbableIndex = activeIndex >= 0 ? activeIndex : 0;

  return (
    <fieldset className={className}>
      <legend className="mb-3 block text-caption font-bold text-secondary">
        {legend}
        {description ? <span className="ml-2 font-medium text-tertiary">{description}</span> : null}
      </legend>
      <div
        ref={containerRef}
        role={multiple ? "group" : "radiogroup"}
        aria-label={legend}
        className={cx("grid gap-2", columns === 2 ? "grid-cols-2" : "grid-cols-1")}
      >
        {options.map((option, index) => {
          const selected = isSelected(option.id);
          return (
            <button
              key={option.id}
              type="button"
              data-option
              role={multiple ? "checkbox" : "radio"}
              aria-checked={selected}
              tabIndex={multiple || index === tabbableIndex ? 0 : -1}
              onClick={() => toggle(option.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cx(
                "flex min-h-tap items-center justify-between gap-2 rounded-control px-3 py-2.5 text-left",
                "text-body font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                selected
                  ? "bg-brand-500 text-inverse shadow-card"
                  : "border border-subtle bg-surface-inset text-secondary hover:bg-brand-50 hover:text-brand-600",
              )}
            >
              <span className="min-w-0">{option.name}</span>
              {selected ? <Check size={16} strokeWidth={3} className="shrink-0" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
