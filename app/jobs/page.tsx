"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  Loader2,
  MapPin,
  DollarSign,
  Image as ImageIcon,
  Briefcase,
} from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";
import { FloatingBanner } from "@/components/FloatingBanner";
import { AdBanner } from "@/components/AdBanner";

const CATEGORIES = ["すべて", "家庭教師", "塾", "インターン", "その他"];

/**
 * 求人ページ
 * - Hugmeid mock のフィードレイアウト(sticky 検索 + カテゴリピル + リスト) を反映。
 * - kakunin の Supabase 連携(jobs テーブル取得 / フィルタ) と外部応募リンク機能を保持。
 * - 要件定義書: 求人カテゴリは家庭教師/塾/インターン/その他 (Phase 1)
 * - フィード途中に AdBanner(infeed) を挿入し、ヘッダー直下に FloatingBanner を配置。
 */
export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("すべて");

  useEffect(() => {
    async function fetchJobs() {
      setLoading(true);
      try {
        const data = await supabaseRestFetch<any[]>({ path: "jobs?select=*" });
        setJobs(data || []);
      } catch (error) {
        console.error("求人データの取得に失敗しました:", error);
      } finally {
        setLoading(false);
      }
    }
    void fetchJobs();
  }, []);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesCategory =
        activeCategory === "すべて" ||
        job.category === activeCategory ||
        (job.title && job.title.includes(activeCategory));

      const query = searchQuery.toLowerCase();
      const matchesSearch =
        !query ||
        job.title?.toLowerCase().includes(query) ||
        job.company_name?.toLowerCase().includes(query) ||
        job.location_pref?.toLowerCase().includes(query) ||
        (job.tags && job.tags.some((tag: string) => tag.toLowerCase().includes(query)));

      return matchesCategory && matchesSearch;
    });
  }, [jobs, searchQuery, activeCategory]);

  return (
    <div className="w-full max-w-lg mx-auto bg-white min-h-screen pb-20 animate-slide-in-right">
      {/* ============================================================
          sticky ヘッダー
         ============================================================ */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md pt-6 px-4 pb-2 border-b border-orange-100 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">求人</h2>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" strokeWidth={2.5} />
            </div>
            <input
              type="text"
              placeholder="フリーワードで絞り込み"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all placeholder:text-gray-300 font-medium"
            />
          </div>
          <button
            aria-label="絞り込み"
            className="shrink-0 w-12 h-12 flex items-center justify-center border border-orange-200 bg-orange-50 text-orange-500 rounded-xl hover:bg-orange-100 transition-colors"
          >
            <Filter size={20} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                activeCategory === category
                  ? "bg-orange-500 text-white shadow-sm"
                  : "bg-gray-50 text-gray-600 hover:bg-orange-50 border border-gray-100"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* ============================================================
          FloatingBanner (Hugmeid mock 由来)
         ============================================================ */}
      <div className="pt-3">
        <FloatingBanner
          campaignId="3"
          title="医学生限定 高時給インターン特集"
          imageUrl="https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&q=80&w=1080"
          sponsorName="株式会社メディカルキャリア"
        />
      </div>

      {/* ============================================================
          求人リスト
         ============================================================ */}
      <div className="px-4 pt-2 pb-20">
        <div className="mb-4 pb-3 border-b border-orange-50">
          <p className="text-sm text-gray-600 font-medium">
            {filteredJobs.length}件の求人が見つかりました
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-orange-500 mb-4" size={40} />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-dashed border-orange-100">
            <Briefcase className="mx-auto text-orange-200 mb-3" size={40} />
            <p className="text-gray-500 font-bold">条件に一致する求人がありません</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredJobs.map((job, idx) => (
              <div key={job.id}>
                <Link
                  href={job.link_url || `/jobs/${job.id}`}
                  className="block bg-white rounded-2xl border border-orange-50 p-4 shadow-sm hover:shadow-md transition-all group"
                  target={job.link_url ? "_blank" : undefined}
                  rel={job.link_url ? "noopener noreferrer" : undefined}
                >
                  <div className="flex gap-4">
                    <div className="shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-orange-50 border border-orange-50 flex items-center justify-center">
                      {job.image_url ? (
                        <img
                          src={job.image_url}
                          alt={job.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="text-orange-200" size={32} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {job.company_name}
                        </span>
                        {job.tags &&
                          Array.isArray(job.tags) &&
                          job.tags.slice(0, 2).map((tag: string, tIdx: number) => (
                            <span
                              key={tIdx}
                              className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                      </div>

                      <h3 className="font-bold text-gray-800 text-sm leading-snug group-hover:text-orange-600 transition-colors mb-2 line-clamp-2">
                        {job.title}
                      </h3>

                      <div className="space-y-1 mt-auto">
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium">
                          <MapPin size={12} className="text-gray-400" />
                          <span className="truncate">{job.location_pref}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium">
                          <DollarSign size={12} className="text-gray-400" />
                          <span className="font-bold text-gray-700 truncate">
                            {job.salary_display}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>

                {/* Hugmeid mock のフィード途中広告挿入 (5件ごと) */}
                {(idx + 1) % 5 === 0 && (
                  <div className="my-4">
                    <AdBanner
                      type="infeed"
                      campaignId="5"
                      title="新着 病院見学プログラム説明会"
                      imageUrl="https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?auto=format&fit=crop&q=80&w=1080"
                      sponsorName="医療法人伏見会"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
