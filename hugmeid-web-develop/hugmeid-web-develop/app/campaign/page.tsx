"use client";

import Link from "next/link";
import { Calendar, Clock, MapPin, Megaphone } from "lucide-react";
import { allCampaigns } from "@/lib/data";

export default function CampaignPage() {
  return (
    <div className="w-full max-w-lg mx-auto pb-8 animate-fade-in">
      <div className="sticky top-[10px] z-30 bg-white/95 backdrop-blur-md border-b border-pink-100 px-4 py-4">
        <h2 className="text-xl font-bold text-gray-800">キャンペーン</h2>
        <p className="text-xs text-gray-500 mt-1">説明会や見学会などの募集情報を掲載します。</p>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {allCampaigns.length === 0 ? (
          <div className="bg-white rounded-2xl border border-pink-100 p-8 text-center">
            <Megaphone className="mx-auto text-pink-200 mb-3" size={40} />
            <p className="text-gray-700 font-bold mb-2">公開中のキャンペーンはありません</p>
            <p className="text-sm text-gray-500">lib/data.ts の allCampaigns に本番データを追加すると、ここに表示されます。</p>
          </div>
        ) : (
          allCampaigns.map((campaign) => (
            <Link key={campaign.id} href={`/campaign/${campaign.id}`} className="block bg-white rounded-2xl shadow-sm border border-pink-50 overflow-hidden hover:shadow-md transition-shadow group">
              <div className="relative h-44 bg-gray-100">
                {campaign.img ? <img src={campaign.img} alt={campaign.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute top-3 left-3 bg-pink-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">{campaign.tag}</div>
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <h3 className="font-bold leading-snug">{campaign.title}</h3>
                  <p className="text-xs text-white/90 mt-1">{campaign.company}</p>
                </div>
              </div>
              <div className="p-4 space-y-2 text-xs text-gray-600">
                <div className="flex items-center gap-2"><Calendar size={14} className="text-pink-400" /> {campaign.date}</div>
                <div className="flex items-center gap-2"><Clock size={14} className="text-pink-400" /> {campaign.time}</div>
                <div className="flex items-center gap-2"><MapPin size={14} className="text-pink-400" /> {campaign.location}</div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
