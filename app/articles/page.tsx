"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Loader2, Newspaper, Image as ImageIcon } from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";
import { schoolArticles, activityArticles } from "@/lib/data";
import { FloatingBanner } from "@/components/FloatingBanner";

// 記事データの型定義（Supabaseのスキーマとローカルデータの両方をカバー）
type ArticleItem = {
  id: string | number;
  type?: string;
  title: string;
  category?: string;
  excerpt?: string;
  content?: string;
  image?: string;
  image_url?: string;
  date?: string;
  publish_date?: string;
  url?: string;
};

/**
 * 記事一覧ページ
 */
export default function ArticlesPage() {
  const [allArticles, setAllArticles] = useState<ArticleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("すべて");

  useEffect(() => {
    let cancelled = false;
    async function fetchArticles() {
      setLoading(true);
      try {
        const data = await supabaseRestFetch<ArticleItem[]>({
          path: "articles?select=*",
        });
        if (!cancelled) setAllArticles(data || []);
      } catch (error) {
        console.error("記事取得エラー:", error);
        if (!cancelled) setAllArticles([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchArticles();
    return () => {
      cancelled = true;
    };
  }, []);

  // フォールバック: ローカルの記事(schoolArticles + activityArticles) を統合
  const displayArticles = useMemo(() => {
    if (allArticles.length > 0) return allArticles;
    // ローカルデータの型を ArticleItem に合わせる
    return [...schoolArticles, ...activityArticles] as ArticleItem[];
  }, [allArticles]);

  // カテゴリ一覧を動的に生成
  const categories = useMemo(
    () => [
      "すべて",
      ...Array.from(
        new Set(displayArticles.map((a) => a.category).filter(Boolean)),
      ),
    ],
    [displayArticles],
  );

  // 検索とカテゴリによる絞り込み
  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return displayArticles.filter((article) => {
      const title = (article.title || "").toLowerCase();
      const excerpt = (article.excerpt || "").toLowerCase();
      const matchQuery = !q || title.includes(q) || excerpt.includes(q);
      const matchCategory =
        selectedCategory === "すべて" || article.category === selectedCategory;
      return matchQuery && matchCategory;
    });
  }, [displayArticles, searchQuery, selectedCategory]);

  // 記事 type に応じて遷移先を切り替え
  const getArticleHref = (article: ArticleItem) => {
    if (article.type === "activity") return `/articles/${article.id}`;
    if (article.type === "school") return `/school/articles/${article.id}`;
    // フォールバック
    return `/articles/${article.id}`;
  };

  return (
    <div className="w-full max-w-lg mx-auto pb-8 bg-white min-h-screen animate-fade-in">
      {/* sticky ヘッダー */}
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
              onClick={() => setSelectedCategory(category as string)}
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

      {/* FloatingBanner */}
      <div className="pt-3">
        <FloatingBanner
          campaignId="7"
          title="医学生向け奨学金プログラム説明会"
          imageUrl="https://images.unsplash.com/photo-1603726574690-cc3138bfec8c?auto=format&fit=crop&q=80&w=1080"
          sponsorName="公益財団法人 未来医療基金"
        />
      </div>

      {/* 記事リスト */}
      <div className="px-4 pt-1 space-y-3 pb-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-orange-500" size={32} />
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-xl border border-dashed border-orange-100">
            <Newspaper className="mx-auto text-orange-200 mb-2" size={32} />
            <p className="text-gray-500 text-sm font-bold">
              {displayArticles.length === 0
                ? "記事はまだ登録されていません"
                : "一致する記事が見つかりません"}
            </p>
            {displayArticles.length > 0 && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("すべて");
                }}
                className="mt-2 text-orange-500 text-xs font-bold underline"
              >
                検索条件をクリア
              </button>
            )}
          </div>
        ) : (
          filteredArticles.map((article) => {
            const imageUrl = article.image_url || article.image;
            const dateStr = article.publish_date || article.date || "";
            const formattedDate = dateStr ? dateStr.replace(/-/g, "/") : "";

            return (
              <Link
                key={`${article.type || "default"}-${article.id}`}
                href={getArticleHref(article)}
                className="block bg-white rounded-xl shadow-sm border border-orange-50 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="flex">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={article.title}
                      className="w-28 h-28 object-cover shrink-0 bg-orange-50"
                    />
                  ) : (
                    <div className="w-28 h-28 shrink-0 bg-gray-100 flex flex-col items-center justify-center text-gray-300">
                      <ImageIcon size={24} />
                    </div>
                  )}
                  <div className="p-3 flex flex-col justify-center min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-orange-500 font-bold px-1.5 py-0.5 bg-orange-50 rounded-sm truncate max-w-[60%]">
                        {article.category || "未分類"}
                      </span>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {formattedDate}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-gray-800 line-clamp-2 mb-1 leading-tight">
                      {article.title}
                    </h4>
                    <p className="text-xs text-gray-500 line-clamp-2 leading-tight">
                      {article.excerpt || "本文がありません"}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}