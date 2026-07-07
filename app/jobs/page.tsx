"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Filter,
  Search,
  MapPin,
  JapaneseYen,
  Clock,
  BookmarkPlus,
  X,
  Loader2,
  Briefcase,
  Building2,
} from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";
import { useAuth } from "@/components/AuthContext";
import { AdBanner } from "@/components/AdBanner";
import { JobFilterModal } from "@/components/JobFilterModal";
import type { FilterOptions } from "@/lib/types";

const CATEGORIES = ["すべて", "家庭教師", "塾", "インターン", "その他"];

/**
 * 求人ページ - TestAPP のUI/UXを完全移植したうえで、
 * kakunin の Supabase 連携 (jobs / sponsors テーブル) は保持。
 *
 * 追加要件:
 *   1. スポンサータブは廃止し、本ページ下部に SPONSORS & PARTNERS セクションを表示
 *      → Supabase の sponsors テーブルを使ってティア別 (PLATINUM / GOLD) にリスト表示
 *   2. TestAPP と同じ sticky ヘッダー / 検索 / フィルタ / カテゴリタブ / カードUI を採用
 */
export default function JobsPage() {
  const { openLoginModal } = useAuth();

  // ---- データ取得 ----
  const [jobs, setJobs] = useState<any[]>([]);
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- 絞り込み UI 状態 ----
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("すべて");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    employmentType: [],
    jobType: [],
    prefecture: [],
    salaryMin: "",
  });

  useEffect(() => {
    let cancelled = false;
    async function fetchAll() {
      setLoading(true);
      try {
        const [jobRes, sponsorRes] = await Promise.all([
          supabaseRestFetch<any[]>({ path: "jobs?select=*" }).catch(() => []),
          supabaseRestFetch<any[]>({ path: "sponsors?select=*" }).catch(() => []),
        ]);
        if (!cancelled) {
          setJobs(jobRes || []);
          setSponsors(sponsorRes || []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchAll();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job: any) => {
      // カテゴリタブ
      if (
        activeCategory !== "すべて" &&
        job.category !== activeCategory &&
        !(job.title && job.title.includes(activeCategory))
      ) {
        return false;
      }

      // フリーワード
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const inTitle = job.title?.toLowerCase().includes(q);
        const inCompany = job.company_name?.toLowerCase().includes(q);
        const inPref = job.location_pref?.toLowerCase().includes(q);
        const inTag =
          Array.isArray(job.tags) &&
          job.tags.some((t: string) => t.toLowerCase().includes(q));
        if (!(inTitle || inCompany || inPref || inTag)) return false;
      }

      // 詳細フィルタ
      if (
        filters.employmentType.length > 0 &&
        !filters.employmentType.includes(job.employment_type || job.employmentType || "")
      )
        return false;
      if (
        filters.jobType.length > 0 &&
        !filters.jobType.includes(job.category || job.jobType || "")
      )
        return false;
      if (
        filters.prefecture.length > 0 &&
        !filters.prefecture.includes(job.location_pref || job.prefecture || "")
      )
        return false;
      if (filters.salaryMin) {
        const salaryNum = Number(job.salary ?? job.salary_min ?? 0);
        if (salaryNum && salaryNum < Number(filters.salaryMin)) return false;
      }
      return true;
    });
  }, [jobs, searchQuery, activeCategory, filters]);

  const activeFilterCount =
    filters.employmentType.length +
    filters.jobType.length +
    filters.prefecture.length +
    (filters.salaryMin ? 1 : 0);

  const clearFilters = () =>
    setFilters({
      employmentType: [],
      jobType: [],
      prefecture: [],
      salaryMin: "",
    });

  // ---- スポンサー分類 ----
  const platinumSponsors = sponsors.filter(
    (s) => (s.tier || "").toLowerCase() === "platinum",
  );
  const goldSponsors = sponsors.filter(
    (s) => (s.tier || "").toLowerCase() === "gold",
  );

  return (
    <div className="w-full max-w-lg mx-auto pb-4 animate-slide-in-right">
      {/* ============================================================
          sticky ヘッダー (検索 + フィルタ + カテゴリタブ) - TestAPP 準拠
         ============================================================ */}
      <div className="sticky top-[44px] z-30 bg-[#F2F4F8]/90 backdrop-blur-md pt-2 pb-3 -mx-0 px-4 border-b border-[#B9C2DB]">
        <h2 className="text-xl font-bold text-gray-800 mb-3">求人</h2>
        <div className="flex gap-2 mb-3">
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-[#B9C2DB] p-2.5 flex items-center gap-2">
            <Search className="text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="フリーワードで絞り込み"
              className="bg-transparent border-none outline-none text-sm w-full placeholder:text-gray-300"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-gray-400 hover:text-gray-600"
                aria-label="検索クリア"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            onClick={() => setIsFilterOpen(true)}
            className="relative bg-[#F2F4F8] p-2.5 rounded-xl border border-[#B9C2DB] text-[#1E3A8A] hover:bg-[#B9C2DB]/30 transition-colors"
            aria-label="絞り込み"
          >
            <Filter className="w-5 h-5" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#1E3A8A] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* カテゴリタブ */}
        <div className="flex overflow-x-auto gap-2 hide-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeCategory === cat
                  ? "bg-[#1E3A8A] text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ============================================================
          結果件数
         ============================================================ */}
      <div className="text-sm text-gray-600 px-4 pt-3">
        {loading ? "読み込み中..." : `${filteredJobs.length}件の求人が見つかりました`}
      </div>

      {/* ============================================================
          求人リスト (TestAPP カードUI 準拠)
         ============================================================ */}
      <div className="space-y-4 px-4 pb-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-[#1E3A8A] mb-4" size={40} />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="mx-auto text-[#B9C2DB] mb-3" size={40} />
            <p className="text-gray-500 mb-4">
              条件に一致する求人が見つかりませんでした
            </p>
            <button
              onClick={clearFilters}
              className="text-[#1E3A8A] font-bold hover:text-[#11204C]"
            >
              絞り込みをクリア
            </button>
          </div>
        ) : (
          filteredJobs.map((job: any, idx: number) => (
            <div key={job.id}>
              {/* 2件目に infeed 広告を挿入 (TestAPP 準拠) */}
              {idx === 1 && (
                <div className="mb-4">
                  <AdBanner
                    type="infeed"
                    campaignId="5"
                    title="2026年度 初期研修説明会 受付中"
                    imageUrl="https://images.unsplash.com/photo-1758691462848-ba1e929da259?auto=format&fit=crop&q=80&w=1080"
                    sponsorName="医療法人伏見会　伏見病院"
                  />
                </div>
              )}

              <div className="bg-white p-4 rounded-2xl shadow-sm border border-[#F2F4F8] relative hover:shadow-md transition-all group">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    openLoginModal();
                  }}
                  className="absolute top-4 right-4 text-gray-300 hover:text-[#1E3A8A] transition-colors active:scale-90"
                  aria-label="保存"
                >
                  <BookmarkPlus size={22} strokeWidth={1.5} />
                </button>

                <div className="flex gap-2 mb-2 flex-wrap">
                  {(job.category || job.jobType) && (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-[#B9C2DB]/30 text-[#11204C] rounded">
                      {job.category || job.jobType}
                    </span>
                  )}
                  {(job.employment_type || job.employmentType) && (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded">
                      {job.employment_type || job.employmentType}
                    </span>
                  )}
                  {job.requirements && (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded">
                      {job.requirements}
                    </span>
                  )}
                  {Array.isArray(job.tags) &&
                    job.tags.slice(0, 2).map((tag: string) => (
                      <span
                        key={tag}
                        className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                </div>

                <h4 className="font-bold text-gray-800 leading-snug pr-8 mb-3 group-hover:text-[#11204C] transition-colors">
                  {job.title}
                </h4>

                <div className="space-y-1.5 text-xs text-gray-600 mb-4 bg-gray-50/50 p-3 rounded-xl border border-gray-50">
                  {(job.location || job.location_pref) && (
                    <div className="flex items-center gap-1.5">
                      <MapPin size={14} className="text-[#1E3A8A] shrink-0" />
                      {job.location || job.location_pref}
                    </div>
                  )}
                  {(job.salaryDisplay || job.salary_display) && (
                    <div className="flex items-center gap-1.5">
                      <JapaneseYen size={14} className="text-[#1E3A8A] shrink-0" />
                      {job.salaryDisplay || job.salary_display}
                    </div>
                  )}
                  {job.schedule && (
                    <div className="flex items-center gap-1.5">
                      <Clock size={14} className="text-[#1E3A8A] shrink-0" />
                      {job.schedule}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="w-5 h-5 rounded-full bg-[#B9C2DB]/30 text-[#1E3A8A] flex items-center justify-center font-bold text-[10px]">
                      {(job.company_type || job.companyType || "求").toString().charAt(0)}
                    </div>
                    <span className="line-clamp-1">
                      {job.company_name || job.company || "会社名未設定"}
                    </span>
                  </div>
                  <Link
                    href={job.link_url || `/jobs/${job.id}`}
                    target={job.link_url ? "_blank" : undefined}
                    rel={job.link_url ? "noopener noreferrer" : undefined}
                    className="bg-gradient-to-r from-[#1E3A8A] to-[#11204C] text-white text-xs font-bold px-5 py-2 rounded-full shadow-sm hover:shadow-md hover:from-[#11204C] hover:to-[#1E3A8A] transition-all active:scale-95"
                  >
                    詳細を見る
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Filter Modal */}
      <JobFilterModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onApplyFilters={setFilters}
      />

      {/* ============================================================
          SPONSORS & PARTNERS セクション (スポンサータブ廃止に伴う移設先)
          - Supabase の sponsors テーブルを利用
          - PLATINUM / GOLD の順で最大 4-6件表示
         ============================================================ */}
      <div className="px-4 pb-10">
        <div className="rounded-2xl overflow-hidden border border-[#B9C2DB] shadow-sm">
          <div
            className="px-5 py-3 flex items-center gap-2"
            style={{ background: "#11204C" }}
          >
            <Building2 size={14} className="text-[#B9C2DB]" />
            <span className="text-white text-xs font-bold tracking-widest">
              SPONSORS &amp; PARTNERS
            </span>
          </div>
          <div className="bg-white p-5 space-y-4">
            <p className="text-xs text-gray-500 mb-4">
              HugNaviを応援いただいているパートナー企業・医療機関様
            </p>

            {loading ? (
              <div className="py-6 flex justify-center">
                <Loader2 className="animate-spin text-[#1E3A8A]" size={24} />
              </div>
            ) : platinumSponsors.length + goldSponsors.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-500">
                現在、スポンサー情報は準備中です。
              </div>
            ) : (
              <>
                {[...platinumSponsors, ...goldSponsors].slice(0, 6).map((s: any) => {
                  const tierLabel = (s.tier || "GOLD").toString().toUpperCase();
                  const isPlatinum = tierLabel === "PLATINUM";
                  const img = s.image_url || s.banner_image_url || s.logo;
                  return (
                    <Link
                      key={s.id}
                      href={`/sponsors/${s.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl border border-[#F2F4F8] hover:border-[#B9C2DB] hover:bg-[#F2F4F8] transition-all group"
                    >
                      {img ? (
                        <img
                          src={img}
                          alt={s.name}
                          className="w-12 h-12 rounded-xl object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-[#B9C2DB]/30 flex items-center justify-center shrink-0 text-[#1E3A8A]">
                          <Building2 size={20} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate group-hover:text-[#1E3A8A] transition-colors">
                          {s.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {s.category || "パートナー"}
                        </p>
                      </div>
                      <span
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white shrink-0"
                        style={{
                          background: isPlatinum ? "#11204C" : "#1E3A8A",
                        }}
                      >
                        {tierLabel}
                      </span>
                    </Link>
                  );
                })}
                <Link
                  href="/sponsors"
                  className="block text-center text-xs font-bold text-[#1E3A8A] hover:text-[#11204C] py-2 border-t border-[#F2F4F8] mt-2"
                >
                  すべてのパートナーを見る →
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
