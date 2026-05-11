"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Loader2, Newspaper } from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";
import { FloatingBanner } from "@/components/FloatingBanner";

// ※ @/lib/data のインポートエラーを防ぐため、存在しない場合も想定
import { schoolArticles, activityArticles } from "@/lib/data";

// エラーを防ぐための型定義
interface Article {
  id: number | string;
  title?: string;
  category?: string;
  publish_date?: string;
  date?: string;
  image_url?: string;
  image?: string;
  excerpt?: string;
  type?: string;
  [key: string]: any;
}

export default function ArticlesPage() {
  const [allArticles, setAllArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("すべて");

  useEffect(() => {
    let cancelled = false;
    async function fetchArticles() {
      setLoading(true);
      try {
        const data = await supabaseRestFetch<Article[]>({
          path: "articles?select=*",
        });
        
        if (!cancelled) {
          setAllArticles(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("記事取得エラー:", error);
        if (!cancelled) setAllArticles([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchArticles();
    return () => {
      cancelled = true;
    };
  }, []);

  const safeSchoolArticles = Array.isArray(schoolArticles) ? schoolArticles : [];
  const safeActivityArticles = Array.isArray(activityArticles) ? activityArticles : [];

  const displayArticles = useMemo(() => {
    if (allArticles.length > 0) return allArticles;
    return [...safeSchoolArticles, ...safeActivityArticles];
  }, [allArticles, safeSchoolArticles, safeActivityArticles]);

  // ★修正箇所: カテゴリー配列を確実に string[] 型として生成する
  const categories = useMemo<string[]>(() => {
    const uniqueCategories = new Set<string>();
    displayArticles.forEach((a) => {
      // 存在して、かつ文字列であるものだけを追加
      if (a && typeof a.category === "string" && a.category.trim() !== "") {
        uniqueCategories.add(a.category);
      }
    });
    return ["すべて", ...Array.from(uniqueCategories)];
  }, [displayArticles]);

  const filteredArticles = useMemo(() => {
    const q = String(searchQuery || "").trim().toLowerCase();
    return displayArticles.filter((article) => {
      if (!article) return false;
      
      const title = String(article.title || "").toLowerCase();
      const excerpt = String(article.excerpt || "").toLowerCase();
      
      const matchQuery = !q || title.includes(q) || excerpt.includes(q);
      const matchCategory =
        selectedCategory === "すべて" || article.category === selectedCategory;
      return matchQuery && matchCategory;
    });
  }, [displayArticles, searchQuery, selectedCategory]);

  const getArticleHref = (article: Article) => {
    if (!article || !article.id) return "#"; 
    return `/articles/${article.id}`;
  };

  const formatDate = (article: Article) => {
    const rawDate = article.publish_date || article.date || "";
    if (!rawDate) return "";
    try {
      const dateString = String(rawDate).split("T")[0].split(" ")[0];
      return dateString.replace(/-/g, "/");
    } catch {
      return String(rawDate);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto pb-8 bg-white min-h-screen animate-fade-in">
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-orange-100 px-4 py-4 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">記事</h2>

        <div className="relative mb-3">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="記事を検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 sm:text-sm transition-colors"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                selectedCategory === category
                  ? "bg-gray-800 border-gray-800 text-white"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-3">
        <FloatingBanner
          campaignId="7"
          title="医学生向け奨学金プログラム説明会"
          imageUrl="https://images.unsplash.com/photo-1603726574690-cc3138bfec8c?auto=format&fit=crop&q=80&w=1080"
          sponsorName="公益財団法人 未来医療基金"
        />
      </div>

      <div className="px-4 pt-1 space-y-3 pb-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-orange-500" size={32} />
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-xl border border-dashed border-orange-100">
            <Newspaper className="mx-auto text-orange-200 mb-2" size={32} />
            <p className="text-gray-500 text-sm font-bold">
              一致する記事が見つかりません
            </p>
          </div>
        ) : (
          filteredArticles.map((article: Article, index: number) => {
            const uniqueKey = article.id ? `article-${article.id}-${index}` : `article-fallback-${index}`;
            
            return (
              <Link
                key={uniqueKey}
                href={getArticleHref(article)}
                className="block bg-white rounded-xl shadow-sm border border-orange-50 overflow-hidden flex hover:shadow-md transition-shadow"
              >
                <img
                  src={article.image_url || article.image || "/api/placeholder/400/320"}
                  alt={article.title || "記事画像"}
                  className="w-28 h-28 object-cover shrink-0 bg-orange-50"
                />
                <div className="p-3 flex flex-col justify-center min-w-0 flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-orange-500 font-bold px-1.5 py-0.5 bg-orange-50 rounded-sm">
                      {article.category || "未分類"}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {formatDate(article)}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-gray-800 line-clamp-2 mb-1 leading-tight">
                    {article.title || "無題の記事"}
                  </h4>
                  <p className="text-xs text-gray-500 line-clamp-2 leading-tight">
                    {article.excerpt || "説明がありません。"}
                  </p>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}