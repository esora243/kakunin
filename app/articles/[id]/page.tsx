"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Megaphone } from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";

export default function SchoolArticleDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [article, setArticle] = useState<any>(null);
  const [sponsor, setSponsor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // 1. 記事取得 (テーブル名: articles)
        const articleData = await supabaseRestFetch<any[]>({ path: `articles?id=eq.${id}` });
        setArticle(articleData?.[0] || null);

        // 2. 広告取得 (sponsorsテーブルから name と url を取得)
        const sponsorData = await supabaseRestFetch<any[]>({ path: `sponsors?limit=1` });
        setSponsor(sponsorData?.[0] || null);
      } catch (e) {
        console.error("データ取得エラー:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-orange-500" /></div>;
  if (!article) return <div className="p-10 text-center font-bold">記事が見つかりません。</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b px-4 py-3 flex items-center">
        <button onClick={() => router.back()} className="text-gray-600"><ArrowLeft /></button>
        <h1 className="ml-4 font-bold text-gray-800">記事詳細</h1>
      </header>

      <main className="max-w-lg mx-auto bg-white min-h-screen shadow-sm">
        {/* スポンサー広告バー (CSVの name と url を使用) */}
        {sponsor && (
          <div className="bg-orange-50 border-b border-orange-100 p-3 flex items-center gap-3">
            <Megaphone className="text-orange-500 shrink-0" size={20} />
            <div className="flex-1 overflow-hidden">
              <p className="text-[10px] text-orange-500 font-bold uppercase tracking-wider">Sponsored</p>
              <p className="text-sm font-bold text-gray-800 truncate">{sponsor.name}</p>
            </div>
            <a href={sponsor.url} target="_blank" rel="noopener noreferrer" className="text-orange-500 text-xs font-bold underline shrink-0">詳細</a>
          </div>
        )}

        {article.image_url && (
          <img src={article.image_url} alt="" className="w-full aspect-video object-cover bg-gray-200" />
        )}

        <article className="px-5 py-8">
          <h1 className="text-2xl font-extrabold text-gray-900 mb-6">{article.title}</h1>
          <div className="prose prose-orange max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
            {article.content}
          </div>
          
          {/* 中盤のCall to Action */}
          {article.url && (
            <a href={article.url} target="_blank" rel="noopener noreferrer" className="mt-10 block w-full bg-gray-900 text-white text-center py-4 rounded-xl font-bold hover:bg-gray-800 transition">
              詳細を確認する
            </a>
          )}
        </article>
      </main>
    </div>
  );
}