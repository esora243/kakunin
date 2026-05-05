"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Calendar, Clock, ChevronRight, ChevronLeft, Menu, BookOpen, Plus, Loader2, Building2, ClipboardList, 
  Search, Image as ImageIcon, MoreVertical, MapPin, Video, Edit2, CheckSquare, Square 
} from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";
import { useAuth } from "@/components/AuthContext";
import Link from "next/link";

// ---------------------------------------------------------
// 型定義と定数
// ---------------------------------------------------------
type ClassData = {
  id: number;
  title: string;
  instructor?: string;
  room?: string;
  location?: string;
  day: string;
  period: number;
  starts_at?: string;
  ends_at?: string;
  is_official: boolean;
  university_name: string;
  academic_year: number;
  category?: string; 
};

const CATEGORY_STYLES: Record<string, { border: string, bg: string, text: string, pill: string }> = {
  形態系: { border: "border-orange-200", bg: "bg-orange-50/50", text: "text-orange-700", pill: "bg-orange-50 text-orange-600 border-orange-100" },
  機能系: { border: "border-blue-200", bg: "bg-blue-50/50", text: "text-blue-700", pill: "bg-blue-50 text-blue-600 border-blue-100" },
  生化学: { border: "border-green-200", bg: "bg-green-50/50", text: "text-green-700", pill: "bg-green-50 text-green-600 border-green-100" },
  病理: { border: "border-amber-200", bg: "bg-amber-50/50", text: "text-amber-700", pill: "bg-amber-50 text-amber-600 border-amber-100" },
  臨床: { border: "border-teal-200", bg: "bg-teal-50/50", text: "text-teal-700", pill: "bg-teal-50 text-teal-600 border-teal-100" },
  default: { border: "border-gray-200", bg: "bg-white", text: "text-gray-700", pill: "bg-gray-100 text-gray-600 border-gray-200" },
};

const DAYS = ["月", "火", "水", "木", "金"];
const PERIODS = [1, 2, 3, 4, 5, 6];

// 日付ユーティリティ
function getWeekDates(baseDate: Date) {
  const dayOfWeek = baseDate.getDay();
  const diffToMonday = baseDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(baseDate.setDate(diffToMonday));
  return Array.from({ length: 5 }).map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
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
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"timetable" | "syllabus" | "articles" | "hospitals">("timetable");
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(true); // プロフィール設定済みか判定
  
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const weekDates = useMemo(() => getWeekDates(new Date(currentDate)), [currentDate]);

  useEffect(() => {
    async function fetchData() {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        // 1. プロフィールの取得
        const profileData = await supabaseRestFetch<any[]>({ 
          path: `profiles?id=eq.${user.id}` 
        } as any);
        
        if (!profileData || profileData.length === 0 || !profileData[0].university_name) {
          setHasProfile(false);
          setLoading(false);
          return;
        }

        const uniName = profileData[0].university_name;
        const acaYear = profileData[0].academic_year;

        // 2. プロフィールの値を使って時間割を取得 (完全に動的)
        const queryPath = `timetable_classes?university_name=eq.${encodeURIComponent(uniName)}&academic_year=eq.${acaYear}&select=*`;
        const res = await supabaseRestFetch<ClassData[]>({ path: queryPath });
        
        if (res) {
          setClasses(res);
        }
      } catch (error) {
        console.error("データ取得に失敗しました:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user]);

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

  // ---------------------------------------------------------
  // 詳細画面 (デザイン完全維持)
  // ---------------------------------------------------------
  const renderDetailView = () => {
    if (!selectedClass) return null;
    const style = CATEGORY_STYLES[selectedClass.category || 'default'];

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
          <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold border mb-4 ${style.pill}`}>
            {selectedClass.category || "講義"}
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{selectedClass.title}</h1>
          <p className="text-sm font-bold text-gray-600 mb-8">
            {selectedClass.day}・{selectedClass.period}限 {selectedClass.starts_at?.slice(0, 5) || ""} {selectedClass.room || ""} {selectedClass.instructor || ""}
          </p>

          <div className="flex border-b border-gray-200 mb-6">
            <button className="flex-1 pb-3 text-sm font-bold text-orange-500 border-b-2 border-orange-500 text-center">基本情報</button>
            <button className="flex-1 pb-3 text-sm font-bold text-gray-400 hover:text-gray-600 text-center transition-colors">課題</button>
            <button className="flex-1 pb-3 text-sm font-bold text-gray-400 hover:text-gray-600 text-center transition-colors">メモ・通知</button>
          </div>

          <h3 className="text-sm font-bold text-gray-800 mb-4">授業情報</h3>
          <div className="bg-gray-50 rounded-2xl p-5 mb-6 space-y-4 border border-gray-100">
            <div className="flex items-center gap-4">
              <Clock size={16} className="text-gray-400" />
              <span className="text-sm text-gray-700">{selectedClass.starts_at?.slice(0, 5)} - {selectedClass.ends_at?.slice(0, 5)}</span>
            </div>
            <div className="flex items-center gap-4">
              <MapPin size={16} className="text-gray-400" />
              <span className="text-sm text-gray-700">{selectedClass.room || "教室未定"}</span>
            </div>
            {selectedClass.location && (
              <div className="flex items-center gap-4">
                <Building2 size={16} className="text-gray-400" />
                <span className="text-sm text-gray-700">{selectedClass.location}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------
  // 時間割グリッド (デザイン完全維持)
  // ---------------------------------------------------------
  const renderTimetableGrid = () => {
    const today = new Date();

    if (!hasProfile) {
       return (
         <div className="bg-white p-10 rounded-2xl border border-gray-100 text-center animate-fade-in">
           <GraduationCap size={48} className="text-orange-300 mx-auto mb-4" />
           <h3 className="text-lg font-bold text-gray-800 mb-2">プロフィールを設定してください</h3>
           <p className="text-sm text-gray-500 mb-6">大学と学年を設定すると、あなたの時間割が表示されます。</p>
           <Link href="/profile" className="inline-block bg-orange-500 text-white font-bold py-2.5 px-6 rounded-full hover:bg-orange-600 transition-colors">
             設定画面へ
           </Link>
         </div>
       )
    }

    return (
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm animate-fade-in overflow-x-auto">
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
                    <span className={`text-base font-bold ${isToday ? 'text-orange-500' : 'text-gray-800'}`}>{date.getDate()}</span>
                    <div className={`text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${isToday ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500'}`}>
                      {DAYS[i]}
                    </div>
                  </div>
                );
              })}
            </div>

            {PERIODS.map((period) => (
              <div key={period} className="grid grid-cols-[30px_repeat(5,minmax(0,1fr))] gap-2 sm:gap-3 mb-2 sm:mb-3">
                <div className="flex flex-col items-center justify-center text-gray-400">
                  <span className="text-sm font-bold">{period}</span>
                  <span className="text-[10px] font-bold">限</span>
                </div>
                
                {DAYS.map((day) => {
                  const cellClass = classes.find(c => c.day === day && c.period === period);
                  
                  if (!cellClass) {
                    return <div key={`${day}-${period}`} className="border border-gray-100 rounded-xl min-h-[90px] sm:min-h-[110px]" />;
                  }

                  const style = CATEGORY_STYLES[cellClass.category || 'default'];

                  return (
                    <button 
                      key={`${day}-${period}`} 
                      onClick={() => setSelectedClass(cellClass)}
                      className={`relative border-2 rounded-xl p-2.5 sm:p-3 min-h-[90px] sm:min-h-[110px] flex flex-col text-left transition-transform hover:scale-[1.02] ${style.border} ${style.bg}`}
                    >
                      <span className={`font-bold text-[13px] sm:text-sm leading-tight ${style.text}`}>
                        {cellClass.title}
                      </span>
                      {cellClass.room && (
                        <span className="text-[10px] sm:text-[11px] mt-1 text-gray-400 font-bold">{cellClass.room}</span>
                      )}
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
        <div className="px-6 py-6 border-b border-gray-100 sticky top-0 bg-white z-20">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">学校</h2>
            <div className="flex gap-3">
              <button className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"><Plus size={20} strokeWidth={2} /></button>
              <button className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"><Menu size={20} strokeWidth={2} /></button>
              <button className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"><Clock size={20} strokeWidth={2} /></button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
            <button onClick={() => setActiveTab("timetable")} className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === "timetable" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
              <Calendar size={16} /> 時間割
            </button>
            <button onClick={() => setActiveTab("syllabus")} className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === "syllabus" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
              <ClipboardList size={16} /> シラバス
            </button>
          </div>
        </div>
      )}

      <div className={`bg-[#fffcfc] ${!selectedClass ? 'p-4 sm:p-6' : ''}`}>
        {activeTab === "timetable" && (
          selectedClass ? renderDetailView() : renderTimetableGrid()
        )}
      </div>
    </div>
  );
}