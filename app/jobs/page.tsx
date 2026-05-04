"use client";

import { useEffect, useMemo, useState } from "react";
import { Filter, Search, MapPin, JapaneseYen, Clock, X, Briefcase, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthContext";
import { JobFilterModal } from "@/components/JobFilterModal";
import { SaveButton } from "@/components/SaveButton";
import { useSavedItems } from "@/components/SavedItemsContext";
import type { JobListItemDto, JobsResponse } from "@/lib/job-dto";
import type { FilterOptions } from "@/lib/types";

export default function JobsPage() {
  const { isLoggedIn, openLoginModal } = useAuth();
  const { isSaved, toggleSaved } = useSavedItems();
  const [jobs, setJobs] = useState<JobListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("すべて");
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    employmentType: [],
    jobType: [],
    prefecture: [],
    salaryMin: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadJobs() {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await fetch("/api/jobs", { cache: "no-store" });
        const data = (await response.json()) as JobsResponse | { ok: false; error?: { message?: string } };
        if (!response.ok || !data.ok) {
          throw new Error(data.ok ? "求人の取得に失敗しました" : data.error?.message ?? "求人の取得に失敗しました");
        }
        if (!cancelled) setJobs(data.items);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "求人の取得に失敗しました");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadJobs();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => ["すべて", ...Array.from(new Set(jobs.map((job) => job.category.name)))], [jobs]);

  const filteredJobs = jobs.filter((job) => {
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      const searchableText = [job.title, job.companyName, job.location, job.category.name].filter(Boolean).join(" ").toLowerCase();
      if (!searchableText.includes(query)) return false;
    }
    if (activeTab !== "すべて" && job.category.name !== activeTab) return false;
    if (filters.employmentType.length > 0 && !filters.employmentType.includes(job.employmentType.name)) return false;
    if (filters.jobType.length > 0 && !filters.jobType.includes(job.category.name)) return false;
    if (filters.prefecture.length > 0 && (!job.prefecture || !filters.prefecture.includes(job.prefecture))) return false;
    if (filters.salaryMin && (job.salaryMin ?? 0) < Number(filters.salaryMin)) return false;
    return true;
  });

  const activeFilterCount =
    filters.employmentType.length + filters.jobType.length + filters.prefecture.length + (filters.salaryMin ? 1 : 0);

  const clearFilters = () => {
    setFilters({ employmentType: [], jobType: [], prefecture: [], salaryMin: "" });
  };

  const handleSave = (jobId: string) => {
    if (!isLoggedIn) {
      openLoginModal();
      return;
    }
    const saved = toggleSaved("job", jobId);
    toast.success(saved ? "求人を保存しました" : "保存を解除しました");
  };

  return (
    <div className="w-full max-w-lg mx-auto pb-4 animate-fade-in">
      <div className="sticky top-[10px] z-30 bg-[#FFF9FA]/90 backdrop-blur-md pt-2 pb-3 -mx-4 px-4 border-b border-orange-100">
        <h2 className="text-xl font-bold text-gray-800 mb-3">求人</h2>
        <div className="flex gap-2 mb-3">
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-orange-100 p-2.5 flex items-center gap-2">
            <Search className="text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="フリーワードで絞り込み"
              className="bg-transparent border-none outline-none text-sm w-full placeholder:text-gray-300"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            )}
          </div>
          <button
            onClick={() => setIsFilterOpen(true)}
            className="relative bg-orange-50 p-2.5 rounded-xl border border-orange-100 text-orange-500 hover:bg-orange-100 transition-colors"
          >
            <Filter className="w-5 h-5" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex overflow-x-auto gap-2 hide-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === cat ? "bg-orange-500 text-white shadow-sm" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="text-sm text-gray-600 px-4 pt-3">{loading ? "求人を読み込み中..." : `${filteredJobs.length}件の求人が見つかりました`}</div>

      <div className="space-y-4 px-4 pb-8">
        {loading ? (
          <div className="bg-white rounded-2xl border border-orange-100 p-8 text-center mt-4">
            <Loader2 className="mx-auto text-orange-300 mb-3 animate-spin" size={36} />
            <p className="text-sm text-gray-500">求人を読み込んでいます</p>
          </div>
        ) : loadError ? (
          <div className="bg-white rounded-2xl border border-orange-100 p-8 text-center mt-4">
            <Briefcase className="mx-auto text-orange-200 mb-3" size={40} />
            <p className="text-gray-700 font-bold mb-2">求人を取得できませんでした</p>
            <p className="text-sm text-gray-500">{loadError}</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-orange-100 p-8 text-center mt-4">
            <Briefcase className="mx-auto text-orange-200 mb-3" size={40} />
            <p className="text-gray-700 font-bold mb-2">公開中の求人はまだありません</p>
            <p className="text-sm text-gray-500 mb-4">条件を変えるか、dev seed の求人データを確認してください。</p>
            {activeFilterCount > 0 || searchQuery ? (
              <button onClick={clearFilters} className="text-orange-500 font-bold hover:text-orange-600">
                絞り込みをクリア
              </button>
            ) : null}
          </div>
        ) : (
          filteredJobs.map((job) => (
            <div key={job.id} className="bg-white p-4 rounded-2xl shadow-sm border border-orange-50 relative hover:shadow-md transition-all group">
              <SaveButton compact saved={isSaved("job", job.id)} onClick={() => handleSave(job.id)} />

              <div className="flex gap-2 mb-2 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-orange-100 text-orange-600 rounded">{job.category.name}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded">{job.employmentType.name}</span>
                {job.requirements && <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded">{job.requirements}</span>}
              </div>

              <h4 className="font-bold text-gray-800 leading-snug pr-8 mb-3 group-hover:text-orange-600 transition-colors">{job.title}</h4>
              {job.summary ? <p className="text-xs text-gray-500 mb-3 line-clamp-2">{job.summary}</p> : null}

              <div className="space-y-1.5 text-xs text-gray-600 mb-4 bg-gray-50/50 p-3 rounded-xl border border-gray-50">
                <div className="flex items-center gap-1.5"><MapPin size={14} className="text-orange-400 shrink-0" /> {job.location ?? "未設定"}</div>
                <div className="flex items-center gap-1.5"><JapaneseYen size={14} className="text-orange-400 shrink-0" /> {job.salaryDisplay ?? "未設定"}</div>
                <div className="flex items-center gap-1.5"><Clock size={14} className="text-orange-400 shrink-0" /> {job.schedule ?? "未設定"}</div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-gray-500 min-w-0">
                  <div className="w-5 h-5 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center font-bold text-[10px] shrink-0">{job.companyType ?? "求"}</div>
                  <span className="line-clamp-1">{job.companyName ?? "会社名未設定"}</span>
                </div>
                <Link
                  href={`/jobs/${job.slug}`}
                  className="bg-gradient-to-r from-orange-400 to-orange-500 text-white text-xs font-bold px-5 py-2 rounded-full shadow-sm hover:shadow-md hover:from-orange-500 hover:to-orange-600 transition-all active:scale-95 shrink-0"
                >
                  詳細を見る
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      <JobFilterModal isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} filters={filters} onApplyFilters={setFilters} />
    </div>
  );
}
