"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2, ExternalLink, Play, Award, Video, ChevronRight } from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";

export default function SponsorsPage() {
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSponsors() {
      setLoading(true);
      try {
        const data = await supabaseRestFetch<any[]>({ path: "sponsors?select=*" });
        setSponsors(data || []);
      } catch (error) {
        console.error("スポンサー取得エラー:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSponsors();
  }, []);

  // ティア（ランク）ごとにデータを分割
  const platinumSponsors = useMemo(() => sponsors.filter(s => s.tier === 'Platinum'), [sponsors]);
  const otherSponsors = useMemo(() => sponsors.filter(s => s.tier !== 'Platinum'), [sponsors]);

  return (
    <div className="w-full max-w-5xl mx-auto bg-[#fffcfc] min-h-screen font-sans pb-20">
      
      {/* ページヘッダー */}
      <div className="bg-white border-b border-gray-100 py-10 px-6 text-center mb-10 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">パートナー企業のご紹介</h1>
        <p className="text-sm text-gray-500 max-w-2xl mx-auto leading-relaxed">
          Hugmeidを通じて、医学生の未来とキャリアを応援・支援していただいている企業・医療機関様です。
        </p>
      </div>

      <div className="px-4 sm:px-6">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={40} /></div>
        ) : (
          <>
            {/* ========================================= */}
            {/* プレミアムパートナー (PLATINUM) セクション */}
            {/* ========================================= */}
            <div className="mb-16">
              <div className="text-center mb-8">
                <span className="text-orange-500 font-bold text-xs tracking-[0.2em] uppercase">Platinum Partners</span>
                <h2 className="text-3xl font-extrabold text-[#1e293b] mt-2">プレミアムパートナー</h2>
              </div>

              <div className="space-y-10">
                {platinumSponsors.map((sponsor) => (
                  <div key={sponsor.id} className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden animate-fade-in">
                    
                    {/* メインヒーロー画像エリア */}
                    <div className="relative h-[300px] sm:h-[400px] w-full group">
                      <img 
                        src={sponsor.image_url || "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80"} 
                        alt={sponsor.name} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      {/* グラデーションオーバーレイ */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                      
                      {/* テキストコンテンツ */}
                      <div className="absolute bottom-0 left-0 p-6 sm:p-10 w-full">
                        <span className="inline-block bg-orange-500 text-white px-3 py-1 rounded-full text-[10px] font-bold tracking-wider mb-4 shadow-md">
                          PLATINUM
                        </span>
                        <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight">
                          {sponsor.name}
                        </h3>
                        <p className="text-gray-200 text-sm sm:text-base max-w-3xl leading-relaxed opacity-90 line-clamp-2">
                          {sponsor.description}
                        </p>
                      </div>
                    </div>

                    {/* サブカードエリア (PICK UP / VIDEO) */}
                    <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white">
                      
                      {/* サブカード1: PICK UP */}
                      <div className="border border-gray-100 rounded-3xl p-5 hover:border-orange-200 hover:shadow-md transition-all group/card cursor-pointer">
                        <div className="flex items-center gap-2 text-orange-500 font-bold text-xs mb-3">
                          <Award size={16} /> PICK UP
                        </div>
                        <div className="rounded-2xl overflow-hidden h-32 mb-4 bg-gray-100">
                          <img src="https://images.unsplash.com/photo-1576091160550-2173ff9e5ee5?auto=format&fit=crop&w=500&q=60" alt="Pick up" className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500" />
                        </div>
                        <h4 className="font-bold text-gray-800 text-sm mb-2">初期研修プログラム</h4>
                        <p className="text-xs text-gray-500 mb-4 line-clamp-2">全国トップクラスの救急受け入れ件数を誇り、実践的な手技が身につきます。</p>
                        <a href={sponsor.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-orange-500 hover:text-orange-600 transition-colors">
                          詳細を見る <ExternalLink size={12} />
                        </a>
                      </div>

                      {/* サブカード2: VIDEO */}
                      <div className="border border-gray-100 rounded-3xl p-5 hover:border-orange-200 hover:shadow-md transition-all group/card cursor-pointer">
                        <div className="flex items-center gap-2 text-orange-500 font-bold text-xs mb-3">
                          <Video size={16} /> VIDEO
                        </div>
                        <div className="relative rounded-2xl overflow-hidden h-32 mb-4 bg-gray-900 group/video">
                          <img src="https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=500&q=60" alt="Video thumbnail" className="w-full h-full object-cover opacity-70 group-hover/card:opacity-50 transition-opacity" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center text-orange-500 shadow-lg group-hover/video:scale-110 transition-transform">
                              <Play size={20} className="ml-1" fill="currentColor" />
                            </div>
                          </div>
                          <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded">5:24</span>
                        </div>
                        <h4 className="font-bold text-gray-800 text-sm mb-2">病院紹介ビデオ - 研修医の1日</h4>
                        <p className="text-xs text-gray-500 mb-2 line-clamp-2">動画で施設の雰囲気やインタビューをご覧いただけます。</p>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ========================================= */}
            {/* その他のパートナー (GOLD / SILVER etc) */}
            {/* ========================================= */}
            {otherSponsors.length > 0 && (
              <div className="pt-10 border-t border-gray-100">
                <div className="text-center mb-8">
                  <span className="text-gray-400 font-bold text-xs tracking-[0.2em] uppercase">Other Partners</span>
                  <h2 className="text-2xl font-bold text-gray-800 mt-2">協賛パートナー</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {otherSponsors.map((sponsor) => (
                    <a key={sponsor.id} href={sponsor.url} target="_blank" rel="noopener noreferrer" className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 hover:shadow-md transition-shadow group">
                      <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-100">
                        {sponsor.image_url ? (
                          <img src={sponsor.image_url} alt={sponsor.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-gray-400 font-bold text-xs">{sponsor.tier}</span>
                        )}
                      </div>
                      <span className="font-bold text-sm text-gray-700 text-center line-clamp-1 group-hover:text-orange-500 transition-colors">{sponsor.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}