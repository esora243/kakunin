"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Users, Plane, ExternalLink, Instagram, Twitter, Mail, Newspaper } from "lucide-react";
import { activityArticles, studentGroups, studyAbroadPrograms } from "@/lib/data";

export default function ActivitiesPage() {
  const [activeTab, setActiveTab] = useState<"groups" | "study-abroad" | "articles">("groups");

  const hasContent = useMemo(
    () => studentGroups.length > 0 || studyAbroadPrograms.length > 0 || activityArticles.length > 0,
    [],
  );

  return (
    <div className="w-full max-w-lg mx-auto pb-8 animate-slide-in-right">
      <div className="sticky top-[20px] z-30 bg-white border-b border-orange-100 px-4 py-4">
        <h2 className="text-xl font-bold text-gray-800 mb-4">課外活動</h2>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          <button onClick={() => setActiveTab("groups")} className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "groups" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-orange-50"}`}>👥 学生団体</button>
          <button onClick={() => setActiveTab("study-abroad")} className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "study-abroad" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-orange-50"}`}>✈️ 留学情報</button>
          <button onClick={() => setActiveTab("articles")} className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "articles" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-orange-50"}`}>📝 記事</button>
        </div>
      </div>

      <div className="px-4 pt-3 space-y-4">
        {!hasContent && (
          <div className="bg-white rounded-2xl border border-orange-100 p-8 text-center">
            <Users className="mx-auto text-orange-200 mb-3" size={40} />
            <p className="text-gray-700 font-bold mb-2">課外活動データは未登録です</p>
            <p className="text-sm text-gray-500">studentGroups / studyAbroadPrograms / activityArticles に本番データを追加してください。</p>
          </div>
        )}

        {activeTab === "groups" && studentGroups.map((group) => (
          <Link key={group.id} href={`/activities/groups/${group.id}`} className="block bg-white rounded-2xl shadow-sm border border-orange-50 overflow-hidden hover:shadow-md transition-shadow group">
            <div className="relative h-40 bg-gray-100">
              {group.image ? <img src={group.image} alt={group.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3">
                <span className="text-[10px] font-bold bg-orange-500 text-white px-2 py-1 rounded-full">{group.category}</span>
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-bold text-gray-800 mb-2 group-hover:text-orange-600 transition-colors">{group.name}</h3>
              <p className="text-xs text-gray-600 leading-relaxed mb-3 line-clamp-2">{group.description}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-gray-500"><Users size={14} className="text-orange-400" /><span>{group.members}名</span></div>
                <div className="flex items-center gap-2">
                  {group.social.instagram && <div className="text-orange-400"><Instagram size={14} /></div>}
                  {group.social.twitter && <div className="text-blue-400"><Twitter size={14} /></div>}
                  {group.social.mail && <div className="text-gray-400"><Mail size={14} /></div>}
                </div>
              </div>
            </div>
          </Link>
        ))}

        {activeTab === "study-abroad" && studyAbroadPrograms.map((program) => (
          <div key={program.id} className="block bg-white rounded-2xl shadow-sm border border-orange-50 overflow-hidden hover:shadow-md transition-shadow group">
            <div className="relative h-32 bg-gray-100">
              {program.image ? <img src={program.image} alt={program.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : null}
              <div className="absolute top-3 left-3 bg-blue-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">{program.country}</div>
            </div>
            <div className="p-4">
              <h3 className="font-bold text-gray-800 mb-2 group-hover:text-orange-600 transition-colors">{program.title}</h3>
              <div className="space-y-1.5 text-xs text-gray-600 mb-3">
                <div className="flex items-center gap-2"><Plane size={12} className="text-orange-400" /><span>{program.duration}</span></div>
                <div className="flex items-center gap-2"><Users size={12} className="text-orange-400" /><span>{program.organization}</span></div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                <span className="text-[10px] text-red-500 font-bold">締切: {program.deadline}</span>
                {program.url ? (
                  <a href={program.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-bold text-orange-500 hover:text-orange-600">詳細 <ExternalLink size={12} /></a>
                ) : <span className="text-[10px] text-gray-400">URL未設定</span>}
              </div>
            </div>
          </div>
        ))}

        {activeTab === "articles" && activityArticles.map((article) => (
          <a key={article.id} href={article.url || "#"} target={article.url ? "_blank" : undefined} rel={article.url ? "noopener noreferrer" : undefined} className="block bg-white rounded-2xl shadow-sm border border-orange-50 overflow-hidden hover:shadow-md transition-shadow group">
            <div className="flex gap-4 p-4">
              <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                {article.image ? <img src={article.image} alt={article.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /> : null}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-50 text-purple-600 rounded">{article.category}</span>
                  <span className="text-[10px] text-gray-400">{article.date}</span>
                </div>
                <h3 className="font-bold text-gray-800 leading-tight line-clamp-2 group-hover:text-orange-600 transition-colors">{article.title}</h3>
                <div className="mt-3 text-xs text-gray-400 flex items-center gap-1"><Newspaper size={12} /> {article.url ? "外部記事へ" : "URL未設定"}</div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
