"use client";

import Link from "next/link";
import { Bookmark, Briefcase, Megaphone, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { useSavedItems } from "@/components/SavedItemsContext";
import { allCampaigns, allJobs } from "@/lib/data";

export default function SavedPage() {
  const { isLoggedIn, openLoginModal } = useAuth();
  const { savedItems, hydrated, removeSaved } = useSavedItems();

  if (!isLoggedIn) {
    return (
      <div className="w-full max-w-lg mx-auto p-4 flex flex-col items-center justify-center min-h-[60vh]">
        <Bookmark size={48} className="text-orange-200 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">保存機能</h2>
        <p className="text-sm text-gray-500 mb-6 text-center">保存した求人やキャンペーンを見るにはログインが必要です</p>
        <button onClick={openLoginModal} className="bg-orange-500 text-white font-bold py-3 px-8 rounded-full shadow-sm hover:bg-orange-600 transition-colors">ログインする</button>
      </div>
    );
  }

  const resolvedItems = savedItems
    .map((entry) => {
      if (entry.type === "job") {
        const job = allJobs.find((item) => String(item.id) === entry.id);
        if (!job) return null;
        return {
          key: `job-${entry.id}`,
          href: `/jobs/${entry.id}`,
          title: job.title,
          subtitle: job.company,
          meta: `${job.location} / ${job.salaryDisplay}`,
          typeLabel: "求人",
          type: entry.type,
          id: entry.id,
        };
      }

      const campaign = allCampaigns.find((item) => item.id === entry.id);
      if (!campaign) return null;
      return {
        key: `campaign-${entry.id}`,
        href: `/campaign/${entry.id}`,
        title: campaign.title,
        subtitle: campaign.company,
        meta: `${campaign.date} / ${campaign.location}`,
        typeLabel: "キャンペーン",
        type: entry.type,
        id: entry.id,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <div className="w-full max-w-lg mx-auto pb-20 animate-fade-in">
      <div className="sticky top-[110px] z-30 bg-[#FFF9FA]/90 backdrop-blur-md pt-2 pb-3 px-4 border-b border-orange-100">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Bookmark className="text-orange-500" /> 保存済み
        </h2>
      </div>
      <div className="px-4 pt-6 space-y-4">
        {!hydrated ? (
          <div className="text-center text-sm text-gray-500">読み込み中...</div>
        ) : resolvedItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-orange-100 p-8 text-center">
            <Bookmark className="mx-auto text-orange-200 mb-3" size={40} />
            <p className="font-bold text-gray-800 mb-2">保存済みアイテムはまだありません</p>
            <p className="text-sm text-gray-500">求人詳細やキャンペーン詳細から保存すると、ここに一覧表示されます。</p>
          </div>
        ) : (
          resolvedItems.map((item) => (
            <div key={item.key} className="bg-white rounded-2xl border border-orange-50 p-4 shadow-sm flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
                {item.type === "job" ? <Briefcase size={20} /> : <Megaphone size={20} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-600">{item.typeLabel}</span>
                </div>
                <Link href={item.href} className="font-bold text-gray-800 hover:text-orange-600 transition-colors block line-clamp-2">
                  {item.title}
                </Link>
                <p className="text-sm text-gray-500 mt-1">{item.subtitle}</p>
                <p className="text-xs text-gray-400 mt-1">{item.meta}</p>
              </div>
              <button
                onClick={() => removeSaved(item.type, item.id)}
                className="text-gray-300 hover:text-red-500 transition-colors"
                aria-label="保存解除"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
