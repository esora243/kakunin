"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Tag, Share2, ExternalLink } from "lucide-react";
import { activityArticles, schoolArticles } from "@/lib/data";

/**
 * 統合 記事詳細ページ
 * - /articles/[id] : 学校 + 課外活動 の両 records をローカルから取得して描画。
 * - Hugmeid mock の SchoolArticleDetail / Activities article の見た目を踏襲。
 */
export default function ArticleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const article =
    schoolArticles.find((item) => item.id === id) ||
    activityArticles.find((item) => item.id === id);

  if (!article) {
    return (
      <div className="min-h-screen bg-white pb-20 flex items-center justify-center">
        <div className="text-center px-6">
          <h2 className="text-xl font-bold text-gray-800 mb-2">記事が見つかりません</h2>
          <p className="text-sm text-gray-500 mb-6">
            この記事は未登録、または削除されています。
          </p>
          <Link
            href="/articles"
            className="bg-orange-500 text-white font-bold px-6 py-3 rounded-full"
          >
            記事一覧へ戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="w-full max-w-lg mx-auto">
        <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-orange-100 px-4 py-3 flex items-center gap-3 shadow-sm">
          <button
            onClick={() => router.push("/articles")}
            className="text-gray-600 hover:text-orange-500"
            aria-label="戻る"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-base font-bold text-gray-800 flex-1 truncate">記事詳細</h1>
          <button className="text-gray-400 hover:text-orange-500" aria-label="共有">
            <Share2 size={20} />
          </button>
        </div>

        <div className="animate-fade-in">
          <div className="w-full h-64 bg-gray-100">
            {article.image ? (
              <img src={article.image} alt={article.title} className="w-full h-full object-cover" />
            ) : null}
          </div>

          <div className="px-4 py-6 border-b border-orange-50">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold px-2.5 py-1 bg-purple-50 text-purple-600 rounded-full flex items-center gap-1">
                <Tag size={12} />
                {article.category}
              </span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Calendar size={12} />
                {article.date}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 leading-tight">{article.title}</h1>
          </div>

          <div className="px-4 py-6">
            <p className="text-sm text-gray-700 leading-relaxed mb-4">
              {article.excerpt ||
                "詳細本文は未登録です。運用時は記事CMSや外部URLと連携してください。"}
            </p>
            {article.url ? (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-orange-500 text-white px-5 py-3 rounded-full font-bold text-sm shadow-sm hover:bg-orange-600 transition-colors"
              >
                元記事を開く <ExternalLink size={16} />
              </a>
            ) : (
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-sm text-gray-600">
                外部記事URLは未設定です。記事データに url を追加すると導線を設置できます。
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
