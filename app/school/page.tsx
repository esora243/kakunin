"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { Calendar, Clock, ChevronRight, ChevronLeft, Menu, BookOpen, Plus, Loader2, Building2, ClipboardList, Search, Image as ImageIcon } from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";

// カテゴリごとの配色（時間割用）
const CATEGORY_COLORS: Record<string, string> = {
  形態系: "border-orange-200 text-orange-600 bg-orange-50/30",
  機能系: "border-blue-200 text-blue-600 bg-blue-50/30",
  生化学: "border-green-200 text-green-600 bg-green-50/30",
  病理: "border-orange-200 text-orange-600 bg-orange-50/30",
  臨床: "border-cyan-200 text-cyan-600 bg-cyan-50/30",
  default: "border-gray-200 text-gray-600 bg-white",
};

function getCategoryColor(title: string) {
  if (!title) return CATEGORY_COLORS["default"];
  if (title.includes("解剖") || title.includes("組織")) return CATEGORY_COLORS["形態系"];
  if (title.includes("生理") || title.includes("臨床入門")) return CATEGORY_COLORS["機能系"];
  if (title.includes("生化学")) return CATEGORY_COLORS["生化学"];
  if (title.includes("病理")) return CATEGORY_COLORS["病理"];
  return CATEGORY_COLORS["default"];
}

// 記事用のカテゴリタブ
const ARTICLE_CATEGORIES = ["すべて", "基礎医学", "国試対策", "臨床・実習", "ツール", "キャリア"];

export default function SchoolPage() {
  const [activeTab, setActiveTab] = useState<"timetable" | "syllabus" | "articles" | "hospitals">("articles");
  const [loading, setLoading] = useState(true);
  
  // データステート
  const [timetableGrid, setTimetableGrid] = useState<Record<string, Record<number, any>>>({ 月: {}, 火: {}, 水: {}, 木: {}, 金: {}, 土: {}, 日: {} });
  const [hospitalsData, setHospitalsData] = useState<any[]>([]);
  const [articlesData, setArticlesData] = useState<any[]>([]);

  // 記事検索・フィルター用ステート
  const [searchQuery, setSearchQuery] = useState("");
  const [activeArticleCategory, setActiveArticleCategory] = useState("すべて");

  const days = ["月", "火", "水", "木", "金"];
  const periods = [1, 2, 3, 4, 5, 6];

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      try {
        const [ttRes, hospRes, artRes] = await Promise.all([
          supabaseRestFetch<any[]>({ path: "timetable_classes?select=*" }).catch(() => []),
          supabaseRestFetch<any[]>({ path: "hospitals?select=*" }).catch(() => []),
          supabaseRestFetch<any[]>({ path: "articles?type=eq.school&select=*" }).catch(() => [])
        ]);
        
        if (!cancelled) {
          const newGrid: Record<string, Record<number, any>> = { 月: {}, 火: {}, 水: {}, 木: {}, 金: {}, 土: {}, 日: {} };
          if (ttRes && Array.isArray(ttRes)) {
            ttRes.forEach((c) => {
              if (c.day && c.period && newGrid[c.day]) {
                newGrid[c.day][c.period] = c;
              }
            });
          }
          setTimetableGrid(newGrid);
          setHospitalsData(hospRes || []);
          setArticlesData(artRes || []);
        }
      } catch (error) {
        console.error("データ取得エラー:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadData();
    return () => { cancelled = true; };
  }, []);

  // 記事のフィルタリングロジック
  const filteredArticles = useMemo(() => {
    return articlesData.filter((article) => {
      const matchesCategory = 
        activeArticleCategory === "すべて" || 
        article.category === activeArticleCategory;
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        !query || 
        article.title?.toLowerCase().includes(query) ||
        article.excerpt?.toLowerCase().includes(query);
      
      return matchesCategory && matchesSearch;
    });
  }, [articlesData, searchQuery, activeArticleCategory]);

  return (
    <div className="w-full max-w-4xl mx-auto bg-white min-h-screen font-sans">
      <div className="px-6 py-6 border-b border-gray-100 sticky top-0 bg-white z-20">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">学校</h2>
          <div className="flex gap-3">
            <button className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"><Plus size={20} strokeWidth={2} /></button>
            <button className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"><Menu size={20} strokeWidth={2} /></button>
            <button className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"><Clock size={20} strokeWidth={2} /></button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
          <button onClick={() => setActiveTab("timetable")} className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === "timetable" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
            <Calendar size={16} /> 時間割
          </button>
          <button onClick={() => setActiveTab("syllabus")} className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === "syllabus" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
            <ClipboardList size={16} /> シラバス
          </button>
          <button onClick={() => setActiveTab("articles")} className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === "articles" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
            <BookOpen size={16} fill={activeTab === "articles" ? "white" : "none"} /> 勉強系記事
          </button>
          <button onClick={() => setActiveTab("hospitals")} className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === "hospitals" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
            <Building2 size={16} /> 研修病院
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 bg-[#fffcfc]">
        {activeTab === "articles" && (
          <div className="animate-fade-in">
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="記事を検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all font-medium placeholder:text-gray-400"
              />
            </div>

            <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar pb-2">
              {ARTICLE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveArticleCategory(cat)}
                  className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                    activeArticleCategory === cat
                      ? "bg-gray-800 text-white border-gray-800"
                      : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={40} /></div>
            ) : filteredArticles.length === 0 ? (
              <div className="text-center py-20 text-gray-400 font-bold bg-white rounded-2xl border border-gray-100">記事が見つかりません</div>
            ) : (
              <div className="space-y-4">
                {filteredArticles.map((article: any) => (
                  <Link 
                    key={article.id} 
                    href={article.content_url || `/articles/${article.id}`}
                    className="flex gap-4 p-3 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow group"
                  >
                    <div className="shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
                      {article.image_url ? (
                        <img src={article.image_url} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <BookOpen className="text-gray-300" size={32} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center py-1 pr-2">
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                          {article.category || "その他"}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap ml-2">
                          {article.publish_date ? article.publish_date.replace(/-/g, '/') : "2026/04/01"}
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-800 text-sm leading-snug mb-1.5 group-hover:text-orange-600 transition-colors line-clamp-2">
                        {article.title}
                      </h3>
                      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                        {article.excerpt}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "timetable" && (
          <div className="space-y-6 animate-fade-in bg-white p-4 rounded-2xl border border-gray-100">
            <div className="flex items-center justify-between px-2 mb-4">
              <button className="p-2 hover:bg-gray-50 rounded-full"><ChevronLeft size={24} className="text-gray-400" /></button>
              <h3 className="text-lg font-bold text-gray-800">2026年4月 第2週</h3>
              <button className="p-2 hover:bg-gray-50 rounded-full"><ChevronRight size={24} className="text-gray-400" /></button>
            </div>
            
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={40} /></div>
            ) : (
              <div>
                <div className="grid grid-cols-[30px_repeat(5,minmax(0,1fr))] gap-2 mb-4">
                  <div />
                  {days.map((day, i) => (
                    <div key={day} className="text-center flex flex-col items-center">
                      <span className="text-gray-800 text-lg font-bold">{i + 6}</span>
                      <div className={`text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center mt-1 ${day === '火' ? 'bg-orange-500 text-white' : 'text-gray-500'}`}>
                        {day}
                      </div>
                    </div>
                  ))}
                </div>

                {periods.map((period) => (
                  <div key={period} className="grid grid-cols-[30px_repeat(5,minmax(0,1fr))] gap-2 mb-2">
                    <div className="flex flex-col items-center justify-center text-xs text-gray-400 font-bold">
                      <span>{period}</span><span className="text-[10px] font-normal">限</span>
                    </div>
                    {days.map((day) => {
                      const cell = timetableGrid[day]?.[period];
                      if (!cell) return <div key={`${day}-${period}`} className="border border-gray-100 rounded-xl bg-gray-50/50 min-h-[100px]" />;
                      const style = getCategoryColor(cell.title);
                      return (
                        <div key={`${day}-${period}`} className={`relative border-2 rounded-xl p-2.5 min-h-[100px] flex flex-col text-left ${style}`}>
                          <span className="font-bold text-sm leading-tight">{cell.title}</span>
                          {cell.room && <span className="text-[11px] mt-1 opacity-80">{cell.room}</span>}
                          <div className="absolute bottom-2 left-2 flex gap-1">
                            {cell.is_official && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                            <div className="w-2 h-2 rounded-full bg-orange-500" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "hospitals" && (
           <div className="space-y-4 animate-fade-in">
             {hospitalsData.length === 0 && !loading ? (
                <div className="text-center py-10 text-gray-500 bg-white rounded-2xl border border-gray-100">研修病院のデータがありません</div>
             ) : (
               hospitalsData.map((h: any) => (
                 <div key={h.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                   <h4 className="font-bold text-gray-800">{h.name}</h4>
                   <p className="text-xs text-gray-500 mt-1">{h.location} / {h.type}</p>
                   {h.image_url && <img src={h.image_url} alt={h.name} className="w-full h-32 object-cover rounded-lg mt-3" />}
                 </div>
               ))
             )}
           </div>
        )}
      </div>
    </div>
  );
}