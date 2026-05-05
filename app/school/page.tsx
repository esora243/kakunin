"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { 
  Calendar, Clock, ChevronRight, ChevronLeft, Menu, BookOpen, Plus, Loader2, Building2, ClipboardList, 
  Search, Image as ImageIcon, MoreVertical, MapPin, Video, Edit2, CheckSquare, Square 
} from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";

// ---------------------------------------------------------
// 型定義
// ---------------------------------------------------------
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

// 色の定義
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

// 日付計算ユーティリティ
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
  const [activeTab, setActiveTab] = useState<"timetable" | "syllabus" | "articles" | "hospitals">("timetable");
  const [loading, setLoading] = useState(true);
  
  // ユーザープロフィールの状態（将来的にログイン情報から取得）
  const [userProfile] = useState({
    university: '山口大学',
    faculty: '医学部',
    grade: 3
  });

  // 時間割用ステート
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const weekDates = useMemo(() => getWeekDates(new Date(currentDate)), [currentDate]);

  // DBから時間割データを取得
  useEffect(() => {
    let cancelled = false;
    async function fetchClasses() {
      setLoading(true);
      try {
        // 学校名と学年でフィルタリングし、リレーションで class_tasks も一緒に取得
        const queryPath = `timetable_classes?university=eq.${encodeURIComponent(userProfile.university)}&grade=eq.${userProfile.grade}&select=*,tasks:class_tasks(*)`;
        const res = await supabaseRestFetch<any[]>({ path: queryPath });
        
        if (!cancelled && res && Array.isArray(res)) {
          // DBのデータをアプリ用の型にマッピング
          const formattedClasses = res.map(c => ({
            id: c.id,
            title: c.title,
            category: c.category || 'default',
            day: c.day,
            periods: c.periods || [],
            room: c.room || '',
            professor: c.professor,
            timeDisplay: c.time_display,
            term: c.term,
            zoomUrl: c.zoom_url,
            hasZoom: !!c.zoom_url,
            hasNotice: c.has_notice,
            hasTask: c.tasks && c.tasks.length > 0,
            tasks: c.tasks || []
          }));
          setClasses(formattedClasses);
        }
      } catch (error) {
        console.error("時間割の取得に失敗しました:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchClasses();
    return () => { cancelled = true; };
  }, [userProfile]);

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

  // 詳細画面コンポーネント
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
          <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold border mb-4 ${style.pill}`}>
            {selectedClass.category}
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{selectedClass.title}</h1>
          <p className="text-sm font-bold text-gray-600 mb-8">
            {selectedClass.day}・{selectedClass.periods.join("〜")}限 {selectedClass.timeDisplay || "時間未設定"} {selectedClass.room} {selectedClass.professor || ""}
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
              <span className="text-sm text-gray-700">{selectedClass.timeDisplay || "時間未設定"}</span>
            </div>
            <div className="flex items-center gap-4">
              <Calendar size={16} className="text-gray-400" />
              <span className="text-sm text-gray-700">{selectedClass.term || "前期"}</span>
            </div>
            <div className="flex items-center gap-4">
              <MapPin size={16} className="text-gray-400" />
              <span className="text-sm text-gray-700">{selectedClass.room}</span>
            </div>
            {selectedClass.zoomUrl && (
              <div className="flex items-center gap-4">
                <Video size={16} className="text-gray-400" />
                <a href={`https://${selectedClass.zoomUrl}`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline">
                  {selectedClass.zoomUrl}
                </a>
              </div>
            )}
          </div>

          {selectedClass.zoomUrl && (
            <div className="flex gap-3 mb-10">
              <button className="flex-1 py-3.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors">
                <Video size={18} /> Zoomを開く
              </button>
              <button className="flex-1 py-3.5 bg-white text-gray-600 border border-gray-200 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
                <Edit2 size={18} /> URLを編集
              </button>
            </div>
          )}

          <h3 className="text-sm font-bold text-gray-800 mb-4">課題</h3>
          <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
            {selectedClass.tasks && selectedClass.tasks.length > 0 ? (
              <div className="space-y-4">
                {selectedClass.tasks.map((task) => (
                  <div key={task.id} className={`flex items-start gap-3 pb-4 ${task !== selectedClass.tasks![selectedClass.tasks!.length-1] ? 'border-b border-gray-200/60' : ''}`}>
                    <button className="mt-0.5">
                      {task.completed ? <CheckSquare className="text-orange-300" size={20} /> : <Square className="text-orange-500" size={20} />}
                    </button>
                    <div>
                      <h4 className={`text-sm font-bold mb-1 ${task.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{task.title}</h4>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs ${task.completed ? 'text-gray-400' : 'text-gray-500'}`}>提出期限 : {task.deadline}</span>
                        {task.completed ? (
                          <span className="text-xs text-gray-400">提出済み</span>
                        ) : task.days_left && (
                          <span className="text-xs text-orange-500 font-bold">（残り{task.days_left}日）</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">課題はありません</p>
            )}
            
            <button className="flex items-center gap-2 text-orange-500 font-bold text-sm mt-4 hover:text-orange-600 transition-colors">
              <Plus size={18} /> 課題を追加
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 時間割グリッド画面
  const renderTimetableGrid = () => {
    const today = new Date();

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
                  const cellClass = classes.find(c => c.day === day && c.periods.includes(period));
                  const isContinuation = cellClass && cellClass.periods[0] !== period;
                  
                  if (!cellClass) {
                    return <div key={`${day}-${period}`} className="border border-gray-100 rounded-xl min-h-[90px] sm:min-h-[110px]" />;
                  }

                  const style = CATEGORY_STYLES[cellClass.category] || CATEGORY_STYLES.default;

                  return (
                    <button 
                      key={`${day}-${period}`} 
                      onClick={() => setSelectedClass(cellClass)}
                      className={`relative border-2 rounded-xl p-2.5 sm:p-3 min-h-[90px] sm:min-h-[110px] flex flex-col text-left transition-transform hover:scale-[1.02] ${style.border} ${style.bg} ${isContinuation ? 'border-t-0 rounded-t-none opacity-80' : ''}`}
                    >
                      <span className={`font-bold text-[13px] sm:text-sm leading-tight ${style.text}`}>
                        {isContinuation ? "(続き)" : cellClass.title}
                      </span>
                      {!isContinuation && cellClass.room && (
                        <span className="text-[10px] sm:text-[11px] mt-1 text-gray-400 font-bold">{cellClass.room}</span>
                      )}
                      
                      {!isContinuation && (
                        <div className="absolute bottom-2 left-2.5 flex gap-1.5">
                          {cellClass.hasZoom && <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" />}
                          {cellClass.hasNotice && <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm" />}
                          {cellClass.hasTask && <div className="w-2.5 h-2.5 rounded-full bg-amber-700 shadow-sm" />}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}

            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 mt-8 pt-6 border-t border-gray-50">
              <div className="flex items-center gap-1.5 text-xs text-gray-600"><Square size={12} className="text-orange-200 fill-orange-50" /> 形態系</div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600"><Square size={12} className="text-blue-200 fill-blue-50" /> 機能系</div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600"><Square size={12} className="text-green-200 fill-green-50" /> 生化学</div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600"><Square size={12} className="text-amber-200 fill-amber-50" /> 病理</div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600"><Square size={12} className="text-teal-200 fill-teal-50" /> 臨床</div>
              <div className="w-px h-3 bg-gray-300 mx-1 hidden sm:block"></div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600"><div className="w-2 h-2 rounded-full bg-blue-500" /> Zoom</div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600"><div className="w-2 h-2 rounded-full bg-orange-500" /> 通知</div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600"><div className="w-2 h-2 rounded-full bg-amber-700" /> 課題</div>
            </div>
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
            <button onClick={() => setActiveTab("articles")} className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === "articles" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
              <BookOpen size={16} fill={activeTab === "articles" ? "white" : "none"} /> 勉強系記事
            </button>
            <button onClick={() => setActiveTab("hospitals")} className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === "hospitals" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
              <Building2 size={16} /> 研修病院
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