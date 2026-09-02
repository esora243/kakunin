import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { cx } from "./cn";
import { Button } from "./Button";

type FilterBarProps = {
  children: ReactNode;
  clearHref?: string;
  className?: string;
};

// GET filter form wrapper. Never rename the query params rendered by callers.
export function FilterBar({ children, clearHref, className }: FilterBarProps) {
  return (
    <form
      method="get"
      className={cx("mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-stone-200 bg-white p-4", className)}
    >
      {children}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" size="sm">
          適用
        </Button>
        {clearHref ? (
          <a
            href={clearHref}
            className="text-sm text-stone-500 underline decoration-stone-300 hover:text-orange-700 hover:decoration-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
          >
            クリア
          </a>
        ) : null}
      </div>
    </form>
  );
}

type SearchInputProps = {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  label?: string;
  className?: string;
};

export function SearchInput({ name, defaultValue, placeholder, label, className }: SearchInputProps) {
  return (
    <label className={cx("flex flex-col gap-1 text-sm", className)}>
      {label ? <span className="text-[11px] font-medium uppercase tracking-wider text-stone-400">{label}</span> : null}
      <span className="relative block">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden="true" />
        <input
          type="search"
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="w-full rounded-md border border-stone-300 py-1.5 pl-8 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
        />
      </span>
    </label>
  );
}

type SelectFieldOption = { value: string; label: string };

type SelectFieldProps = {
  name: string;
  defaultValue?: string;
  options: SelectFieldOption[];
  label?: string;
  className?: string;
};

export function SelectField({ name, defaultValue, options, label, className }: SelectFieldProps) {
  return (
    <label className={cx("flex flex-col gap-1 text-sm", className)}>
      {label ? <span className="text-[11px] font-medium uppercase tracking-wider text-stone-400">{label}</span> : null}
      <select
        name={name}
        defaultValue={defaultValue}
        className="rounded-md border border-stone-300 py-1.5 pl-3 pr-8 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
