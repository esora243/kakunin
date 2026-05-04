"use client";

import { useEffect, useState } from "react";
import { Gift, Calendar, Loader2, ChevronRight, ExternalLink, Building2 } from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";

export default function CampaignPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCampaigns() {
      setLoading(true);
      try {
        const data = await supabaseRestFetch<any[]>({ path: "campaigns?select=*" });
        setCampaigns(data || []);
      } catch (error) {
        console.error("キャンペーンデータの取得に失敗しました:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchCampaigns();
  }, []);

  return (
    <div className="w-full max-w-lg mx-auto pb-20 bg-white min-h-screen animate-fade-in">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-4">
        <h2 className="text-2xl font-bold text-gray-800">キャンペーン・特典</h2>
        <p className="text-xs text-gray-400 mt-1">医学生限定のお得な情報</p>
      </div>

      <div className="px-4 pt-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-orange-500 mb-4" size={40} />
            <p className="text-gray-500 font-bold">読み込み中...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="bg-gray-50 rounded-2xl p-10 text-center border border-dashed border-gray-200">
            <Gift className="mx-auto text-gray-300 mb-3" size={48} />
            <p className="text-gray-500 font-bold">現在開催中のキャンペーンはありません</p>
          </div>
        ) : (
          <div className="space-y-6">
            {campaigns.map((camp) => (
              <div
                key={camp.id}
                className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all"
              >
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 size={16} className="text-orange-500" />
                    <span className="text-xs font-bold text-gray-500">{camp.company}</span>
                  </div>
                  
                  <h3 className="font-bold text-xl text-gray-800 mb-3 leading-tight">
                    {camp.title}
                  </h3>
                  
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">
                    {camp.description}
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold">
                      <Calendar size={14} />
                      <span>掲載日: {new Date(camp.created_at).toLocaleDateString()}</span>
                    </div>
                    <button className="flex items-center gap-1.5 text-sm font-bold text-orange-500 bg-orange-50 px-4 py-2 rounded-full hover:bg-orange-100 transition-colors">
                      詳細を見る <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}