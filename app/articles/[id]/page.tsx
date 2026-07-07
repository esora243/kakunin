"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Megaphone } from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";
// ローカルのJSONデータを読み込む関数をインポート
import { getAllArticles } from "@/lib/articles";

export default function ArticleDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [article, setArticle] = useState<any>(null);
  const [sponsor, setSponsor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function fetchData() {
      setLoading(true);
      try {
        // 1. まずローカルのJSONデータ (articles.json) から記事を探す
        const localArticles = getAllArticles();
        const foundLocal = localArticles.find((a) => String(a.id) === id);

        if (foundLocal) {
          // JSONデータが見つかった場合はそれをセット
          setArticle({
            title: foundLocal.title,
            content: foundLocal.content,
            image_url: foundLocal.image,
            url: foundLocal.url, // もしあれば
          });
        } else {
          // 2. ローカルになければ Supabase の「articles」テーブルから取得
          const articleData = await supabaseRestFetch<any[]>({ path: `articles?id=eq.${id}` });
          setArticle(articleData?.[0] || null);
        }

        // 3. 広告取得 (sponsorsテーブルの最初の1件)
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-[#1E3A8A]" size={32} />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center flex-col gap-4">
        <div className="font-bold text-gray-800">記事が見つかりません。</div>
        <button onClick={() => router.back()} className="text-[#1E3A8A] text-sm underline font-bold">戻る</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b px-4 py-3 flex items-center">
        <button onClick={() => router.back()} className="text-gray-600"><ArrowLeft /></button>
        <h1 className="ml-4 font-bold text-gray-800">記事詳細</h1>
      </header>

      <main className="max-w-lg mx-auto bg-white min-h-screen shadow-sm">
        {/* スポンサー広告バー (name, url を使用) */}
        {sponsor?.name && sponsor?.url && (
          <div className="bg-[#F2F4F8] border-b border-[#B9C2DB] p-3 flex items-center gap-3">
            <Megaphone className="text-[#1E3A8A] shrink-0" size={20} />
            <div className="flex-1 overflow-hidden">
              <p className="text-[10px] text-[#1E3A8A] font-bold uppercase tracking-wider">Sponsored</p>
              <p className="text-sm font-bold text-gray-800 truncate">{sponsor.name}</p>
            </div>
            <a href={sponsor.url} target="_blank" rel="noopener noreferrer" className="text-[#1E3A8A] text-xs font-bold underline shrink-0">詳細へ</a>
          </div>
        )}

        {article.image_url && (
          <img src={article.image_url} alt="" className="w-full aspect-video object-cover bg-gray-200" />
        )}

        <article className="px-5 py-8">
          <h1 className="text-2xl font-extrabold text-gray-900 mb-6">{article.title}</h1>
          <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
            {article.content}
          </div>
          
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
