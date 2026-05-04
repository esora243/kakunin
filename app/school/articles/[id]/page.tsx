"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Tag, Share2, ExternalLink } from "lucide-react";
import { schoolArticles } from "@/lib/data";

export default function SchoolArticleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const article = schoolArticles.find((item) => item.id === Number(params.id));

  if (!article) {
    return (
      <div className="min-h-screen bg-white pb-20 flex items-center justify-center">
        <div className="text-center px-6">
          <h2 className="text-xl font-bold text-gray-800 mb-2">記事が見つかりません</h2>
          <p className="text-sm text-gray-500 mb-6">この記事は未登録、または削除されています。</p>
          <Link href="/school" className="bg-pink-500 text-white font-bold px-6 py-3 rounded-full">学校ページへ戻る</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="w-full max-w-lg mx-auto">
        <div className="sticky top-[110px] z-30 bg-white/90 backdrop-blur-md border-b border-pink-100 px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push("/school")} className="text-gray-600 hover:text-pink-500">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-base font-bold text-gray-800 flex-1 truncate">記事詳細</h1>
          <button className="text-gray-400 hover:text-pink-500">
            <Share2 size={20} />
          </button>
        </div>

        <div className="animate-fade-in">
          <div className="w-full h-64 bg-gray-100">{article.image ? <img src={article.image} alt={article.title} className="w-full h-full object-cover" /> : null}</div>

          <div className="px-4 py-6 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full flex items-center gap-1">
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
              {article.excerpt || "詳細本文は未登録です。運用時は記事CMSや外部URLと連携してください。"}
            </p>
            {article.url ? (
              <a href={article.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-pink-500 text-white px-5 py-3 rounded-full font-bold text-sm">
                元記事を開く <ExternalLink size={16} />
              </a>
            ) : (
              <div className="bg-pink-50 border border-pink-100 rounded-xl p-4 text-sm text-gray-600">
                外部記事URLは未設定です。schoolArticles に url を追加すると導線を設置できます。
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
