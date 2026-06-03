"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, ExternalLink, Building2, Play } from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";

// YouTubeの通常のURLから動画IDを抽出する関数
const getYouTubeId = (url: string) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export default function SponsorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [sponsor, setSponsor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 外部リンクへ飛ぶ際にクリックカウントを増やす
  const handleExternalClick = async () => {
    if (!sponsor?.id) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/increment_click`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ row_id: sponsor.id })
      });
    } catch (e) {
      console.error("クリック集計エラー:", e);
    }
  };

  useEffect(() => {
    if (!id) return;
    async function fetchSponsor() {
      setLoading(true);
      try {
        const data = await supabaseRestFetch<any[]>({ path: `sponsors?id=eq.${id}` });
        setSponsor(data?.[0] || null);
      } catch (error) {
        console.error("スポンサー取得エラー:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSponsor();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFF9FA] flex items-center justify-center">
        <Loader2 className="animate-spin text-orange-500" size={40} />
      </div>
    );
  }

  if (!sponsor) {
    return (
      <div className="min-h-screen bg-[#FFF9FA] flex flex-col items-center justify-center p-6">
        <Building2 size={48} className="text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">企業情報が見つかりません</h2>
        <button onClick={() => router.back()} className="mt-4 text-orange-500 font-bold underline">
          戻る
        </button>
      </div>
    );
  }

  const videoId = sponsor.video_url ? getYouTubeId(sponsor.video_url) : null;
  const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : null;

  return (
    <div className="min-h-screen bg-[#FFF9FA] pb-20">
      {/* ヘッダー */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-orange-50 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()} className="text-gray-600 hover:text-orange-500">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-base font-bold text-gray-800 flex-1 truncate">企業詳細</h1>
      </div>

      <div className="max-w-2xl mx-auto w-full bg-white min-h-screen shadow-sm">
        {/* ヒーロー画像 */}
        <div className="w-full h-64 sm:h-80 bg-gray-100 relative">
          <img
            src={sponsor.banner_image_url || sponsor.image_url || "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80"}
            alt={sponsor.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6">
            <span className="bg-orange-500 text-white text-[10px] font-bold px-3 py-1 rounded-full w-max mb-3">
              {sponsor.tier || "PARTNER"}
            </span>
            <h2 className="text-white text-3xl font-bold tracking-tight">{sponsor.name}</h2>
          </div>
        </div>

        <div className="p-6">
          {/* 説明文 */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-gray-800 mb-3 border-b-2 border-orange-500 inline-block pb-1">
              企業メッセージ
            </h3>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {sponsor.description}
            </p>
          </div>

          {/* 動画セクション（URLがある場合のみ表示） */}
          {embedUrl && (
            <div className="mb-8">
              <h3 className="text-lg font-bold text-gray-800 mb-3 border-b-2 border-orange-500 inline-block pb-1 flex items-center gap-2">
                <Play size={18} /> 紹介動画
              </h3>
              <div className="w-full aspect-video rounded-xl overflow-hidden shadow-md bg-black">
                <iframe
                  className="w-full h-full"
                  src={embedUrl}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            </div>
          )}

          {/* 外部リンクへの巨大CTAボタン */}
          {sponsor.url && (
            <div className="mt-10 p-6 bg-orange-50 rounded-2xl border border-orange-100 text-center">
              <p className="text-sm text-gray-600 mb-4 font-bold">
                詳しい情報やエントリーは公式サイトをご覧ください
              </p>
              <a
                href={sponsor.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleExternalClick}
                className="flex items-center justify-center gap-2 w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 px-6 rounded-xl shadow-md transition-all transform hover:-translate-y-1"
              >
                公式サイトへアクセス <ExternalLink size={20} />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}