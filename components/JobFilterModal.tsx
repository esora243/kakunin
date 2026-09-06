"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FilterChip } from "@/components/ui/FilterChip";
import { Modal } from "@/components/ui/Modal";
import type { FilterOptions } from "@/lib/types";

/** 一覧の実データから導出した選択肢。静的なハードコード配列は使わない。 */
export type JobFacets = {
  employmentTypes: string[];
  jobTypes: string[];
  prefectures: string[];
};

type JobFilterModalProps = {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterOptions;
  onApplyFilters: (filters: FilterOptions) => void;
  facets: JobFacets;
};

const EMPTY_FILTERS: FilterOptions = { employmentType: [], jobType: [], prefecture: [], salaryMin: "" };

const SALARY_TIERS = [
  { value: "1000", label: "1,000円以上" },
  { value: "1500", label: "1,500円以上" },
  { value: "2000", label: "2,000円以上" },
  { value: "2500", label: "2,500円以上" },
  { value: "3000", label: "3,000円以上" },
];

export function JobFilterModal({ isOpen, onClose, filters, onApplyFilters, facets }: JobFilterModalProps) {
  const [localFilters, setLocalFilters] = useState<FilterOptions>(filters);
  const salaryId = useId();

  // 開くたびに現在の適用条件へ同期する (閉じて開き直すと前回の未適用状態が残っていた)。
  useEffect(() => {
    if (isOpen) setLocalFilters(filters);
  }, [isOpen, filters]);

  const toggleFilter = (category: "employmentType" | "jobType" | "prefecture", value: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      [category]: prev[category].includes(value)
        ? prev[category].filter((item) => item !== value)
        : [...prev[category], value],
    }));
  };

  const handleApply = () => {
    onApplyFilters(localFilters);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="絞り込み検索"
      closeLabel="絞り込み検索を閉じる"
      variant="sheet"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => setLocalFilters(EMPTY_FILTERS)}>
            リセット
          </Button>
          <Button variant="primary" fullWidth onClick={handleApply}>
            適用する
          </Button>
        </div>
      }
    >
      <div className="space-y-6 p-4">
        <FilterSection
          title="雇用形態"
          items={facets.employmentTypes}
          selected={localFilters.employmentType}
          onToggle={(value) => toggleFilter("employmentType", value)}
        />
        <FilterSection
          title="業種"
          items={facets.jobTypes}
          selected={localFilters.jobType}
          onToggle={(value) => toggleFilter("jobType", value)}
        />
        <FilterSection
          title="勤務地"
          items={facets.prefectures}
          selected={localFilters.prefecture}
          onToggle={(value) => toggleFilter("prefecture", value)}
        />

        <div>
          <label htmlFor={salaryId} className="mb-3 block text-body font-bold text-secondary">
            最低時給
          </label>
          <select
            id={salaryId}
            value={localFilters.salaryMin}
            onChange={(event) => setLocalFilters((prev) => ({ ...prev, salaryMin: event.target.value }))}
            className="min-h-tap w-full rounded-control border border-subtle bg-surface-card px-4 text-body text-primary focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
          >
            <option value="">指定なし</option>
            {SALARY_TIERS.map((tier) => (
              <option key={tier.value} value={tier.value}>
                {tier.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}

function FilterSection({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  // 実データに存在しない条件は出さない (選ぶと必ず 0 件になる組み合わせを作らない)。
  if (items.length === 0) return null;

  return (
    <fieldset>
      <legend className="mb-3 block text-body font-bold text-secondary">{title}</legend>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <FilterChip key={item} selected={selected.includes(item)} onClick={() => onToggle(item)}>
            {item}
          </FilterChip>
        ))}
      </div>
    </fieldset>
  );
}
