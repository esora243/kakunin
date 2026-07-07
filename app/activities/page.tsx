"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Plane,
  ExternalLink,
  Instagram,
  Twitter,
  Mail,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { studentGroups, studyAbroadPrograms } from "@/lib/data";
import { supabaseRestFetch } from "@/lib/supabase/rest";
import { FloatingBanner } from "@/components/FloatingBanner";

/**
 * 課外活動ページ
 * - 2タブ構成（学生団体 / 留学情報）
 * - 問い合わせセクションを追加
 */
export default function ActivitiesPage() {
  const [activeTab, setActiveTab] = useState<"groups" | "study-abroad">("groups");
  const [loading, setLoading] = useState(true);

  const [groupsData, setGroupsData] = useState<any[]>([]);
  const [programsData, setProgramsData] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      try {
        const [gRes, pRes] = await Promise.all([
          supabaseRestFetch<any[]>({ path: "student_groups?select=*" }).catch(() => []),
          supabaseRestFetch<any[]>({ path: "study_abroad_programs?select=*" }).catch(() => []),
        ]);
        if (!cancelled) {
          setGroupsData(gRes || []);
          setProgramsData(pRes || []);
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

  return (
    <div className="w-full max-w-lg mx-auto pb-8 animate-slide-in-right bg-white min-h-screen">
      {/* sticky ヘッダー */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#B9C2DB] px-4 py-4 shadow-sm">
        <h2 className="text-xl font-bold text-gray-800 mb-4">課外活動</h2>
        <div className="flex gap-2">
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
        </div>
      </div>

      {/* FloatingBanner */}
      <div className="pt-3">
        <FloatingBanner
          campaignId="2"
          title="留学支援プログラム説明会開催中"
          imageUrl="https://images.unsplash.com/photo-1609126385558-bc3fc5082b0a?auto=format&fit=crop&q=80&w=1080"
          sponsorName="グローバル医療教育機構"
        />
      </div>

      {/* コンテンツ */}
      <div className="px-4 pt-1 space-y-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-[#1E3A8A]" size={32} />
          </div>
        ) : (
          <>
            {/* 学生団体タブ */}
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
                    className="block bg-white rounded-2xl shadow-sm border border-[#F2F4F8] overflow-hidden hover:shadow-md transition-shadow group"
                  >
                    <div className="relative h-40 bg-gray-100">
                      {(group.image_url || group.image) && (
                        <img
                          src={group.image_url || group.image}
                          alt={group.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3">
                        <span className="text-[10px] font-bold bg-[#1E3A8A] text-white px-2 py-1 rounded-full">
                          {group.category}
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-gray-800 mb-2 group-hover:text-[#11204C] transition-colors">
                        {group.name}
                      </h3>
                      <p className="text-xs text-gray-600 leading-relaxed mb-3 line-clamp-2">
                        {group.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Users size={14} className="text-[#1E3A8A]" />
                          <span>{group.members_count || group.members || 0}名</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {social.instagram && <Instagram size={14} className="text-[#1E3A8A]" />}
                          {social.twitter && <Twitter size={14} className="text-blue-400" />}
                          {social.mail && <Mail size={14} className="text-gray-400" />}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}

            {/* 留学情報タブ */}
            {activeTab === "study-abroad" &&
              displayPrograms.map((program: any) => (
                <div
                  key={program.id}
                  className="block bg-white rounded-2xl shadow-sm border border-[#F2F4F8] overflow-hidden hover:shadow-md transition-shadow group"
                >
                  <div className="relative h-32 bg-gray-100">
                    {(program.image_url || program.image) && (
                      <img
                        src={program.image_url || program.image}
                        alt={program.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    )}
                    <div className="absolute top-3 left-3 bg-blue-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                      {program.country}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-gray-800 mb-2 group-hover:text-[#11204C] transition-colors">
                      {program.title}
                    </h3>
                    <div className="space-y-1.5 text-xs text-gray-600 mb-3">
                      <div className="flex items-center gap-2">
                        <Plane size={12} className="text-[#1E3A8A]" />
                        <span>{program.duration}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users size={12} className="text-[#1E3A8A]" />
                        <span>{program.organization}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                      <span className="text-[10px] text-red-500 font-bold">
                        締切: {program.deadline}
                      </span>
                      {program.url && (
                        <a
                          href={program.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs font-bold text-[#1E3A8A] hover:text-[#11204C]"
                        >
                          詳細 <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </>
        )}

        {/* 問い合わせセクション */}
        <div className="mt-8 mb-4 bg-[#F2F4F8] p-5 rounded-2xl border border-[#B9C2DB]/50">
          <div className="flex items-center gap-3 mb-3 text-[#11204C]">
            <MessageCircle size={20} />
            <h4 className="font-bold">活動に関する問い合わせ</h4>
          </div>
          <p className="text-xs text-gray-600 mb-4 leading-relaxed">
            掲載団体への質問や、留学プログラムに関する相談など、こちらからお気軽にお問い合わせください。
          </p>
          <Link
            href="/contact"
            className="block w-full text-center py-3 bg-white border border-[#B9C2DB] rounded-xl text-sm font-bold text-[#11204C] hover:bg-gray-50 transition-colors"
          >
            問い合わせフォームへ進む
          </Link>
        </div>
      </div>
    </div>
  );
}

function TabPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
        active
          ? "bg-[#1E3A8A] text-white shadow-md"
          : "bg-gray-50 text-gray-600 border border-gray-100"
      }`}
    >
      {label}
    </button>
  );
}
