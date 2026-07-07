"use client";

import Link from "next/link";
import { Bookmark, Briefcase, Megaphone, Newspaper, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { useSavedItems } from "@/components/SavedItemsContext";
import { allCampaigns, allJobs } from "@/lib/data";
import { getAllArticles } from "@/lib/articles";

/**
 * 保存済みページ
 * - 求人 / キャンペーン / 記事 の3種を横断表示する。
 * - 記事は lib/articles.ts（articles.json）からのみ解決し、不整合を排除。
 * - id は String 化済みなので、SavedItemsContext 側の id と完全一致する。
 */
export default function SavedPage() {
  const { isLoggedIn, openLoginModal } = useAuth();
  const { savedItems, hydrated, removeSaved } = useSavedItems();

  if (!isLoggedIn) {
    return (
      <div className="w-full max-w-lg mx-auto p-4 flex flex-col items-center justify-center min-h-[60vh]">
        <Bookmark size={48} className="text-[#B9C2DB] mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">保存機能</h2>
        <p className="text-sm text-gray-500 mb-6 text-center">
          保存した求人やキャンペーン・記事を見るにはログインが必要です
        </p>
        <button
          onClick={openLoginModal}
          className="bg-[#F2F4F8]0 text-white font-bold py-3 px-8 rounded-full shadow-sm hover:bg-[#11204C] transition-colors"
        >
          ログインする
        </button>
      </div>
    );
  }

  // 全記事を1回だけ取得
  const allArticles = getAllArticles();

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
          icon: "job" as const,
          type: entry.type,
          id: entry.id,
        };
      }

      if (entry.type === "campaign") {
        const campaign = allCampaigns.find((item) => item.id === entry.id);
        if (!campaign) return null;
        return {
          key: `campaign-${entry.id}`,
          href: `/campaign/${entry.id}`,
          title: campaign.title,
          subtitle: campaign.company,
          meta: `${campaign.date} / ${campaign.location}`,
          typeLabel: "キャンペーン",
          icon: "campaign" as const,
          type: entry.type,
          id: entry.id,
        };
      }

      // article
      const article = allArticles.find((a) => String(a.id) === entry.id);
      if (!article) return null;
      const href = article.type === "school" ? `/school/articles/${article.id}` : `/articles/${article.id}`;
      return {
        key: `article-${entry.id}`,
        href,
        title: article.title,
        subtitle: article.category,
        meta: article.date ? article.date.replace(/-/g, "/") : "",
        typeLabel: "記事",
        icon: "article" as const,
        type: entry.type,
        id: entry.id,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <div className="w-full max-w-lg mx-auto pb-20 animate-fade-in">
      <div className="sticky top-0 z-30 bg-[#F2F4F8]/90 backdrop-blur-md pt-4 pb-3 px-4 border-b border-[#B9C2DB]">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Bookmark className="text-[#1E3A8A]" /> 保存済み
        </h2>
      </div>

      <div className="px-4 pt-6 space-y-4">
        {!hydrated ? (
          <div className="text-center text-sm text-gray-500">読み込み中...</div>
        ) : resolvedItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#B9C2DB] p-8 text-center">
            <Bookmark className="mx-auto text-[#B9C2DB] mb-3" size={40} />
            <p className="font-bold text-gray-800 mb-2">保存済みアイテムはまだありません</p>
            <p className="text-sm text-gray-500">
              記事・求人・キャンペーン詳細から保存すると、ここに一覧表示されます。
            </p>
          </div>
        ) : (
          resolvedItems.map((item) => (
            <div
              key={item.key}
              className="bg-white rounded-2xl border border-[#F2F4F8] p-4 shadow-sm flex items-start gap-3"
            >
              <div className="w-11 h-11 rounded-xl bg-[#F2F4F8] text-[#1E3A8A] flex items-center justify-center shrink-0">
                {item.icon === "job" ? (
                  <Briefcase size={20} />
                ) : item.icon === "campaign" ? (
                  <Megaphone size={20} />
                ) : (
                  <Newspaper size={20} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#B9C2DB]/40 text-[#11204C]">
                    {item.typeLabel}
                  </span>
                </div>
                <Link
                  href={item.href}
                  className="font-bold text-gray-800 hover:text-[#11204C] transition-colors block line-clamp-2"
                >
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
