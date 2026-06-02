"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Tag, Share2, ExternalLink, Loader2 } from "lucide-react";
import { schoolArticles } from "@/lib/data";
import { supabaseRestFetch } from "@/lib/supabase/rest";

export default function SchoolArticleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id ? Number(params.id) : null;

  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function fetchArticle() {
      setLoading(true);
      try {
        // Supabaseから取得 (クエリパラメータをクリーンに)
        const data = await supabaseRestFetch<any[]>({
          path: `articles?id=eq.${id}`,
        });

        console.log("Supabaseから取得したデータ:", data);

        if (data && data.length > 0) {
          setArticle(data[0]);
        } else {
          // フォールバック
          const localArticle = schoolArticles.find((item) => item.id === id);
          setArticle(localArticle || null);
        }
      } catch (error) {
        console.error("記事詳細取得エラー:", error);
        const localArticle = schoolArticles.find((item) => item.id === id);
        setArticle(localArticle || null);
      } finally {
        setLoading(false);
      }
    }

    fetchArticle();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-orange-500" size={32} />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center px-6">
          <h2 className="text-xl font-bold text-gray-800 mb-2">記事が見つかりません</h2>
          <button onClick={() => router.back()} className="text-orange-500 underline text-sm">戻る</button>
        </div>
      </div>
    );
  }

  // データ抽出（柔軟に対応）
  const imageUrl = article.image_url || article.image;
  const publishDate = (article.publish_date || article.date || "").replace(/-/g, "/");
  const content = article.content || article.excerpt || "詳細本文は未登録です。";
  
  // 記事内のURLの抽出（contentの中にURLが含まれている場合も考慮）
  const urlMatch = content.match(/https?:\/\/[^\s]+/);
  const externalUrl = article.url || urlMatch?.[0];

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="w-full max-w-lg mx-auto">
        <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-600"><ArrowLeft size={24} /></button>
          <h1 className="text-base font-bold text-gray-800 flex-1 truncate">記事詳細</h1>
        </div>

        <div className="w-full h-64 bg-gray-100">
          {imageUrl && <img src={imageUrl} alt={article.title} className="w-full h-full object-cover" />}
        </div>

        <div className="px-4 py-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full">{article.category}</span>
            <span className="text-xs text-gray-400">{publishDate}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-6">{article.title}</h1>
          
          <div className="text-sm text-gray-700 leading-relaxed mb-8 whitespace-pre-wrap">
            {content}
          </div>

          {externalUrl && (
            <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-orange-500 text-white w-full py-4 rounded-xl font-bold text-sm hover:bg-orange-600 transition-colors">
              詳細を開く <ExternalLink size={16} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}