"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Calendar, Clock, ChevronRight, ChevronLeft, Menu, BookOpen, Plus, Loader2, Building2, ClipboardList } from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";

// カテゴリごとの配色（画像デザイン準拠）
const CATEGORY_COLORS: Record<string, string> = {
  形態系: "border-orange-200 text-orange-600 bg-orange-50/30",
  機能系: "border-blue-200 text-blue-600 bg-blue-50/30",
  生化学: "border-green-200 text-green-600 bg-green-50/30",
  病理: "border-orange-200 text-orange-600 bg-orange-50/30",
  臨床: "border-cyan-200 text-cyan-600 bg-cyan-50/30",
  default: "border-gray-200 text-gray-600 bg-white",
};

// 科目名から色を推測
function getCategoryColor(title: string) {
  if (!title) return CATEGORY_COLORS["default"];
  if (title.includes("解剖") || title.includes("組織")) return CATEGORY_COLORS["形態系"];
  if (title.includes("生理") || title.includes("臨床入門")) return CATEGORY_COLORS["機能系"];
  if (title.includes("生化学")) return CATEGORY_COLORS["生化学"];
  if (title.includes("病理")) return CATEGORY_COLORS["病理"];
  return CATEGORY_COLORS["default"];
}

export default function SchoolPage() {
  const [activeTab, setActiveTab] = useState<"timetable" | "syllabus" | "articles" | "hospitals">("timetable");
  const [loading, setLoading] = useState(true);
  
  // データステート
  const [timetableGrid, setTimetableGrid] = useState<Record<string, Record<number, any>>>({ 月: {}, 火: {}, 水: {}, 木: {}, 金: {}, 土: {}, 日: {} });
  const [hospitalsData, setHospitalsData] = useState<any[]>([]);
  const [articlesData, setArticlesData] = useState<any[]>([]);

  const days = ["月", "火", "水", "木", "金"];
  const periods = [1, 2, 3, 4, 5, 6];

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      try {
        // Supabaseから直接データを並列取得
        const [ttRes, hospRes, artRes] = await Promise.all([
          supabaseRestFetch<any[]>({ path: "timetable_classes?select=*" }).catch(() => []),
          supabaseRestFetch<any[]>({ path: "hospitals?select=*" }).catch(() => []),
          supabaseRestFetch<any[]>({ path: "articles?type=eq.school&select=*" }).catch(() => [])
        ]);
        
        if (!cancelled) {
          // 取得した時間割データを曜日と時限(period)でグリッド化
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

  return (
    <div className="w-full max-w-4xl mx-auto bg-white min-h-screen">
      <div className="px-6 py-6 border-b border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">学校</h2>
          <div className="flex gap-3">
            <button className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"><Plus size={20} /></button>
            <button className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"><Menu size={20} /></button>
            <button className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"><Clock size={20} /></button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
          <button onClick={() => setActiveTab("timetable")} className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === "timetable" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}>
            <Calendar size={16} /> 時間割
          </button>
          <button onClick={() => setActiveTab("syllabus")} className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === "syllabus" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}>
            <ClipboardList size={16} /> シラバス
          </button>
          <button onClick={() => setActiveTab("articles")} className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === "articles" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}>
            <BookOpen size={16} /> 勉強系記事
          </button>
          <button onClick={() => setActiveTab("hospitals")} className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === "hospitals" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}>
            <Building2 size={16} /> 研修病院
          </button>
        </div>
      </div>

      <div className="p-6">
        {activeTab === "timetable" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between px-4">
              <button className="p-2 hover:bg-gray-50 rounded-full"><ChevronLeft size={24} className="text-gray-400" /></button>
              <h3 className="text-lg font-bold text-gray-800">2026年4月 第2週</h3>
              <button className="p-2 hover:bg-gray-50 rounded-full"><ChevronRight size={24} className="text-gray-400" /></button>
            </div>

            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={40} /></div>
            ) : (
              <div className="bg-white">
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
                      <span>{period}</span>
                      <span className="text-[10px] font-normal">限</span>
                    </div>
                    {days.map((day) => {
                      // Supabaseから取得したデータとマッピング
                      const cell = timetableGrid[day]?.[period];
                      
                      if (!cell) {
                        return <div key={`${day}-${period}`} className="border border-gray-100 rounded-xl bg-gray-50/50 min-h-[100px]" />;
                      }
                      
                      const style = getCategoryColor(cell.title);
                      
                      return (
                        <div key={`${day}-${period}`} className={`relative border-2 rounded-xl p-2.5 min-h-[100px] flex flex-col text-left ${style}`}>
                          <span className="font-bold text-sm leading-tight">{cell.title}</span>
                          {cell.room ? <span className="text-[11px] mt-1 opacity-80">{cell.room}</span> : null}
                          
                          {/* 講義の開始・終了時間が登録されている場合の表示（ホバー時や詳細で活用可能） */}
                          {cell.starts_at && (
                            <span className="text-[9px] mt-0.5 opacity-60 hidden">
                              {cell.starts_at.substring(0, 5)} - {cell.ends_at?.substring(0, 5)}
                            </span>
                          )}

                          <div className="absolute bottom-2 left-2 flex gap-1">
                            {/* 公式データ(is_official)かどうかの判定などでドット色を制御可能 */}
                            {cell.is_official && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                            <div className="w-2 h-2 rounded-full bg-orange-500" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}

                {/* 凡例 */}
                <div className="flex flex-wrap justify-center gap-4 mt-8 pt-6 border-t border-gray-100 text-xs font-bold text-gray-500">
                  <span className="flex items-center gap-1"><div className="w-3 h-3 border-2 border-orange-200 bg-orange-50 rounded-sm" /> 形態系</span>
                  <span className="flex items-center gap-1"><div className="w-3 h-3 border-2 border-blue-200 bg-blue-50 rounded-sm" /> 機能系</span>
                  <span className="flex items-center gap-1"><div className="w-3 h-3 border-2 border-green-200 bg-green-50 rounded-sm" /> 生化学</span>
                  <span className="flex items-center gap-1"><div className="w-3 h-3 border-2 border-orange-200 bg-orange-50 rounded-sm" /> 病理</span>
                  <span className="flex items-center gap-1"><div className="w-3 h-3 border-2 border-cyan-200 bg-cyan-50 rounded-sm" /> 臨床</span>
                  <span className="flex items-center gap-1 ml-4"><div className="w-2.5 h-2.5 bg-blue-500 rounded-full" /> 公式・Zoom</span>
                  <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-orange-500 rounded-full" /> 通知</span>
                  <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-amber-800 rounded-full" /> 課題</span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "hospitals" && (
           <div className="space-y-4 animate-fade-in">
             {hospitalsData.length === 0 && !loading ? (
                <div className="text-center py-10 text-gray-500">研修病院のデータがありません</div>
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

        {activeTab === "articles" && (
           <div className="space-y-4 animate-fade-in">
             {articlesData.length === 0 && !loading ? (
                <div className="text-center py-10 text-gray-500">記事のデータがありません</div>
             ) : (
               articlesData.map((a: any) => (
                 <div key={a.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex gap-4">
                   <div className="flex-1">
                     <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-1 rounded font-bold">{a.category}</span>
                     <h4 className="font-bold text-gray-800 mt-2 leading-tight">{a.title}</h4>
                     <p className="text-xs text-gray-500 mt-2 line-clamp-2">{a.excerpt}</p>
                   </div>
                 </div>
               ))
             )}
           </div>
        )}
      </div>
    </div>
  );
}