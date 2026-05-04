"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import type { FilterOptions } from "@/lib/types";

type JobFilterModalProps = {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterOptions;
  onApplyFilters: (filters: FilterOptions) => void;
};

const employmentTypes = ["アルバイト", "正社員", "契約社員", "インターン", "業務委託"];
const jobTypes = ["家庭教師", "学習塾", "医療系インターン", "IT系インターン", "飲食", "その他"];
const prefectures = ["東京都", "神奈川県", "千葉県", "埼玉県", "大阪府", "京都府", "愛知県", "福岡県", "オンライン"];

export function JobFilterModal({ isOpen, onClose, filters, onApplyFilters }: JobFilterModalProps) {
  const [localFilters, setLocalFilters] = useState<FilterOptions>(filters);

  const toggleFilter = (category: keyof FilterOptions, value: string) => {
    if (category === "salaryMin") {
      setLocalFilters((prev) => ({ ...prev, salaryMin: value }));
      return;
    }
    setLocalFilters((prev) => ({
      ...prev,
      [category]: (prev[category] as string[]).includes(value)
        ? (prev[category] as string[]).filter((v) => v !== value)
        : [...(prev[category] as string[]), value],
    }));
  };

  const handleApply = () => {
    onApplyFilters(localFilters);
    onClose();
  };

  const handleReset = () => {
    setLocalFilters({ employmentType: [], jobType: [], prefecture: [], salaryMin: "" });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center animate-fade-in">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-slide-in-bottom">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-800">絞り込み検索</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <FilterSection title="雇用形態" items={employmentTypes} selected={localFilters.employmentType} onToggle={(v) => toggleFilter("employmentType", v)} />
          <FilterSection title="業種" items={jobTypes} selected={localFilters.jobType} onToggle={(v) => toggleFilter("jobType", v)} />
          <FilterSection title="勤務地" items={prefectures} selected={localFilters.prefecture} onToggle={(v) => toggleFilter("prefecture", v)} />
          <div>
            <h4 className="text-sm font-bold text-gray-700 mb-3">最低時給</h4>
            <select
              value={localFilters.salaryMin}
              onChange={(e) => toggleFilter("salaryMin", e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="">指定なし</option>
              <option value="1000">1,000円以上</option>
              <option value="1500">1,500円以上</option>
              <option value="2000">2,000円以上</option>
              <option value="2500">2,500円以上</option>
              <option value="3000">3,000円以上</option>
            </select>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex gap-3">
          <button onClick={handleReset} className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-bold hover:bg-gray-50 transition-colors">リセット</button>
          <button onClick={handleApply} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-400 to-pink-500 text-white font-bold shadow-md hover:shadow-lg transition-all">適用する</button>
        </div>
      </div>
    </div>
  );
}

// 重複するフィルターセクションを共通コンポーネント化
function FilterSection({ title, items, selected, onToggle }: { title: string; items: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div>
      <h4 className="text-sm font-bold text-gray-700 mb-3">{title}</h4>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item}
            onClick={() => onToggle(item)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selected.includes(item) ? "bg-pink-500 text-white shadow-md" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
