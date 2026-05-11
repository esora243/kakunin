"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Tag, Share2, ExternalLink, Loader2 } from "lucide-react";
import { activityArticles, schoolArticles } from "@/lib/data";
import { supabaseRestFetch } from "@/lib/supabase/rest";

/**
 * 統合 記事詳細ページ
 * - /articles/[id] : Supabaseの articles テーブルからデータを取得。
 * - 見つからない場合は、ローカルの schoolArticles + activityArticles をフォールバック。
 */
export default function ArticleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchArticle() {
      setLoading(true);
      try {
        // 1. Supabaseから該当IDの記事を取得
        const data = await supabaseRestFetch<any[]>({
          path: `articles?id=eq.${id}&select=*`,
        });

        if (!cancelled) {
          if (data && data.length > 0) {
            setArticle(data[0]);
          } else {
            // 2. Supabaseに見つからない場合はローカルデータから探す（フォールバック）
            const localArticle =
              schoolArticles.find((item) => item.id === id) ||
              activityArticles.find((item) => item.id === id);
            setArticle(localArticle || null);
          }
        }
      } catch (error) {
        console.error("記事詳細取得エラー:", error);
        if (!cancelled) {
          // エラー時もローカルデータをフォールバックとして設定
          const localArticle =
            schoolArticles.find((item) => item.id === id) ||
            activityArticles.find((item) => item.id === id);
          setArticle(localArticle || null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (id) {
      void fetchArticle();
    }

    return () => {
      cancelled = true;
    };
  }, [id]);

  // ローディング中の表示
  if (loading) {
    return (
      <div className="min-h-screen bg-white pb-20 flex items-center justify-center">
        <Loader2 className="animate-spin text-orange-500" size={32} />
      </div>
    );
  }

  // 記事が見つからなかった場合の表示
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
            className="bg-orange-500 text-white font-bold px-6 py-3 rounded-full hover:bg-orange-600 transition-colors"
          >
            記事一覧へ戻る
          </Link>
        </div>
      </div>
    );
  }

  // Supabaseとローカルデータのプロパティ名の違いを吸収
  const imageUrl = article.image_url || article.image;
  const publishDate = (article.publish_date || article.date || "").replace(/-/g, "/");
  const content = article.content || article.excerpt || "詳細本文は未登録です。";

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="w-full max-w-lg mx-auto">
        {/* ヘッダー */}
        <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-orange-100 px-4 py-3 flex items-center gap-3 shadow-sm">
          <button
            onClick={() => router.push("/articles")}
            className="text-gray-600 hover:text-orange-500 transition-colors"
            aria-label="戻る"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-base font-bold text-gray-800 flex-1 truncate">記事詳細</h1>
          <button className="text-gray-400 hover:text-orange-500 transition-colors" aria-label="共有">
            <Share2 size={20} />
          </button>
        </div>

        <div className="animate-fade-in">
          {/* サムネイル画像 */}
          <div className="w-full h-64 bg-gray-100 relative">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={article.title || "記事画像"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                No Image
              </div>
            )}
          </div>

          {/* タイトルとメタ情報 */}
          <div className="px-4 py-6 border-b border-orange-50">
            <div className="flex items-center gap-2 mb-3">
              {article.category && (
                <span className="text-xs font-bold px-2.5 py-1 bg-purple-50 text-purple-600 rounded-full flex items-center gap-1">
                  <Tag size={12} />
                  {article.category}
                </span>
              )}
              {publishDate && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Calendar size={12} />
                  {publishDate}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-800 leading-tight">
              {article.title}
            </h1>
          </div>

          {/* 本文とリンク */}
          <div className="px-4 py-6">
            <div className="text-sm text-gray-700 leading-relaxed mb-6 whitespace-pre-wrap">
              {content}
            </div>

            {article.url ? (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-full sm:w-auto gap-2 bg-orange-500 text-white px-6 py-3 rounded-full font-bold text-sm shadow-sm hover:bg-orange-600 transition-colors"
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