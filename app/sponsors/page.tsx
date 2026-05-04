"use client";

import Link from "next/link";
import { ExternalLink, Play, Building2 } from "lucide-react";
import { allSponsors } from "@/lib/data";

export default function SponsorsPage() {
  const platinumSponsors = allSponsors.filter((s) => s.tier === "platinum");
  const goldSponsors = allSponsors.filter((s) => s.tier === "gold");
  const supporters = allSponsors.filter((s) => s.tier === "supporter");

  return (
    <div className="w-full max-w-4xl mx-auto pb-12">
      <div className="sticky top-[10px] z-30 bg-white/80 backdrop-blur-md border-b border-pink-50 px-4 py-3.5 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800 tracking-tight">パートナー企業のご紹介</h2>
        <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">スポンサー・協賛企業データを登録すると、ここに掲載されます。</p>
      </div>
      <div className="px-4 pt-3 space-y-8">
        {allSponsors.length === 0 ? (
          <section className="bg-white rounded-3xl border border-pink-100 p-10 text-center">
            <Building2 className="mx-auto text-pink-200 mb-3" size={42} />
            <h3 className="text-xl font-bold text-gray-800 mb-2">スポンサー情報は未登録です</h3>
            <p className="text-sm text-gray-500">lib/data.ts の allSponsors に本番データを追加すると、このページに自動反映されます。</p>
          </section>
        ) : null}

        {platinumSponsors.length > 0 && (
          <section>
            <div className="flex flex-col items-center mb-8">
              <span className="text-pink-500 text-[10px] font-extrabold tracking-[0.2em] mb-1">PLATINUM PARTNERS</span>
              <h3 className="text-2xl font-bold text-gray-800">プレミアムパートナー</h3>
            </div>
            <div className="space-y-10">
              {platinumSponsors.map((sponsor) => (
                <div key={sponsor.id} className="bg-white rounded-3xl shadow-md border border-pink-100 overflow-hidden">
                  <a href={sponsor.url || "#"} target="_blank" rel="noopener noreferrer" className="block relative w-full h-64 sm:h-80 group overflow-hidden">
                    {sponsor.bannerImage ? <img src={sponsor.bannerImage} alt={sponsor.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" /> : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-6">
                      <span className="bg-pink-500 text-white text-[10px] font-bold px-3 py-1 rounded-full w-max mb-3">PLATINUM</span>
                      <h4 className="text-white text-2xl font-bold mb-2">{sponsor.name}</h4>
                      <p className="text-gray-200 text-sm line-clamp-2 max-w-lg">{sponsor.description}</p>
                    </div>
                  </a>
                  <div className="p-6 bg-[#FDFBF7]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {sponsor.products?.map((product, idx) => (
                        <div key={idx} className="flex flex-col bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                          <span className="text-xs font-bold text-pink-500 mb-2 flex items-center gap-1"><Building2 size={14} /> PICK UP</span>
                          {product.image ? <img src={product.image} alt={product.name} className="w-full h-32 object-cover rounded-xl mb-3" /> : null}
                          <h5 className="font-bold text-gray-800 text-sm mb-1">{product.name}</h5>
                          <p className="text-xs text-gray-600 mb-3 flex-1">{product.description}</p>
                          <a href={sponsor.url || "#"} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-pink-500 inline-flex items-center gap-1 hover:text-pink-600">詳細を見る <ExternalLink size={12} /></a>
                        </div>
                      ))}
                      {sponsor.video && (
                        <div className="flex flex-col bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                          <span className="text-xs font-bold text-pink-500 mb-2 flex items-center gap-1"><Play size={14} /> VIDEO</span>
                          <a href={sponsor.url || "#"} target="_blank" rel="noopener noreferrer" className="block relative w-full h-32 rounded-xl overflow-hidden group bg-black mb-3">
                            {sponsor.video.thumbnail ? <img src={sponsor.video.thumbnail} alt={sponsor.video.title} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" /> : null}
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center group-hover:bg-pink-500 group-hover:scale-110 transition-all shadow-lg"><Play size={20} className="text-pink-500 group-hover:text-white ml-1" /></div>
                            </div>
                            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded">{sponsor.video.duration}</div>
                          </a>
                          <h5 className="font-bold text-gray-800 text-sm mb-1 line-clamp-1">{sponsor.video.title}</h5>
                          <p className="text-xs text-gray-500 line-clamp-2">動画紹介リンクを設置できます。</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {goldSponsors.length > 0 && (
          <section>
            <div className="flex flex-col items-center mb-8">
              <span className="text-gray-400 text-[10px] font-extrabold tracking-[0.2em] mb-1">GOLD PARTNERS</span>
              <h3 className="text-xl font-bold text-gray-700">公式スポンサー</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {goldSponsors.map((sponsor) => (
                <a key={sponsor.id} href={sponsor.url || "#"} target="_blank" rel="noopener noreferrer" className="block relative h-48 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group border border-gray-100">
                  {sponsor.bannerImage ? <img src={sponsor.bannerImage} alt={sponsor.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-5">
                    <div className="flex items-center gap-2 mb-2">
                      {sponsor.logo ? <img src={sponsor.logo} alt="" className="w-6 h-6 rounded bg-white object-cover" /> : null}
                      <span className="text-[10px] text-pink-300 font-bold bg-black/40 px-2 py-0.5 rounded-sm">{sponsor.category}</span>
                    </div>
                    <h4 className="text-white font-bold text-sm mb-1">{sponsor.name}</h4>
                    <p className="text-gray-300 text-xs line-clamp-2">{sponsor.description}</p>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {supporters.length > 0 && (
          <section>
            <div className="flex flex-col items-center mb-6"><h3 className="text-lg font-bold text-gray-600">サポーター様</h3></div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {supporters.map((sponsor) => (
                <a key={sponsor.id} href={sponsor.url || "#"} target="_blank" rel="noopener noreferrer" className="aspect-square bg-white rounded-xl border border-gray-200 p-4 flex flex-col items-center justify-center hover:border-pink-300 hover:shadow-md transition-all group">
                  {sponsor.logo ? <img src={sponsor.logo} alt={sponsor.name} className="w-10 h-10 object-contain grayscale group-hover:grayscale-0 transition-all mb-2" /> : null}
                  <span className="text-[9px] text-center text-gray-500 font-medium line-clamp-2">{sponsor.name}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        <section className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-3xl p-8 border border-pink-100 text-center shadow-sm mt-8">
          <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4"><Building2 size={24} className="text-pink-500" /></div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">スポンサー/掲載企業様を募集しております</h3>
          <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto leading-relaxed">企業情報掲載や資料請求導線もこのまま運用できます。</p>
          <Link href="/connect" className="inline-flex items-center gap-2 bg-pink-500 text-white px-8 py-3.5 rounded-full font-bold text-sm shadow-md hover:bg-pink-600 transition-colors transform hover:-translate-y-0.5">お問い合わせ・資料請求 <ExternalLink size={16} /></Link>
        </section>
      </div>
    </div>
  );
}
