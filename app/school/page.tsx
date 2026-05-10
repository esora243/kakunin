"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import {
  Calendar,
  Clock,
  ChevronRight,
  ChevronLeft,
  Menu,
  BookOpen,
  Plus,
  Loader2,
  Building2,
  ClipboardList,
  Search,
  MoreVertical,
  MapPin,
  Video,
  Edit2,
  CheckSquare,
  Square,
} from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";
import { FloatingBanner } from "@/components/FloatingBanner";
import { siteConfig } from "@/lib/site";

// =============================================================
// 型定義
// =============================================================
type ClassTask = {
  id: string;
  title: string;
  deadline: string;
  completed: boolean;
  days_left?: number;
};

type ClassData = {
  id: string;
  title: string;
  category: string;
  day: string;
  periods: number[];
  room: string;
  professor?: string;
  timeDisplay?: string;
  term?: string;
  zoomUrl?: string;
  hasZoom?: boolean;
  hasNotice?: boolean;
  hasTask?: boolean;
  tasks?: ClassTask[];
};

const CATEGORY_STYLES: Record<
  string,
  { border: string; bg: string; text: string; pill: string }
> = {
  形態系: { border: "border-orange-200", bg: "bg-orange-50", text: "text-orange-700", pill: "bg-orange-50 text-orange-600 border-orange-100" },
  機能系: { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-700", pill: "bg-blue-50 text-blue-600 border-blue-100" },
  生化学: { border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-700", pill: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  病理: { border: "border-orange-200", bg: "bg-orange-50", text: "text-orange-700", pill: "bg-orange-50 text-orange-600 border-orange-100" },
  臨床: { border: "border-teal-200", bg: "bg-teal-50", text: "text-teal-700", pill: "bg-teal-50 text-teal-600 border-teal-100" },
  default: { border: "border-gray-200", bg: "bg-gray-50/30", text: "text-gray-700", pill: "bg-gray-100 text-gray-600 border-gray-200" },
};

const DAYS = ["月", "火", "水", "木", "金"];
const PERIODS = [1, 2, 3, 4, 5, 6];

function getWeekDates(baseDate: Date) {
  const d = new Date(baseDate);
  const dayOfWeek = d.getDay();
  const diffToMonday = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diffToMonday));
  return Array.from({ length: 5 }).map((_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd;
  });
}

function getWeekOfMonthString(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const firstDay = new Date(year, month - 1, 1).getDay() || 7;
  const weekNumber = Math.ceil((date.getDate() + firstDay - 1) / 7);
  return `${year}年${month}月 第${weekNumber}週`;
}

export default function SchoolPage() {
  const [activeTab, setActiveTab] = useState<"timetable" | "syllabus" | "articles" | "hospitals" | "exam">("timetable");
  const [loading, setLoading] = useState(true);
  const [userProfile] = useState({ university: "山口大学", faculty: "医学部", grade: 3 });
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const weekDates = useMemo(() => getWeekDates(new Date(currentDate)), [currentDate]);

  const [articles, setArticles] = useState<any[]>([]);
  const [articleSearch, setArticleSearch] = useState("");
  const [articleCategory, setArticleCategory] = useState("すべて");
  const [articlesLoading, setArticlesLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchClasses() {
      setLoading(true);
      try {
        const queryPath = `timetable_classes?university=eq.${encodeURIComponent(userProfile.university)}&grade=eq.${userProfile.grade}&select=*,tasks:class_tasks(*)`;
        const res = await supabaseRestFetch<any[]>({ path: queryPath });
        
        if (!cancelled && Array.isArray(res)) {
          const mapped = res.map((c) => {
            // 時限データの正規化 (単一数値、配列、文字列に対応)
            let rawPeriods: number[] = [];
            if (Array.isArray(c.periods)) {
              rawPeriods = c.periods.map(Number);
            } else if (c.period) {
              rawPeriods = [Number(c.period)];
            } else if (typeof c.periods === 'string') {
              rawPeriods = c.periods.split(',').map(Number);
            }

            return {
              id: c.id,
              title: c.title || "無題の講義",
              category: c.category || "default",
              day: c.day,
              periods: rawPeriods,
              room: c.room || "",
              professor: c.professor || c.instructor,
              timeDisplay: c.time_display || c.starts_at,
              term: c.term || "前期",
              zoomUrl: c.zoom_url || c.zoomUrl,
              hasZoom: !!(c.zoom_url || c.zoomUrl),
              hasNotice: !!c.has_notice,
              hasTask: c.tasks && c.tasks.length > 0,
              tasks: c.tasks || [],
            };
          });
          setClasses(mapped);
        }
      } catch (error) {
        console.error("時間割の取得に失敗しました:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchClasses();
    return () => { cancelled = true; };
  }, [userProfile]);

  useEffect(() => {
    if (activeTab !== "articles") return;
    let cancelled = false;
    async function fetchArticles() {
      setArticlesLoading(true);
      try {
        const data = await supabaseRestFetch<any[]>({ path: "articles?type=eq.school&select=*" });
        if (!cancelled) setArticles(data || []);
      } catch {
        if (!cancelled) setArticles([]);
      } finally {
        if (!cancelled) setArticlesLoading(false);
      }
    }
    void fetchArticles();
    return () => { cancelled = true; };
  }, [activeTab]);

  const articleCategories = useMemo(
    () => ["すべて", ...Array.from(new Set(articles.map((a) => a.category).filter(Boolean)))],
    [articles]
  );

  const filteredArticles = useMemo(() => {
    const q = articleSearch.trim().toLowerCase();
    return articles.filter((a) => {
      const title = (a.title || "").toLowerCase();
      const excerpt = (a.excerpt || "").toLowerCase();
      const matchQuery = !q || title.includes(q) || excerpt.includes(q);
      const matchCategory = articleCategory === "すべて" || a.category === articleCategory;
      return matchQuery && matchCategory;
    });
  }, [articles, articleSearch, articleCategory]);

  const handlePrevWeek = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 7);
    setCurrentDate(prev);
  };
  const handleNextWeek = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 7);
    setCurrentDate(next);
  };

  const renderDetailView = () => {
    if (!selectedClass) return null;
    const style = CATEGORY_STYLES[selectedClass.category] || CATEGORY_STYLES.default;

    return (
      <div className="bg-white min-h-[800px] animate-fade-in pb-20">
        <div className="flex items-center justify-between px-4 py-4 mb-2">
          <button onClick={() => setSelectedClass(null)} className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-base font-bold text-gray-800">授業の詳細</h2>
          <button className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
            <MoreVertical size={20} />
          </button>
        </div>
        <div className="px-6">
          <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold border mb-4 ${style.pill}`}>{selectedClass.category}</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{selectedClass.title}</h1>
          <p className="text-sm font-bold text-gray-600 mb-8">
            {selectedClass.day}・{selectedClass.periods.join("〜")}限 {selectedClass.timeDisplay || ""} {selectedClass.room} {selectedClass.professor || ""}
          </p>
          <div className="flex border-b border-gray-200 mb-6">
            <button className="flex-1 pb-3 text-sm font-bold text-orange-500 border-b-2 border-orange-500 text-center">基本情報</button>
            <button className="flex-1 pb-3 text-sm font-bold text-gray-400 hover:text-gray-600 text-center transition-colors">課題</button>
            <button className="flex-1 pb-3 text-sm font-bold text-gray-400 hover:text-gray-600 text-center transition-colors">メモ・通知</button>
          </div>
          <h3 className="text-sm font-bold text-gray-800 mb-4">授業情報</h3>
          <div className="bg-gray-50 rounded-2xl p-5 mb-6 space-y-4 border border-gray-100">
            <div className="flex items-center gap-4"><Clock size={16} className="text-gray-400" /><span className="text-sm text-gray-700">{selectedClass.timeDisplay || "時間未設定"}</span></div>
            <div className="flex items-center gap-4"><Calendar size={16} className="text-gray-400" /><span className="text-sm text-gray-700">{selectedClass.term}</span></div>
            <div className="flex items-center gap-4"><MapPin size={16} className="text-gray-400" /><span className="text-sm text-gray-700">{selectedClass.room}</span></div>
          </div>
          {selectedClass.zoomUrl && (
            <div className="flex gap-3 mb-10">
              <a href={selectedClass.zoomUrl.startsWith('http') ? selectedClass.zoomUrl : `https://${selectedClass.zoomUrl}`} target="_blank" rel="noopener noreferrer" className="flex-1 py-3.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors">
                <Video size={18} /> Zoomを開く
              </a>
              <button className="flex-1 py-3.5 bg-white text-gray-600 border border-gray-200 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
                <Edit2 size={18} /> URLを編集
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTimetableGrid = () => {
    const today = new Date();
    return (
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-orange-50 shadow-sm animate-fade-in overflow-x-auto">
        <div className="flex items-center justify-between mb-6 min-w-[500px]">
          <button onClick={handlePrevWeek} className="p-2 hover:bg-gray-50 rounded-full transition-colors"><ChevronLeft size={24} className="text-gray-400" /></button>
          <h3 className="text-lg font-bold text-gray-800">{getWeekOfMonthString(currentDate)}</h3>
          <button onClick={handleNextWeek} className="p-2 hover:bg-gray-50 rounded-full transition-colors"><ChevronRight size={24} className="text-gray-400" /></button>
        </div>
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={40} /></div>
        ) : (
          <div className="min-w-[500px]">
            <div className="grid grid-cols-[30px_repeat(5,minmax(0,1fr))] gap-2 sm:gap-3 mb-4">
              <div />
              {weekDates.map((date, i) => {
                const isToday = date.toDateString() === today.toDateString();
                return (
                  <div key={i} className="text-center flex flex-col items-center">
                    <span className={`text-base font-bold ${isToday ? "text-orange-500" : "text-gray-800"}`}>{date.getDate()}</span>
                    <div className={`text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${isToday ? "bg-orange-500 text-white shadow-sm" : "text-gray-500"}`}>{DAYS[i]}</div>
                  </div>
                );
              })}
            </div>
            {PERIODS.map((period) => (
              <div key={period} className="grid grid-cols-[30px_repeat(5,minmax(0,1fr))] gap-2 sm:gap-3 mb-2 sm:mb-3">
                <div className="flex flex-col items-center justify-center text-gray-400"><span className="text-sm font-bold">{period}</span><span className="text-[10px] font-bold">限</span></div>
                {DAYS.map((day) => {
                  const cellClass = classes.find((c) => c.day === day && c.periods.includes(period));
                  if (!cellClass) return <div key={`${day}-${period}`} className="border border-gray-100 rounded-xl min-h-[90px] sm:min-h-[110px]" />;
                  const isContinuation = cellClass.periods[0] !== period;
                  const style = CATEGORY_STYLES[cellClass.category] || CATEGORY_STYLES.default;
                  return (
                    <button key={`${day}-${period}`} onClick={() => setSelectedClass(cellClass)} className={`relative border-2 rounded-xl p-2.5 sm:p-3 min-h-[90px] sm:min-h-[110px] flex flex-col text-left transition-transform hover:scale-[1.02] ${style.border} ${style.bg} ${isContinuation ? "border-t-0 rounded-t-none opacity-80" : ""}`}>
                      <span className={`font-bold text-[13px] sm:text-sm leading-tight ${style.text}`}>{isContinuation ? "(続き)" : cellClass.title}</span>
                      {!isContinuation && cellClass.room && <span className="text-[10px] sm:text-[11px] mt-1 text-gray-400 font-bold">{cellClass.room}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white min-h-screen font-sans">
      {!selectedClass && (
        <div className="px-4 sm:px-6 py-5 border-b border-orange-50 sticky top-0 bg-white z-20">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">学校</h2>
            <div className="flex gap-2">
              <button className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"><Plus size={18} /></button>
              <button className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"><Menu size={18} /></button>
              <button className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"><Clock size={18} /></button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            <TabButton active={activeTab === "timetable"} onClick={() => setActiveTab("timetable")} icon={<Calendar size={16} />} label="時間割" />
            <TabButton active={activeTab === "syllabus"} onClick={() => setActiveTab("syllabus")} icon={<ClipboardList size={16} />} label="シラバス" />
            <TabButton active={activeTab === "articles"} onClick={() => setActiveTab("articles")} icon={<BookOpen size={16} />} label="勉強系記事" />
            <TabButton active={activeTab === "hospitals"} onClick={() => setActiveTab("hospitals")} icon={<Building2 size={16} />} label="研修病院" />
            <TabButton active={activeTab === "exam"} onClick={() => setActiveTab("exam")} icon={<BookOpen size={16} />} label="国試対策" />
          </div>
        </div>
      )}
      {!selectedClass && activeTab !== "syllabus" && (
        <div className="pt-3">
          <FloatingBanner campaignId="1" title="2026年度 初期研修説明会 受付中" imageUrl="https://images.unsplash.com/photo-1758691462848-ba1e929da259?auto=format&fit=crop&q=80&w=1080" sponsorName="医療法人伏見会　伏見病院" />
        </div>
      )}
      <div className={`bg-[#FFF9FA] ${!selectedClass ? "p-4 sm:p-6" : ""}`}>
        {activeTab === "timetable" && (selectedClass ? renderDetailView() : renderTimetableGrid())}
        {activeTab === "syllabus" && !selectedClass && (
          <div className="bg-white rounded-2xl border border-orange-50 shadow-sm p-4 animate-fade-in">
            <div className="w-full h-[70vh] rounded-xl overflow-hidden border border-gray-200 shadow-sm relative bg-gray-50">
              {siteConfig.syllabusUrl && <iframe src={siteConfig.syllabusUrl} title="大学シラバス" className="relative z-10 w-full h-full border-none bg-white" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${active ? "bg-orange-500 text-white shadow-md" : "bg-white text-gray-600 border border-gray-200 hover:bg-orange-50"}`}>
      {icon}
      {label}
    </button>
  );
}