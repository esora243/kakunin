"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Tag,
  Share2,
  ExternalLink,
  Loader2,
  Megaphone
} from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";

export default function SchoolArticleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [article, setArticle] = useState<any>(null);
  const [sponsor, setSponsor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function fetchData() {
      setLoading(true);
      try {
        // 1. Supabaseから記事を取得 (テーブル名: articles)
        const articleData = await supabaseRestFetch<any[]>({ path: `articles?id=eq.${id}` });
        setArticle(articleData?.[0] || null);

        // 2. Supabaseからスポンサーを取得 (テーブル名: sponsors)
        try {
          const sponsorRes = await supabaseRestFetch<any[]>({ path: `sponsors?limit=1` });
          setSponsor(sponsorRes?.[0] || null);
        } catch (sponsorErr) {
          console.warn("広告データの読み込みをスキップしました");
        }
      } catch (e) {
        console.error("データ読み込みエラー:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-[#1E3A8A]" size={32} />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-white pb-20 flex items-center justify-center">
        <div className="text-center px-6">
          <h2 className="text-xl font-bold text-gray-800 mb-2">記事が見つかりません</h2>
          <p className="text-sm text-gray-500 mb-6">
            この記事は未登録、または削除されています。
          </p>
          <button
            onClick={() => router.back()}
            className="bg-[#F2F4F8]0 text-white font-bold px-6 py-3 rounded-full"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  // データベースのカラム名に合わせてデータを整形
  const imageUrl = article.image_url || article.image;
  const publishDate = article.publish_date || article.date;
  const content = article.content || article.excerpt || "詳細本文は未登録です。";
  const category = article.category || "未分類";

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="w-full max-w-lg mx-auto">
        {/* ヘッダー */}
        <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#B9C2DB] px-4 py-3 flex items-center gap-3 shadow-sm">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-[#1E3A8A]"
            aria-label="戻る"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-base font-bold text-gray-800 flex-1 truncate">記事詳細</h1>
          <button className="text-gray-400 hover:text-[#1E3A8A]" aria-label="共有">
            <Share2 size={20} />
          </button>
        </div>

        {/* スポンサー広告バー */}
        {sponsor?.name && sponsor?.url && (
          <div className="bg-[#F2F4F8] border-b border-[#B9C2DB] p-3 flex items-center gap-3">
            <Megaphone className="text-[#1E3A8A] shrink-0" size={20} />
            <div className="flex-1 overflow-hidden">
              <p className="text-[10px] text-[#1E3A8A] font-bold uppercase tracking-wider">Sponsored</p>
              <p className="text-sm font-bold text-gray-800 truncate">{sponsor.name}</p>
            </div>
            <a href={sponsor.url} target="_blank" rel="noopener noreferrer" className="text-[#1E3A8A] text-xs font-bold underline shrink-0">
              詳細へ
            </a>
          </div>
        )}

        <div className="animate-fade-in">
          <div className="w-full h-64 bg-gray-100">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={article.title}
                className="w-full h-full object-cover"
              />
            ) : null}
          </div>

          <div className="px-4 py-6 border-b border-[#F2F4F8]">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full flex items-center gap-1">
                <Tag size={12} />
                {category}
              </span>
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

          <div className="px-4 py-6">
            <div className="text-sm text-gray-700 leading-relaxed mb-6 whitespace-pre-wrap">
              {content}
            </div>
            {article.url ? (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#F2F4F8]0 text-white px-5 py-3 rounded-full font-bold text-sm shadow-sm hover:bg-[#11204C] transition-colors"
              >
                元記事を開く <ExternalLink size={16} />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}