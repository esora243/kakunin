"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  MapPin,
  Calendar,
  ArrowLeft,
  Share,
  Users,
  CheckCircle2,
  Megaphone,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthContext";
import { SaveButton } from "@/components/SaveButton";
import { useSavedItems } from "@/components/SavedItemsContext";
import { allCampaigns } from "@/lib/data";
import { siteConfig } from "@/lib/site";

/**
 * キャンペーン詳細ページ
 * - Hugmeid mock の CampaignDetail.tsx 準拠デザイン:
 *   - 上部 sticky ヘッダー
 *   - ヒーロー画像 + orange タグバッジ
 *   - 情報カード(orange-50/50 + orange-100/50 border)
 *   - 下部固定 CTA (orange-500 → rose-400 グラデーション)
 */
export default function CampaignDetailPage() {
  const params = useParams();
  const id = (params.id as string) || "";
  const router = useRouter();
  const { isLoggedIn, openLoginModal } = useAuth();
  const { isSaved, toggleSaved } = useSavedItems();

  const campaign = allCampaigns.find((item) => item.id === id);

  const handleApply = () => {
    if (!campaign) return;
    if (!isLoggedIn) {
      openLoginModal();
      return;
    }
    const applyUrl = campaign.entryUrl || siteConfig.defaultApplyUrl;
    if (applyUrl) {
      window.open(applyUrl, "_blank", "noopener,noreferrer");
      return;
    }
    toast.info("エントリー先URLが未設定です。entryUrl を追加してください。");
  };

  const handleSave = () => {
    if (!campaign) return;
    if (!isLoggedIn) {
      openLoginModal();
      return;
    }
    const saved = toggleSaved("campaign", campaign.id);
    toast.success(saved ? "キャンペーンを保存しました" : "保存を解除しました");
  };

  if (!campaign) {
    return (
      <div className="w-full max-w-lg mx-auto bg-white min-h-screen p-6 flex flex-col items-center justify-center text-center">
        <Megaphone className="text-orange-200 mb-4" size={44} />
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          キャンペーンが見つかりません
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          このキャンペーンは削除されたか、まだ登録されていません。
        </p>
        <Link
          href="/campaign"
          className="bg-orange-500 text-white font-bold py-3 px-6 rounded-full hover:bg-orange-600 transition-colors"
        >
          キャンペーン一覧へ戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto bg-white min-h-screen animate-slide-in-right">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-orange-50 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          aria-label="戻る"
          className="p-2 -ml-2 text-gray-500 hover:bg-orange-50 rounded-full transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="font-bold text-sm text-gray-800">キャンペーン詳細</span>
        <button
          aria-label="共有"
          className="p-2 -mr-2 text-gray-500 hover:bg-orange-50 rounded-full transition-colors"
        >
          <Share size={18} />
        </button>
      </header>

      <div className="relative w-full h-56 bg-gray-100">
        {campaign.img ? (
          <img src={campaign.img} alt={campaign.title} className="w-full h-full object-cover" />
        ) : null}
        <div className="absolute top-4 left-4 bg-orange-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm">
          {campaign.tag}
        </div>
      </div>

      <div className="p-4 space-y-6 pb-28">
        <div>
          <h2 className="text-xl font-bold text-gray-800 leading-snug mb-3">
            {campaign.title}
          </h2>
          <div className="flex items-center gap-2 text-sm text-gray-500 border-b border-orange-50 pb-4">
            <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center font-bold text-xs">
              C
            </div>
            <span>{campaign.company}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <InfoCard
            icon={<Calendar size={18} />}
            label="開催日時"
            value={
              <>
                {campaign.date}
                <br />
                <span className="text-xs font-normal text-gray-600">{campaign.time}</span>
              </>
            }
          />
          <InfoCard
            icon={<MapPin size={18} />}
            label="開催場所"
            value={campaign.location}
          />
          <InfoCard
            icon={<Users size={18} />}
            label="対象・定員"
            value={
              <>
                {campaign.target}
                <br />
                <span className="text-xs font-normal text-gray-600">
                  定員: {campaign.capacity}
                </span>
              </>
            }
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-base font-bold text-gray-800 flex items-center gap-2 border-b border-orange-100 pb-2">
            <span className="w-1.5 h-4 bg-orange-400 rounded-full" />
            プログラム内容
          </h3>
          <div className="text-sm text-gray-600 leading-relaxed space-y-4">
            <p>{campaign.description}</p>
            <div className="bg-white border border-orange-50 rounded-xl p-4 shadow-sm">
              <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-1.5 text-sm">
                <CheckCircle2 size={16} className="text-orange-500" /> 特典・メリット
              </h4>
              {campaign.benefits && campaign.benefits.length > 0 ? (
                <ul className="list-disc list-inside text-xs space-y-1.5 ml-1 text-gray-600">
                  {campaign.benefits.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500">
                  benefits を追加するとここに表示されます。
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-orange-100 p-3 pb-safe z-40 shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
        <div className="max-w-lg mx-auto flex gap-3">
          <SaveButton saved={isSaved("campaign", campaign.id)} onClick={handleSave} />
          <button
            onClick={handleApply}
            className="flex-1 bg-gradient-to-r from-orange-500 to-rose-400 hover:from-orange-600 hover:to-rose-500 text-white font-bold rounded-xl flex justify-center items-center gap-2 shadow-sm hover:shadow-md transition-all active:scale-[0.98] py-3"
          >
            エントリーする
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="bg-orange-50/50 p-3 rounded-xl flex items-start gap-3 border border-orange-100/50">
      <span className="text-orange-500 mt-0.5">{icon}</span>
      <div>
        <div className="text-xs text-gray-500 mb-0.5">{label}</div>
        <div className="text-sm font-bold text-gray-800">{value}</div>
      </div>
    </div>
  );
}
