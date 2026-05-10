"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  Plane,
  ExternalLink,
  Instagram,
  Twitter,
  Mail,
  Newspaper,
  Search,
  Loader2,
} from "lucide-react";
import { activityArticles, studentGroups, studyAbroadPrograms } from "@/lib/data";
import { supabaseRestFetch } from "@/lib/supabase/rest";
import { FloatingBanner } from "@/components/FloatingBanner";

/**
 * 課外活動ページ
 * - Hugmeid mock の Activities.tsx の sticky ヘッダー / orange タブ /
 *   FloatingBanner 配置 / カードデザイン(rounded-2xl + border-orange-50) を反映。
 * - kakunin の Supabase 連携、検索・カテゴリフィルタ、ダミーデータfallback を保持。
 * - 画面遷移書: 団体一覧 → 団体個別 / 留学一覧 → 個別 / 記事一覧 → 個別 を踏襲。
 */
export default function ActivitiesPage() {
  const [activeTab, setActiveTab] = useState<"groups" | "study-abroad" | "articles">("groups");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("すべて");

  const [groupsData, setGroupsData] = useState<any[]>([]);
  const [programsData, setProgramsData] = useState<any[]>([]);
  const [articlesData, setArticlesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      try {
        const [gRes, pRes, aRes] = await Promise.all([
          supabaseRestFetch<any[]>({ path: "student_groups?select=*" }).catch(() => []),
          supabaseRestFetch<any[]>({ path: "study_abroad_programs?select=*" }).catch(() => []),
          supabaseRestFetch<any[]>({ path: "articles?type=eq.activity&select=*" }).catch(
            () => [],
          ),
        ]);
        if (!cancelled) {
          setGroupsData(gRes || []);
          setProgramsData(pRes || []);
          setArticlesData(aRes || []);
        }
      } catch (error) {
        console.error("データの取得に失敗しました", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayGroups = groupsData.length > 0 ? groupsData : studentGroups;
  const displayPrograms = programsData.length > 0 ? programsData : studyAbroadPrograms;
  const displayArticles = articlesData.length > 0 ? articlesData : activityArticles;

  const hasContent = useMemo(
    () =>
      displayGroups.length > 0 || displayPrograms.length > 0 || displayArticles.length > 0,
    [displayGroups, displayPrograms, displayArticles],
  );

  const CATEGORIES = useMemo(
    () => [
      "すべて",
      ...Array.from(new Set(displayArticles.map((a: any) => a.category).filter(Boolean))),
    ],
    [displayArticles],
  );

  const filteredArticles = useMemo(() => {
    return displayArticles.filter((article: any) => {
      const query = searchQuery.trim().toLowerCase();
      const matchQuery = !query || `${article.title}`.toLowerCase().includes(query);
      const matchCategory =
        selectedCategory === "すべて" || article.category === selectedCategory;
      return matchQuery && matchCategory;
    });
  }, [displayArticles, searchQuery, selectedCategory]);

  return (
    <div className="w-full max-w-lg mx-auto pb-8 animate-slide-in-right">
      {/* ============================================================
          ヘッダー(タブ) - Hugmeid mock の sticky 配置
         ============================================================ */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-orange-100 px-4 py-4 shadow-sm">
        <h2 className="text-xl font-bold text-gray-800 mb-4">課外活動</h2>

        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          <TabPill
            active={activeTab === "groups"}
            onClick={() => setActiveTab("groups")}
            label="👥 学生団体"
          />
          <TabPill
            active={activeTab === "study-abroad"}
            onClick={() => setActiveTab("study-abroad")}
            label="✈️ 留学情報"
          />
          <TabPill
            active={activeTab === "articles"}
            onClick={() => setActiveTab("articles")}
            label="📝 記事"
          />
        </div>
      </div>

      {/* ============================================================
          FloatingBanner - 課外活動向け広告
         ============================================================ */}
      <div className="pt-3">
        <FloatingBanner
          campaignId="2"
          title="留学支援プログラム説明会開催中"
          imageUrl="https://images.unsplash.com/photo-1609126385558-bc3fc5082b0a?auto=format&fit=crop&q=80&w=1080"
          sponsorName="グローバル医療教育機構"
        />
      </div>

      {/* ============================================================
          コンテンツ
         ============================================================ */}
      <div className="px-4 pt-1 space-y-4">
        {loading ? (
          <div className="bg-white rounded-2xl border border-orange-100 p-8 text-center">
            <Loader2 className="mx-auto text-orange-300 mb-3 animate-spin" size={40} />
            <p className="font-bold text-gray-800">データを読み込んでいます</p>
          </div>
        ) : !hasContent ? (
          <div className="bg-white rounded-2xl border border-orange-100 p-8 text-center">
            <Users className="mx-auto text-orange-200 mb-3" size={40} />
            <p className="text-gray-700 font-bold mb-2">課外活動データは未登録です</p>
            <p className="text-sm text-gray-500">
              Supabase の student_groups / study_abroad_programs / articles に
              本番データを追加してください。
            </p>
          </div>
        ) : (
          <>
            {activeTab === "groups" &&
              displayGroups.map((group: any) => {
                const social =
                  typeof group.social_links === "string"
                    ? JSON.parse(group.social_links)
                    : group.social_links || group.social || {};
                return (
                  <Link
                    key={group.id}
                    href={`/activities/groups/${group.id}`}
                    className="block bg-white rounded-2xl shadow-sm border border-orange-50 overflow-hidden hover:shadow-md transition-shadow group"
                  >
                    <div className="relative h-40 bg-gray-100">
                      {(group.image_url || group.image) ? (
                        <img
                          src={group.image_url || group.image}
                          alt={group.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : null}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3">
                        <span className="text-[10px] font-bold bg-orange-500 text-white px-2 py-1 rounded-full">
                          {group.category}
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-gray-800 mb-2 group-hover:text-orange-600 transition-colors">
                        {group.name}
                      </h3>
                      <p className="text-xs text-gray-600 leading-relaxed mb-3 line-clamp-2">
                        {group.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Users size={14} className="text-orange-400" />
                          <span>{group.members_count || group.members}名</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {social.instagram && (
                            <Instagram size={14} className="text-orange-400" />
                          )}
                          {social.twitter && <Twitter size={14} className="text-blue-400" />}
                          {social.mail && <Mail size={14} className="text-gray-400" />}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}

            {activeTab === "study-abroad" &&
              displayPrograms.map((program: any) => (
                <div
                  key={program.id}
                  className="block bg-white rounded-2xl shadow-sm border border-orange-50 overflow-hidden hover:shadow-md transition-shadow group"
                >
                  <div className="relative h-32 bg-gray-100">
                    {(program.image_url || program.image) ? (
                      <img
                        src={program.image_url || program.image}
                        alt={program.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : null}
                    <div className="absolute top-3 left-3 bg-blue-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                      {program.country}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-gray-800 mb-2 group-hover:text-orange-600 transition-colors">
                      {program.title}
                    </h3>
                    <div className="space-y-1.5 text-xs text-gray-600 mb-3">
                      <div className="flex items-center gap-2">
                        <Plane size={12} className="text-orange-400" />
                        <span>{program.duration}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users size={12} className="text-orange-400" />
                        <span>{program.organization}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                      <span className="text-[10px] text-red-500 font-bold">
                        締切: {program.deadline}
                      </span>
                      {program.url ? (
                        <a
                          href={program.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs font-bold text-orange-500 hover:text-orange-600"
                        >
                          詳細 <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span className="text-[10px] text-gray-400">URL未設定</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

            {activeTab === "articles" && (
              <div className="space-y-4 animate-fade-in">
                {/* 検索バー */}
                <div className="relative px-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="記事を検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 sm:text-sm transition-colors"
                  />
                </div>

                <div className="flex gap-2 overflow-x-auto px-1 pb-1 hide-scrollbar">
                  {CATEGORIES.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                        selectedCategory === category
                          ? "bg-gray-800 border-gray-800 text-white"
                          : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                {filteredArticles.length === 0 && displayArticles.length > 0 && (
                  <div className="bg-white rounded-2xl border border-orange-100 p-8 text-center mt-4">
                    <Newspaper className="mx-auto text-orange-200 mb-3" size={40} />
                    <p className="font-bold text-gray-800 mb-2">該当する記事がありません</p>
                  </div>
                )}

                {filteredArticles.map((article: any) => (
                  <a
                    key={article.id}
                    href={article.content_url || article.url || "#"}
                    target={article.content_url || article.url ? "_blank" : undefined}
                    rel={
                      article.content_url || article.url
                        ? "noopener noreferrer"
                        : undefined
                    }
                    className="block bg-white rounded-2xl shadow-sm border border-orange-50 overflow-hidden hover:shadow-md transition-shadow group"
                  >
                    <div className="flex gap-4 p-4">
                      <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                        {(article.image_url || article.image) ? (
                          <img
                            src={article.image_url || article.image}
                            alt={article.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-50 text-purple-600 rounded">
                            {article.category}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {article.publish_date || article.date}
                          </span>
                        </div>
                        <h3 className="font-bold text-gray-800 leading-tight line-clamp-2 group-hover:text-orange-600 transition-colors">
                          {article.title}
                        </h3>
                        <div className="mt-3 text-xs text-gray-400 flex items-center gap-1">
                          <Newspaper size={12} />
                          {article.content_url || article.url ? "外部記事へ" : "URL未設定"}
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TabPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
        active
          ? "bg-orange-500 text-white shadow-md"
          : "bg-gray-50 text-gray-600 hover:bg-orange-50 border border-gray-100"
      }`}
    >
      {label}
    </button>
  );
}
