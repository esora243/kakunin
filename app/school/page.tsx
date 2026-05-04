"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Calendar, Clock, ChevronRight, ChevronLeft, Menu, Search, BookOpen, Plus, Loader2, MapPin, UserRound } from "lucide-react";
import { schoolArticles } from "@/lib/data";
import { siteConfig } from "@/lib/site";
import { supabaseRestFetch } from "@/lib/supabase/rest";
import type { TimetableClassDto, TimetableDay, TimetableGridDto, TimetableResponse } from "@/lib/timetable-dto";

const DAY_ACCENTS: Record<TimetableDay, string> = {
  月: "border-sky-100 bg-sky-50 text-sky-900",
  火: "border-rose-100 bg-rose-50 text-rose-900",
  水: "border-emerald-100 bg-emerald-50 text-emerald-900",
  木: "border-amber-100 bg-amber-50 text-amber-900",
  金: "border-violet-100 bg-violet-50 text-violet-900",
  土: "border-gray-100 bg-gray-50 text-gray-900",
  日: "border-gray-100 bg-gray-50 text-gray-900",
};

// 研修病院用のダミーデータ（Supabase取得失敗時のフォールバック用）
const dummyHospitals = [
  {
    id: 1,
    name: "浜松医科大学医学部附属病院",
    location: "静岡県 浜松市",
    type: "大学病院",
    rating: "4.5",
    tags: ["救急豊富", "指導体制充実", "研究に積極的"],
    departments: ["救急科", "総合診療科", "内科", "+2"],
    capacity: 40,
    image_url: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=500&q=60"
  },
  {
    id: 2,
    name: "聖隷浜松病院",
    location: "静岡県 浜松市",
    type: "市中病院",
    rating: "4.7",
    tags: ["救急搬送多数", "手技が豊富", "給与良好"],
    departments: [],
    capacity: 25,
    image_url: "https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?auto=format&fit=crop&w=500&q=60"
  }
];

function formatClassTime(item: TimetableClassDto) {
  if (!item.startsAt || !item.endsAt) return `${item.period}限`;
  return `${item.period}限 ${item.startsAt}-${item.endsAt}`;
}

export default function SchoolPage() {
  const [activeTab, setActiveTab] = useState<"timetable" | "syllabus" | "articles" | "hospitals">("timetable");
  const [view, setView] = useState<"main" | "detail">("main");
  const [selectedClass, setSelectedClass] = useState<TimetableClassDto | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("すべて");
  
  // States
  const [days, setDays] = useState<TimetableDay[]>(["月", "火", "水", "木", "金"]);
  const [periods, setPeriods] = useState([1, 2, 3, 4, 5, 6]);
  const [timetableGrid, setTimetableGrid] = useState<TimetableGridDto>({ 月: {}, 火: {}, 水: {}, 木: {}, 金: {}, 土: {}, 日: {} });
  const [classes, setClasses] = useState<TimetableClassDto[]>([]);
  const [loadingTimetable, setLoadingTimetable] = useState(true);
  const [timetableError, setTimetableError] = useState<string | null>(null);

  const [hospitalsData, setHospitalsData] = useState<any[]>([]);
  const [articlesData, setArticlesData] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoadingTimetable(true);
      try {
        const [ttRes, hospRes, artRes] = await Promise.all([
          fetch("/api/timetable", { cache: "no-store" }).then(res => res.json()).catch(() => ({ ok: false })),
          supabaseRestFetch<any[]>({ path: "hospitals?select=*" }).catch(() => []),
          supabaseRestFetch<any[]>({ path: "articles?type=eq.school&select=*" }).catch(() => [])
        ]);
        
        if (!cancelled) {
          if (ttRes && ttRes.ok) {
            setDays(ttRes.days);
            setPeriods(ttRes.periods);
            setClasses(ttRes.items);
            setTimetableGrid(ttRes.grid);
          }
          setHospitalsData(hospRes || []);
          setArticlesData(artRes || []);
        }
      } catch (error) {
        console.error("データ取得エラー:", error);
      } finally {
        if (!cancelled) setLoadingTimetable(false);
      }
    }
    void loadData();
    return () => { cancelled = true; };
  }, []);

  const displayArticles = articlesData.length > 0 ? articlesData : schoolArticles;
  const displayHospitals = hospitalsData.length > 0 ? hospitalsData : dummyHospitals;

  const dynamicCategories = useMemo(() => ["すべて", ...Array.from(new Set(displayArticles.map((a) => a.category)))], [displayArticles]);

  const filteredArticles = useMemo(() => {
    return displayArticles.filter((article) => {
      const query = searchQuery.trim().toLowerCase();
      const matchQuery = !query || `${article.title} ${article.excerpt || ""}`.toLowerCase().includes(query);
      const matchCategory = selectedCategory === "すべて" || article.category === selectedCategory;
      return matchQuery && matchCategory;
    });
  }, [displayArticles, searchQuery, selectedCategory]);

  const syllabusClasses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return classes;
    return classes.filter((item) => [item.title, item.instructor, item.room, item.location].filter(Boolean).join(" ").toLowerCase().includes(query));
  }, [classes, searchQuery]);

  if (view === "detail" && selectedClass) {
    return (
      <div className="w-full max-w-lg mx-auto bg-white min-h-screen pb-20 animate-fade-in">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 bg-white border-b border-gray-100">
          <button onClick={() => setView("main")} className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 hover:bg-gray-50">
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <h2 className="text-lg font-bold text-gray-800">授業の詳細</h2>
          <div className="w-10 h-10" />
        </div>
        <div className="px-5 pt-5 space-y-4">
          <div className={`rounded-3xl border p-5 ${DAY_ACCENTS[selectedClass.day]}`}>
            <h1 className="text-xl font-bold leading-snug mb-3">{selectedClass.title}</h1>
            <div className="space-y-2 text-sm">
              {selectedClass.instructor ? <p className="flex items-center gap-2"><UserRound size={15} /> {selectedClass.instructor}</p> : null}
              {selectedClass.room || selectedClass.location ? <p className="flex items-center gap-2"><MapPin size={15} /> {[selectedClass.room, selectedClass.location].filter(Boolean).join(" / ")}</p> : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto pb-8 bg-white min-h-screen animate-fade-in">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">学校</h2>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {(["timetable", "syllabus", "articles", "hospitals"] as const).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)} className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === t ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-orange-50"}`}>
              {t === "timetable" ? "時間割" : t === "syllabus" ? "シラバス" : t === "articles" ? "勉強系記事" : "研修病院"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 pt-4">
        {/* コンテンツ描画エリア */}
        {activeTab === "hospitals" && (
           <div className="space-y-4">
             {displayHospitals.map(h => (
               <div key={h.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                 <h4 className="font-bold">{h.name}</h4>
                 <img src={h.image_url || h.image} alt={h.name} className="w-full h-32 object-cover rounded-lg mt-2" />
               </div>
             ))}
           </div>
        )}
        {/* ... 他のタブも同様の構成 ... */}
      </div>
    </div>
  );
}