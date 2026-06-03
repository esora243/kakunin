"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Loader2, ExternalLink, Play, Building2 } from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";

// YouTubeの通常のURLから動画IDを抽出する関数
const getYouTubeId = (url: string) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

/**
 * スポンサーページ
 */
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
    void fetchSponsors();
  }, []);

  const platinum = useMemo(
    () => sponsors.filter((s) => (s.tier || "").toLowerCase() === "platinum"),
    [sponsors],
  );
  const gold = useMemo(
    () => sponsors.filter((s) => (s.tier || "").toLowerCase() === "gold"),
    [sponsors],
  );
  const supporters = useMemo(
    () =>
      sponsors.filter(
        (s) =>
          !["platinum", "gold"].includes((s.tier || "").toLowerCase()),
      ),
    [sponsors],
  );

  return (
    <div className="w-full max-w-4xl mx-auto pb-12 bg-[#FFF9FA] min-h-screen">
      {/* ============================================================
          sticky ヘッダー
         ============================================================ */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-orange-50 px-4 py-4 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800 tracking-tight">
          パートナー企業のご紹介
        </h2>
        <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
          Hugmeidを通じて、医学生の未来とキャリアを応援・支援していただいている企業・医療機関様です。
        </p>
      </div>

      <div className="px-4 sm:px-6 pt-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-orange-500" size={40} />
          </div>
        ) : sponsors.length === 0 ? (
          <div className="bg-white rounded-2xl border border-orange-100 p-10 text-center mt-6">
            <Building2 className="mx-auto text-orange-200 mb-3" size={40} />
            <p className="text-gray-700 font-bold mb-2">スポンサー情報は未登録です</p>
            <p className="text-sm text-gray-500">
              Supabase の sponsors テーブルに本番データを追加してください。
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {/* === PLATINUM === */}
            {platinum.length > 0 && (
              <section>
                <div className="flex flex-col items-center mb-6">
                  <span className="text-orange-500 text-[10px] font-extrabold tracking-[0.2em] mb-1">
                    PLATINUM PARTNERS
                  </span>
                  <h3 className="text-2xl font-bold text-gray-800">プレミアムパートナー</h3>
                </div>

                <div className="space-y-8">
                  {platinum.map((sponsor) => {
                    const videoId = sponsor.video_url ? getYouTubeId(sponsor.video_url) : null;
                    // DBに動画URLがあればそれを使用、なければご指定の動画をデフォルトにする
                    const embedUrl = videoId
                      ? `https://www.youtube.com/embed/${videoId}`
                      : "https://www.youtube.com/embed/sqHz0vG4QfM?si=f1-PclW31XicCLH6";

                    return (
                      <div
                        key={sponsor.id}
                        className="bg-white rounded-3xl shadow-md border border-orange-100 overflow-hidden animate-fade-in"
                      >
                        {/* ヒーロー */}
                        <a
                          href={sponsor.url || "#"}
                          target={sponsor.url ? "_blank" : undefined}
                          rel="noopener noreferrer"
                          className="block relative w-full h-64 sm:h-80 group overflow-hidden"
                        >
                          <img
                            src={
                              sponsor.banner_image_url ||
                              sponsor.image_url ||
                              "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80"
                            }
                            alt={sponsor.name}
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex flex-col justify-end p-6">
                            <span className="bg-orange-500 text-white text-[10px] font-bold px-3 py-1 rounded-full w-max mb-3 shadow-md">
                              PLATINUM
                            </span>
                            <h4 className="text-white text-2xl font-bold mb-2 tracking-tight">
                              {sponsor.name}
                            </h4>
                            <p className="text-gray-200 text-sm line-clamp-2 max-w-lg">
                              {sponsor.description}
                            </p>
                          </div>
                        </a>

                        {/* サブカード(PICK UP / VIDEO) */}
                        <div className="p-6 bg-[#FDFBF7] grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="border border-orange-50 bg-white rounded-2xl p-5 hover:border-orange-200 hover:shadow-md transition-all">
                            <div className="flex items-center gap-2 text-orange-500 font-bold text-xs mb-3">
                              <Building2 size={14} /> PICK UP
                            </div>
                            <div className="rounded-2xl overflow-hidden h-32 mb-4 bg-gray-100">
                              <img
                                src={
                                  sponsor.pickup_image_url ||
                                  "https://images.unsplash.com/photo-1576091160550-2173ff9e5ee5?auto=format&fit=crop&w=500&q=60"
                                }
                                alt="Pick up"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <h4 className="font-bold text-gray-800 text-sm mb-2">
                              {sponsor.pickup_title || "初期研修プログラム"}
                            </h4>
                            <p className="text-xs text-gray-500 mb-4 line-clamp-2">
                              {sponsor.pickup_description ||
                                "全国トップクラスの研修体制と豊富な症例数で実践的な臨床力が身につきます。"}
                            </p>
                            <a
                              href={sponsor.url || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-bold text-orange-500 hover:text-orange-600 transition-colors"
                            >
                              詳細を見る <ExternalLink size={12} />
                            </a>
                          </div>

                          <div className="border border-orange-50 bg-white rounded-2xl p-5 hover:border-orange-200 hover:shadow-md transition-all flex flex-col">
                            <div className="flex items-center gap-2 text-orange-500 font-bold text-xs mb-3">
                              <Play size={14} /> VIDEO
                            </div>
                            {/* ご指定の動画タグを16:9比率で綺麗に収める設定 */}
                            <div className="relative rounded-2xl overflow-hidden aspect-video w-full mb-4 bg-gray-900 shrink-0">
                              <iframe
                                className="absolute inset-0 w-full h-full"
                                src={embedUrl}
                                title="YouTube video player"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                referrerPolicy="strict-origin-when-cross-origin"
                                allowFullScreen
                              ></iframe>
                            </div>
                            <h4 className="font-bold text-gray-800 text-sm mb-2 line-clamp-1">
                              {sponsor.video_title || "病院紹介ビデオ - 研修医の1日"}
                            </h4>
                            <p className="text-xs text-gray-500 line-clamp-2 flex-1">
                              {sponsor.video_description || "動画で施設の雰囲気やインタビューをご覧いただけます。"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* === GOLD === */}
            {gold.length > 0 && (
              <section className="pt-2 border-t border-orange-100">
                <div className="flex flex-col items-center mb-6 mt-8">
                  <span className="text-gray-400 text-[10px] font-extrabold tracking-[0.2em] mb-1">
                    GOLD PARTNERS
                  </span>
                  <h3 className="text-xl font-bold text-gray-700">公式スポンサー</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {gold.map((sponsor) => (
                    <a
                      key={sponsor.id}
                      href={sponsor.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block relative h-48 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group border border-orange-50"
                    >
                      <img
                        src={
                          sponsor.banner_image_url ||
                          sponsor.image_url ||
                          "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=60"
                        }
                        alt={sponsor.name}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-5">
                        <span className="text-[10px] text-orange-300 font-bold bg-black/40 px-2 py-0.5 rounded-sm w-max mb-2">
                          {sponsor.category || "GOLD"}
                        </span>
                        <h4 className="text-white font-bold text-sm mb-1">{sponsor.name}</h4>
                        <p className="text-gray-300 text-xs line-clamp-2">
                          {sponsor.description}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* === SUPPORTER === */}
            {supporters.length > 0 && (
              <section className="pt-2 border-t border-orange-100">
                <div className="flex flex-col items-center mb-4 mt-8">
                  <h3 className="text-lg font-bold text-gray-600">サポーター様</h3>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {supporters.map((sponsor) => (
                    <a
                      key={sponsor.id}
                      href={sponsor.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square bg-white rounded-xl border border-orange-50 p-4 flex flex-col items-center justify-center hover:border-orange-300 hover:shadow-md transition-all group"
                    >
                      {sponsor.image_url ? (
                        <img
                          src={sponsor.image_url}
                          alt={sponsor.name}
                          className="w-10 h-10 object-contain grayscale group-hover:grayscale-0 transition-all mb-2"
                        />
                      ) : (
                        <span className="text-gray-400 font-bold text-xs">
                          {sponsor.tier}
                        </span>
                      )}
                      <span className="text-[9px] text-center text-gray-500 font-medium line-clamp-2">
                        {sponsor.name}
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* === 営業 CTA === */}
            <section className="bg-gradient-to-br from-orange-50 to-orange-50 rounded-3xl p-8 border border-orange-100 text-center shadow-sm mt-8">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 size={24} className="text-orange-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                スポンサー/掲載企業様を募集しております
              </h3>
              <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto leading-relaxed">
                Hugmeidを通じて、全国の医学生に向けて貴社の魅力や求人情報をダイレクトに発信しませんか？
                <br />
                掲載プランの資料請求やお問い合わせはお気軽にどうぞ。
              </p>
              <Link
                href="/connect"
                className="inline-flex items-center gap-2 bg-orange-500 text-white px-8 py-3.5 rounded-full font-bold text-sm shadow-md hover:bg-orange-600 transition-colors transform hover:-translate-y-0.5"
              >
                お問い合わせ・資料請求 <ExternalLink size={16} />
              </Link>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}