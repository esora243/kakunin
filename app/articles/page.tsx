"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Loader2,
  Newspaper,
  Image as ImageIcon,
  Megaphone,
  Bookmark,
  BookmarkCheck,
  PenSquare,
  Send,
  X,
  Sparkles,
  Coffee,      // 追加インポート
  Briefcase,   // 追加インポート
} from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";
import { getAllArticles, sortArticlesByDateDesc } from "@/lib/articles";
import type { Article } from "@/lib/types";
import { useSavedItems } from "@/components/SavedItemsContext";
import { FloatingBanner } from "@/components/FloatingBanner";

// 1. タブの型を5つに拡張
type ArticleTab = "favorite" | "all" | "study" | "life" | "career";

export default function ArticlesPage() {
  const baseArticles: Article[] = useMemo(() => sortArticlesByDateDesc(getAllArticles()), []);
  const [extraArticles, setExtraArticles] = useState<Article[]>([]);
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ArticleTab>("all");

  const [showComposer, setShowComposer] = useState(false);
  const [composerBody, setComposerBody] = useState(""); 

  const { isSaved, toggleSaved, hydrated } = useSavedItems();

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      try {
        const [articleData, sponsorData] = await Promise.all([
          supabaseRestFetch<any[]>({ path: "articles?select=*" }).catch(() => [] as any[]),
          supabaseRestFetch<any[]>({ path: "sponsors" }).catch(() => [] as any[]),
        ]);

        if (!cancelled) {
          const normalized: Article[] = (articleData || []).map((a: any) => ({
            id: String(a.id ?? ""),
            type: a.type === "activity" ? "activity" : "school",
            title: a.title ?? "",
            category: a.category ?? "未分類",
            date: a.publish_date ?? a.date ?? "",
            image: a.image_url ?? a.image ?? "",
            excerpt: a.excerpt ?? "",
            content: a.content ?? "",
          }));
          setExtraArticles(normalized);
          setSponsors(sponsorData || []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  const allArticles: Article[] = useMemo(() => {
    const seen = new Set(baseArticles.map((a) => String(a.id)));
    const merged = [...baseArticles];
    for (const a of extraArticles) {
      if (!seen.has(String(a.id))) merged.push(a);
    }
    return sortArticlesByDateDesc(merged);
  }, [baseArticles, extraArticles]);

  // 2. タブ別の絞り込みロジックを拡張
  const tabFiltered = useMemo(() => {
    if (activeTab === "favorite") {
      return allArticles.filter((a) => isSaved("article", a.id));
    }
    if (activeTab === "study") return allArticles.filter((a) => a.category === "学習法");
    if (activeTab === "life") return allArticles.filter((a) => a.category === "学生生活");
    if (activeTab === "career") return allArticles.filter((a) => a.category === "キャリア");
    
    return allArticles;
  }, [allArticles, activeTab, isSaved]);

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tabFiltered;
    return tabFiltered.filter((article) => {
      const title = (article.title || "").toLowerCase();
      const excerpt = (article.excerpt || "").toLowerCase();
      const cat = (article.category || "").toLowerCase();
      return title.includes(q) || excerpt.includes(q) || cat.includes(q);
    });
  }, [tabFiltered, searchQuery]);

  const getArticleHref = (article: Article) => {
    if (article.type === "activity") return `/articles/${article.id}`;
    if (article.type === "school") return `/school/articles/${article.id}`;
    return `/articles/${article.id}`;
  };

  const handleSponsorClick = async (sponsorId: number) => {
    if (!sponsorId) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/increment_click`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ row_id: sponsorId }),
      });
    } catch (e) {
      console.error("クリック集計エラー:", e);
    }
  };

  const handleSubmitArticle = () => {
    const googleFormUrl = "https://docs.google.com/forms/"; 
    window.open(googleFormUrl, "_blank");
  };

  return (
    <div className="w-full max-w-lg mx-auto pb-8 bg-white min-h-screen animate-fade-in">
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#B9C2DB] px-4 py-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">記事</h2>
          <button
            onClick={() => setShowComposer((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#F2F4F8] text-white text-xs font-bold shadow-sm hover:bg-[#11204C] transition-colors active:scale-95"
            aria-label="記事を発信する"
          >
            <PenSquare size={14} /> 記事を発信
          </button>
        </div>

        <div className="relative mb-3">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="記事を検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#F2F4F8] sm:text-sm transition-colors"
          />
        </div>

        {/* 3. 横スクロール可能な5つのタブ */}
        <div className="flex gap-2 bg-[#F2F4F8]/60 p-1 rounded-xl overflow-x-auto [&::-webkit-scrollbar]:hidden snap-x">
          <TabButton
            active={activeTab === "favorite"}
            onClick={() => setActiveTab("favorite")}
            icon={<BookmarkCheck size={14} />}
            label="お気に入り"
          />
          <TabButton
            active={activeTab === "all"}
            onClick={() => setActiveTab("all")}
            icon={<Newspaper size={14} />}
            label="すべて"
          />
          <TabButton
            active={activeTab === "study"}
            onClick={() => setActiveTab("study")}
            icon={<Sparkles size={14} />}
            label="学習法"
          />
          <TabButton
            active={activeTab === "life"}
            onClick={() => setActiveTab("life")}
            icon={<Coffee size={14} />}
            label="学生生活"
          />
          <TabButton
            active={activeTab === "career"}
            onClick={() => setActiveTab("career")}
            icon={<Briefcase size={14} />}
            label="キャリア"
          />
        </div>
      </div>

      {showComposer && (
        <div className="mx-4 mt-4 bg-white border border-[#B9C2DB] rounded-2xl shadow-sm p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <PenSquare size={16} className="text-[#1E3A8A]" /> 記事を発信する
            </h3>
            <button
              onClick={() => setShowComposer(false)}
              className="text-gray-400 hover:text-gray-700"
              aria-label="閉じる"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              記事の投稿は専用のGoogleフォームから受け付けています。以下のボタンから投稿をお願いします。
            </p>

            <textarea
              placeholder="本文（文字のみ。相互編集メモにも使えます）"
              value={composerBody}
              onChange={(e) => setComposerBody(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm leading-relaxed focus:ring-2 focus:ring-orange-100 focus:outline-none resize-y"
            />

            <button
              onClick={handleSubmitArticle}
              disabled={!composerBody.trim()}
              className="w-full inline-flex items-center justify-center gap-2 py-3 bg-orange-500 text-white rounded-xl font-bold disabled:opacity-40 hover:bg-orange-600 transition-colors"
            >
              <Send size={16} /> 投稿フォームを開く
            </button>

            <p className="text-[11px] text-gray-500 leading-relaxed mt-2">
              ※ ブラウザが開き、外部サイト（Googleフォーム）へ移動します。
            </p>
          </div>
        </div>
      )}

      <div className="pt-3">
        <FloatingBanner
          campaignId="7"
          title="医学生向け奨学金プログラム説明会"
          imageUrl="https://images.unsplash.com/photo-1603726574690-cc3138bfec8c?auto=format&fit=crop&q=80&w=1080"
          sponsorName="公益財団法人 未来医療基金"
        />
      </div>

      <div className="px-4 pt-1 space-y-3 pb-6">
        {loading && !hydrated ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-[#1E3A8A]" size={32} />
          </div>
        ) : filteredArticles.length === 0 ? (
          <EmptyState
            tab={activeTab}
            onClearSearch={() => {
              setSearchQuery("");
              setActiveTab("all");
            }}
          />
        ) : (
          filteredArticles.map((article, index) => {
            const saved = isSaved("article", article.id);
            const formattedDate = article.date ? article.date.replace(/-/g, "/") : "";

            const showSponsor = (index + 1) % 3 === 0;
            const sponsorIndex = Math.floor(index / 3) % (sponsors.length || 1);
            const sponsor = sponsors[sponsorIndex];

            return (
              <div key={`${article.type || "default"}-${article.id}`}>
                <div className="relative">
                  <Link
                    href={getArticleHref(article)}
                    className="block bg-white rounded-xl shadow-sm border border-[#F2F4F8] overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className="flex">
                      {article.image ? (
                        <img
                          src={article.image}
                          alt={article.title}
                          className="w-14 h-14 object-cover shrink-0 bg-[#F2F4F8] rounded-lg m-3"
                        />
                      ) : (
                        <div className="w-14 h-14 shrink-0 bg-gray-100 flex flex-col items-center justify-center text-gray-300 rounded-lg m-3">
                          <ImageIcon size={16} />
                        </div>
                      )}
                      <div className="p-3 pr-10 flex flex-col justify-center min-w-0 flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-[#1E3A8A] font-bold px-1.5 py-0.5 bg-[#F2F4F8] rounded-sm truncate max-w-[60%]">
                            {article.category || "未分類"}
                          </span>
                          <span className="text-[10px] text-gray-400 shrink-0">{formattedDate}</span>
                        </div>
                        <h4 className="text-sm font-bold text-gray-800 line-clamp-2 mb-1 leading-tight">
                          {article.title}
                        </h4>
                        <p className="text-xs text-gray-500 line-clamp-2 leading-tight">
                          {article.excerpt || "本文がありません"}
                        </p>
                      </div>
                    </div>
                  </Link>

                  <button
                    onClick={() => toggleSaved("article", article.id)}
                    className={`absolute top-2 right-2 w-8 h-8 rounded-full backdrop-blur-sm flex items-center justify-center transition-colors active:scale-90 ${
                      saved ? "bg-[#1E3A8A] text-white" : "bg-white/90 text-gray-400 hover:text-[#1E3A8A] border border-gray-200"
                    }`}
                    aria-label={saved ? "お気に入りから外す" : "お気に入りに追加"}
                  >
                    {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                  </button>
                </div>

                {showSponsor && sponsor?.name && sponsor?.url && (
                  <div className="mt-3 bg-[#F2F4F8] border border-[#B9C2DB] rounded-xl p-3 flex items-center gap-3 shadow-sm">
                    <Megaphone className="text-[#1E3A8A] shrink-0" size={20} />
                    <div className="flex-1 overflow-hidden">
                      <p className="text-[10px] text-[#1E3A8A] font-bold uppercase tracking-wider mb-0.5">Sponsored</p>
                      <p className="text-sm font-bold text-gray-800 truncate">{sponsor.name}</p>
                    </div>
                    <a
                      href={sponsor.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleSponsorClick(sponsor.id)}
                      className="text-[#1E3A8A] text-xs font-bold underline shrink-0"
                    >
                      詳細へ
                    </a>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// 4. スマホで5つ並んでも崩れないように shrink-0 と px-3 を指定
function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 snap-start flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
        active ? "bg-white text-[#11204C] shadow-sm" : "text-gray-500 hover:text-gray-700"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// 5. 各タブに対応するメッセージを更新
function EmptyState({ tab, onClearSearch }: { tab: ArticleTab; onClearSearch: () => void }) {
  const messageMap: Record<ArticleTab, string> = {
    favorite: "お気に入りに追加した記事がここに表示されます",
    all: "条件に一致する記事が見つかりません",
    study: "学習法カテゴリの記事はまだありません",
    life: "学生生活カテゴリの記事はまだありません",
    career: "キャリアカテゴリの記事はまだありません",
  };

  return (
    <div className="text-center py-10 bg-white rounded-xl border border-dashed border-[#B9C2DB]">
      <Newspaper className="mx-auto text-[#B9C2DB] mb-2" size={32} />
      <p className="text-gray-500 text-sm font-bold">{messageMap[tab]}</p>
      {tab !== "favorite" && (
        <button onClick={onClearSearch} className="mt-2 text-[#1E3A8A] text-xs font-bold underline">
          検索条件をクリア
        </button>
      )}
    </div>
  );
}
