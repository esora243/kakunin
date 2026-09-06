"use client";

import { useId } from "react";
import { cx } from "@/components/ui/cx";

type ToggleProps = {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

/** 通知設定などの ON/OFF。ブラウザ既定チェックボックスの見た目を置き換える。 */
export function Toggle({ label, description, checked, onChange, disabled = false }: ToggleProps) {
  const labelId = useId();

  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="min-w-0">
        <span id={labelId} className="block text-body font-medium text-primary">
          {label}
        </span>
        {description ? <span className="mt-0.5 block text-caption text-tertiary">{description}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-pill transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-60",
          checked ? "bg-brand-500" : "bg-brand-200",
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            "inline-block h-5 w-5 transform rounded-pill bg-surface-card shadow-card transition-transform",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </button>
    </div>
  );
}

type NumberFieldProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  unit?: string;
};

/** 数値入力。素の `border rounded p-1 w-20` を置き換える。 */
export function NumberField({ label, value, onChange, min = 0, max = 1440, unit }: NumberFieldProps) {
  const inputId = useId();

  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <label htmlFor={inputId} className="text-body font-medium text-primary">
        {label}
      </label>
      <span className="flex shrink-0 items-center gap-2">
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-h-tap w-20 rounded-control border border-subtle bg-surface-card px-3 text-right text-body text-primary focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
        />
        {unit ? <span className="text-body text-secondary">{unit}</span> : null}
      </span>
    </div>
  );
}
