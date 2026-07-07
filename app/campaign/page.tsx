"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Gift,
  Calendar,
  Loader2,
  ChevronRight,
  Building2,
} from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";
import { FloatingBanner } from "@/components/FloatingBanner";

/**
 * キャンペーン一覧ページ
 * - Hugmeid mock の Campaign.tsx + Sponsors.tsx の融合デザイン:
 *   - sticky ヘッダー(orange-100 border)
 *   - 白カード(rounded-3xl + border-[#F2F4F8]) リスト
 *   - 各カードに会社名 / タイトル / 説明 / CTAボタン(orange-50背景)
 * - kakunin の Supabase 連携(campaigns テーブル) を保持。
 */
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
    void fetchCampaigns();
  }, []);

  return (
    <div className="w-full max-w-lg mx-auto pb-20 bg-white min-h-screen animate-fade-in">
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#B9C2DB] px-4 py-4 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-800">キャンペーン・特典</h2>
        <p className="text-xs text-gray-400 mt-1">医学生限定のお得な情報</p>
      </div>

      <div className="pt-3">
        <FloatingBanner
          campaignId="6"
          title="Premiumスポンサー特集 in Hugmeid"
          imageUrl="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=1080"
          sponsorName="Hugmeid 編集部"
        />
      </div>

      <div className="px-4 pt-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-[#1E3A8A] mb-4" size={40} />
            <p className="text-gray-500 font-bold">読み込み中...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-dashed border-[#B9C2DB]">
            <Gift className="mx-auto text-[#B9C2DB] mb-3" size={48} />
            <p className="text-gray-500 font-bold">現在開催中のキャンペーンはありません</p>
          </div>
        ) : (
          <div className="space-y-6">
            {campaigns.map((camp) => (
              <Link
                key={camp.id}
                href={`/campaign/${camp.id}`}
                className="block bg-white rounded-3xl border border-[#F2F4F8] overflow-hidden shadow-sm hover:shadow-md transition-all group"
              >
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 size={16} className="text-[#1E3A8A]" />
                    <span className="text-xs font-bold text-gray-500">{camp.company}</span>
                  </div>

                  <h3 className="font-bold text-xl text-gray-800 mb-3 leading-tight group-hover:text-[#11204C] transition-colors">
                    {camp.title}
                  </h3>

                  <p className="text-sm text-gray-600 leading-relaxed mb-4">
                    {camp.description}
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-[#F2F4F8]">
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold">
                      <Calendar size={14} />
                      <span>
                        掲載日:{" "}
                        {camp.created_at
                          ? new Date(camp.created_at).toLocaleDateString("ja-JP")
                          : "未設定"}
                      </span>
                    </div>
                    <span className="flex items-center gap-1.5 text-sm font-bold text-[#1E3A8A] bg-[#F2F4F8] px-4 py-2 rounded-full">
                      詳細を見る <ChevronRight size={16} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
