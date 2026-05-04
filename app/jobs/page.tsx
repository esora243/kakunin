"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Search, Filter, Loader2, MapPin, DollarSign, ExternalLink, Image as ImageIcon } from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";

const CATEGORIES = ["すべて", "家庭教師", "塾", "インターン", "その他"];

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
    fetchJobs();
  }, []);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // 1. カテゴリフィルター
      // DBにcategoryがない場合を考慮し、部分一致でも判定
      const matchesCategory = 
        activeCategory === "すべて" || 
        job.category === activeCategory || 
        (job.title && job.title.includes(activeCategory));

      // 2. フリーワード検索
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
    <div className="w-full max-w-4xl mx-auto bg-white min-h-screen">
      {/* 追従するヘッダー＆検索エリア */}
      <div className="sticky top-0 z-30 bg-white pt-6 px-4 pb-2 border-b border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">求人</h2>

        {/* 検索バーとフィルターボタン */}
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
          <button className="shrink-0 w-12 h-12 flex items-center justify-center border border-orange-200 bg-orange-50 text-orange-500 rounded-xl hover:bg-orange-100 transition-colors">
            <Filter size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* カテゴリタブ */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`shrink-0 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                activeCategory === category
                  ? "bg-[#ff6b00] text-white shadow-sm"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 pb-20">
        {/* ヒット件数表示 */}
        <div className="mb-4 pb-3 border-b border-gray-100">
          <p className="text-sm text-gray-600 font-medium">
            {filteredJobs.length}件の求人が見つかりました
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-orange-500 mb-4" size={40} />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="bg-gray-50 rounded-2xl p-10 text-center border border-dashed border-gray-200">
            <p className="text-gray-500 font-bold">条件に一致する求人がありません</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredJobs.map((job) => (
              <Link
                key={job.id}
                href={job.link_url || `/jobs/${job.id}`} // 外部リンクがあればそちらへ、なければ詳細ページへ
                className="block bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all group"
                target={job.link_url ? "_blank" : undefined}
                rel={job.link_url ? "noopener noreferrer" : undefined}
              >
                <div className="flex gap-4">
                  {/* サムネイル画像 */}
                  <div className="shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center">
                    {job.image_url ? (
                      <img src={job.image_url} alt={job.title} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="text-gray-300" size={32} />
                    )}
                  </div>

                  {/* 求人情報 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {job.company_name}
                      </span>
                      {/* タグの表示 */}
                      {job.tags && Array.isArray(job.tags) && job.tags.slice(0, 2).map((tag: string, idx: number) => (
                        <span key={idx} className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
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
                        <span className="font-bold text-gray-700 truncate">{job.salary_display}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}