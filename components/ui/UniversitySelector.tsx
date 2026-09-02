"use client";

import { useMemo, useState } from "react";
import { OptionSelector } from "@/components/ui/OptionSelector";
import { SearchInput } from "@/components/ui/SearchInput";
import type { ProfileOptionsDto } from "@/lib/auth/types";
import { filterUniversityOptions, listUniversityPrefectures } from "@/lib/university-options";

type UniversitySelectorProps = {
  universities: ProfileOptionsDto["universities"];
  value: string | null;
  onChange: (id: string) => void;
};

export function UniversitySelector({ universities, value, onChange }: UniversitySelectorProps) {
  const [query, setQuery] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const prefectures = useMemo(() => listUniversityPrefectures(universities), [universities]);
  const visibleUniversities = useMemo(
    () => filterUniversityOptions(universities, { query, prefecture }),
    [prefecture, query, universities],
  );
  const selected = universities.find((university) => university.id === value) ?? null;

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-3 text-caption font-bold text-secondary">大学名</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <SearchInput
            label="大学名で検索"
            value={query}
            onChange={setQuery}
            placeholder="大学名を入力"
            clearLabel="大学名検索をクリア"
          />
          <label className="block">
            <span className="sr-only">都道府県で絞り込み</span>
            <select
              value={prefecture}
              onChange={(event) => setPrefecture(event.target.value)}
              className="min-h-tap w-full rounded-control border border-subtle bg-surface-card px-3 text-body text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
            >
              <option value="">すべての都道府県</option>
              {prefectures.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {selected ? (
        <p className="rounded-control bg-brand-50 px-3 py-2 text-caption font-medium text-brand-700" aria-live="polite">
          選択中：{selected.name}
        </p>
      ) : null}

      {visibleUniversities.length > 0 ? (
        <div className="max-h-80 overflow-y-auto pr-1">
          <OptionSelector
            legend="検索結果"
            options={visibleUniversities}
            value={value}
            onChange={onChange}
          />
        </div>
      ) : (
        <p className="rounded-control border border-subtle bg-surface-inset px-3 py-6 text-center text-body text-secondary" role="status">
          条件に一致する大学はありません
        </p>
      )}
    </div>
  );
}

