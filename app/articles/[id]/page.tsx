"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Tag, ExternalLink, Loader2 } from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";

export default function SchoolArticleDetailPage() {
  const params = useParams();
  const router = useRouter();
  // idを文字列として保持する（Supabaseのクエリには文字列のまま送る方が安全）
  const id = params.id as string;

  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function fetchArticle() {
      setLoading(true);
      try {
        // IDが数値か文字列かに関わらず eq フィルターで取得できるようにする
        const data = await supabaseRestFetch<any[]>({
          path: `articles?id=eq.${id}`,
        });

        console.log("Supabase取得結果:", data);

        if (data && data.length > 0) {
          setArticle(data[0]);
        } else {
          console.warn("DBに該当データなし。ID:", id);
          setArticle(null);
        }
      } catch (error) {
        console.error("記事取得エラー:", error);
        setArticle(null);
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
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold text-gray-800 mb-2">記事が見つかりません</h2>
        <p className="text-sm text-gray-500 mb-4">ID: {id} は存在しません</p>
        <button onClick={() => router.back()} className="text-orange-500 underline text-sm font-bold">戻る</button>
      </div>
    );
  }

  const imageUrl = article.image_url || article.image;
  const publishDate = (article.publish_date || article.date || "").replace(/-/g, "/");
  const content = article.content || article.excerpt || "詳細本文は未登録です。";

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="w-full max-w-lg mx-auto">
        <div className="sticky top-0 z-30 bg-white border-b px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()}><ArrowLeft size={24} /></button>
          <h1 className="text-base font-bold text-gray-800">記事詳細</h1>
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
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{content}</div>
        </div>
      </div>
    </div>
  );
}